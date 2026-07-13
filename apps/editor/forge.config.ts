import { execFileSync } from "node:child_process";
import { existsSync, lstatSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { VitePlugin } from "@electron-forge/plugin-vite";

type WindowsSigningOptions = {
  certificateFile?: string;
  certificatePassword?: string;
  signToolPath?: string;
  signWithParams?: string;
  timestampServer?: string;
  description?: string;
  website?: string;
};

function environmentValue(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

function regularFile(filePath: string | undefined): filePath is string {
  if (!filePath || !existsSync(filePath)) return false;
  try {
    return lstatSync(filePath).isFile();
  } catch {
    return false;
  }
}

function configuredWindowsSigning(): WindowsSigningOptions | undefined {
  const configuredCertificate = environmentValue(
    "POINTCLICK_WINDOWS_CERTIFICATE_FILE",
    "WINDOWS_CERTIFICATE_FILE"
  );
  const certificatePassword = environmentValue(
    "POINTCLICK_WINDOWS_CERTIFICATE_PASSWORD",
    "WINDOWS_CERTIFICATE_PASSWORD"
  );
  const certificateFile = configuredCertificate ? resolve(process.cwd(), configuredCertificate) : undefined;
  const signToolPathValue = environmentValue(
    "POINTCLICK_WINDOWS_SIGNTOOL_PATH",
    "WINDOWS_SIGNTOOL_PATH"
  );
  const signWithParams = environmentValue(
    "POINTCLICK_WINDOWS_SIGN_WITH_PARAMS",
    "WINDOWS_SIGN_WITH_PARAMS"
  );
  const timestampServer = environmentValue(
    "POINTCLICK_WINDOWS_TIMESTAMP_SERVER",
    "WINDOWS_TIMESTAMP_SERVER"
  );
  const hasCertificate = Boolean(certificateFile && certificatePassword && regularFile(certificateFile));
  const hasCustomSigner = Boolean(signToolPathValue || signWithParams);
  if (!hasCertificate && !hasCustomSigner) return undefined;

  return {
    ...(hasCertificate
      ? { certificateFile: certificateFile as string, certificatePassword: certificatePassword as string }
      : {}),
    ...(signToolPathValue ? { signToolPath: resolve(process.cwd(), signToolPathValue) } : {}),
    ...(signWithParams ? { signWithParams } : {}),
    ...(timestampServer ? { timestampServer } : {}),
    description: "Point & Click Studio",
    website: "https://github.com/danieleforte92/PointAndClickEngine"
  };
}

function repositoryRoot(): string {
  const candidates = [process.cwd(), resolve(process.cwd(), "../..")];
  const root = candidates.find((candidate) => existsSync(resolve(candidate, "scripts/package-verification.mjs")));
  if (!root) throw new Error("Could not locate scripts/package-verification.mjs from the editor build.");
  return root;
}

function verifyWindowsMakeResults(
  makeResults: Array<{ artifacts: string[]; platform: string; arch: string; packageJSON: unknown }>,
  forgeConfig: ForgeConfig
): void {
  const windowsResults = makeResults.filter((result) => result.platform === "win32");
  if (windowsResults.length === 0) return;

  const root = repositoryRoot();
  const verifier = resolve(root, "scripts/package-verification.mjs");
  const appName = String(forgeConfig.packagerConfig?.name ?? "PointClickStudio");
  const artifactsByArch = new Map<string, string[]>();
  for (const result of windowsResults) {
    const artifacts = artifactsByArch.get(result.arch) ?? [];
    artifacts.push(...result.artifacts);
    artifactsByArch.set(result.arch, artifacts);
  }

  for (const [arch, rawArtifacts] of artifactsByArch) {
    const artifacts = rawArtifacts.map((artifact) => resolve(artifact));
    const zip = artifacts.find((artifact) => artifact.toLowerCase().endsWith(".zip"));
    const releases = artifacts.find((artifact) => basename(artifact).toUpperCase() === "RELEASES");
    if (!zip || !releases) {
      throw new Error("Windows make did not produce both a portable ZIP and a Squirrel RELEASES manifest.");
    }

    const makeRoot = resolve(dirname(zip), "../../../../");
    const packageDirectory = resolve(makeRoot, `${appName}-win32-${arch}`);
    const squirrelDirectory = dirname(releases);
    const checksums = resolve(root, "release-artifacts", `SHA256SUMS-win32-${arch}.txt`);
    const verifierArguments = [
      verifier,
      "--package",
      packageDirectory,
      "--zip",
      zip,
      "--squirrel",
      squirrelDirectory,
      "--checksums",
      checksums,
      ...artifacts.flatMap((artifact) => ["--artifact", artifact])
    ];

    execFileSync(process.execPath, verifierArguments, {
      cwd: root,
      env: process.env,
      stdio: "inherit"
    });
  }
}

const windowsSigning = configuredWindowsSigning();

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    name: "PointClickStudio",
    executableName: "pointclick-studio",
    extraResource: ["../player-web/dist"],
    ...(windowsSigning ? { windowsSign: windowsSigning } : {})
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      // The workspace package name is scoped (@pointclick/editor), but Squirrel
      // uses this value as a filesystem path for the generated .nuspec file.
      // Keep the public app/installer name PointClickStudio while using a safe
      // NuGet application id internally.
      name: "pointclick_studio",
      authors: "Point & Click Studio contributors",
      description: "Point & Click Studio desktop editor",
      ...(windowsSigning ? { windowsSign: windowsSigning } : {})
    }),
    new MakerZIP({}, ["darwin", "win32"]),
    new MakerRpm({}),
    new MakerDeb({})
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: "src/main.ts",
          config: "vite.main.config.ts",
          target: "main"
        },
        {
          entry: "src/preload.ts",
          config: "vite.preload.config.ts",
          target: "preload"
        }
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.renderer.config.ts"
        }
      ]
    })
  ],
  hooks: {
    postMake: async (forgeConfig, makeResults) => {
      verifyWindowsMakeResults(makeResults, forgeConfig);
    }
  }
};

export default config;
