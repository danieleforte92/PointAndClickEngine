import { copyFile, mkdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export interface WebExportAsset {
  /** Path to the asset inside the project, using `/` separators. */
  sourcePath: string;
  /** Path to write inside the export directory. Defaults to sourcePath. */
  outputPath?: string;
}

export interface BrowserEntrypointFile {
  /** HTML entrypoint path inside the project, using `/` separators. */
  sourcePath: string;
  /** Path to write inside the export directory. Defaults to `index.html`. */
  outputPath?: string;
}

export interface BrowserEntrypointContents {
  /** HTML entrypoint contents supplied by the caller. */
  contents: string;
  /** Path to write inside the export directory. Defaults to `index.html`. */
  outputPath?: string;
}

export type BrowserEntrypoint = BrowserEntrypointFile | BrowserEntrypointContents;

export interface WebExportOptions {
  /** Project root used to resolve and validate source paths. */
  projectDirectory: string;
  /** Directory receiving the static export. It may be outside the project. */
  outputDirectory: string;
  /** Browser HTML entrypoint to copy or create. */
  browserEntrypoint: BrowserEntrypoint;
  /** Files to copy into the export and whose URLs are rewritten in the entrypoint. */
  assets: readonly WebExportAsset[];
}

export interface WebExportAssetResult {
  outputPath: string;
  sourcePath: string;
}

export interface WebExportResult {
  assets: readonly WebExportAssetResult[];
  entrypointPath: string;
  entrypointOutputPath: string;
  outputDirectory: string;
}

const DEFAULT_ENTRYPOINT_PATH = "index.html";

function isPathInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function toNativePath(relativePath: string): string {
  return relativePath.replace(/[\\/]+/g, path.sep);
}

function toPosixPath(relativePath: string): string {
  return relativePath.replace(/[\\/]+/g, "/");
}

function normalizeRelativePath(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} cannot be empty`);
  }

  const posixValue = toPosixPath(trimmed);
  if (path.posix.isAbsolute(posixValue) || path.win32.isAbsolute(trimmed) || posixValue.startsWith("/")) {
    throw new Error(`${label} "${value}" must be relative`);
  }

  const normalized = path.posix.normalize(posixValue);
  if (normalized === ".." || normalized.startsWith("../") || normalized === ".") {
    throw new Error(`${label} "${value}" is outside the allowed root`);
  }

  return normalized;
}

function relativeUrl(fromOutputPath: string, toOutputPath: string): string {
  const relative = path.posix.relative(path.posix.dirname(fromOutputPath), toOutputPath);
  return relative || path.posix.basename(toOutputPath);
}

function relativeUrlFromDirectory(fromDirectory: string, toPath: string): string {
  const relative = path.posix.relative(fromDirectory, toPath);
  return relative || path.posix.basename(toPath);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function rewriteEntrypoint(
  contents: string,
  entrypointSourcePath: string | undefined,
  entrypointOutputPath: string,
  assets: readonly { outputPath: string; sourcePath: string }[]
): string {
  const sourceDirectory = entrypointSourcePath ? path.posix.dirname(entrypointSourcePath) : ".";
  const replacements = assets.map((asset, index) => {
    const outputUrl = relativeUrl(entrypointOutputPath, asset.outputPath);
    const sourceUrl = relativeUrlFromDirectory(sourceDirectory, asset.sourcePath);
    const variants = new Set([
      asset.sourcePath,
      sourceUrl,
      `./${asset.sourcePath}`,
      `./${sourceUrl}`,
      `/${asset.sourcePath}`,
      `/${sourceUrl}`
    ]);

    return {
      outputUrl,
      pattern: new RegExp(
        `(?<![A-Za-z0-9._/])(?:${[...variants]
          .sort((left, right) => right.length - left.length)
          .map(escapeRegExp)
          .join("|")})(?![A-Za-z0-9._/-])`,
        "g"
      ),
      placeholder: `\u0000pointclick-web-export-${index}\u0000`
    };
  });

  let rewritten = contents;
  for (const replacement of replacements) {
    rewritten = rewritten.replace(replacement.pattern, replacement.placeholder);
  }
  for (const replacement of replacements) {
    rewritten = rewritten.replaceAll(replacement.placeholder, replacement.outputUrl);
  }
  return rewritten;
}

async function resolveProjectFile(projectRoot: string, relativePath: string, label: string): Promise<string> {
  const candidate = path.resolve(projectRoot, toNativePath(relativePath));
  if (!isPathInside(projectRoot, candidate)) {
    throw new Error(`${label} "${relativePath}" is outside the project`);
  }

  let canonicalProjectRoot: string;
  let canonicalCandidate: string;
  try {
    canonicalProjectRoot = await realpath(projectRoot);
    canonicalCandidate = await realpath(candidate);
  } catch (error) {
    throw new Error(
      `${label} "${relativePath}" could not be resolved: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (!isPathInside(canonicalProjectRoot, canonicalCandidate)) {
    throw new Error(`${label} "${relativePath}" resolves outside the project`);
  }

  const fileStats = await stat(canonicalCandidate);
  if (!fileStats.isFile()) {
    throw new Error(`${label} "${relativePath}" must point to a file`);
  }
  return canonicalCandidate;
}

async function prepareOutputPath(outputRoot: string, relativePath: string, label: string): Promise<string> {
  const candidate = path.resolve(outputRoot, toNativePath(relativePath));
  if (!isPathInside(outputRoot, candidate)) {
    throw new Error(`${label} "${relativePath}" is outside the export directory`);
  }

  let existingPath = candidate;
  while (true) {
    try {
      await stat(existingPath);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const parent = path.dirname(existingPath);
      if (parent === existingPath) break;
      existingPath = parent;
    }
  }

  const canonicalOutputRoot = await realpath(outputRoot);
  const canonicalExistingPath = await realpath(existingPath);
  if (!isPathInside(canonicalOutputRoot, canonicalExistingPath)) {
    throw new Error(`${label} "${relativePath}" resolves outside the export directory`);
  }
  return candidate;
}

function assertUniqueOutputPaths(entrypointPath: string, assetPaths: readonly string[]): void {
  const seen = new Set([entrypointPath]);
  for (const assetPath of assetPaths) {
    if (seen.has(assetPath)) {
      throw new Error(`Export output path "${assetPath}" is used more than once`);
    }
    seen.add(assetPath);
  }
}

/**
 * Creates a browser-ready static export from a prebuilt HTML entrypoint and
 * project-relative assets. Source paths are resolved only inside the project;
 * generated URLs are always relative to the generated entrypoint.
 */
export async function exportWeb(options: WebExportOptions): Promise<WebExportResult> {
  const projectRoot = path.resolve(options.projectDirectory);
  const outputDirectory = path.resolve(options.outputDirectory);
  await mkdir(outputDirectory, { recursive: true });
  await realpath(projectRoot);

  const entrypointOutputPath = normalizeRelativePath(
    options.browserEntrypoint.outputPath ?? DEFAULT_ENTRYPOINT_PATH,
    "Browser entrypoint output path"
  );

  const assets = options.assets.map((asset) => {
    const sourcePath = normalizeRelativePath(asset.sourcePath, "Asset source path");
    const outputPath = normalizeRelativePath(asset.outputPath ?? sourcePath, "Asset output path");
    return { outputPath, sourcePath };
  });
  assertUniqueOutputPaths(
    entrypointOutputPath,
    assets.map((asset) => asset.outputPath)
  );

  let entrypointSourcePath: string | undefined;
  let entrypointContents: string;
  if ("contents" in options.browserEntrypoint) {
    entrypointContents = options.browserEntrypoint.contents;
  } else {
    entrypointSourcePath = normalizeRelativePath(
      options.browserEntrypoint.sourcePath,
      "Browser entrypoint source path"
    );
    entrypointContents = await readFile(
      await resolveProjectFile(projectRoot, entrypointSourcePath, "Browser entrypoint source path"),
      "utf8"
    );
  }

  const resolvedAssets = await Promise.all(
    assets.map(async (asset) => ({
      ...asset,
      absoluteSourcePath: await resolveProjectFile(projectRoot, asset.sourcePath, "Asset source path")
    }))
  );
  const absoluteEntrypointPath = await prepareOutputPath(
    outputDirectory,
    entrypointOutputPath,
    "Browser entrypoint output path"
  );
  const absoluteAssetPaths = await Promise.all(
    resolvedAssets.map(async (asset) => ({
      ...asset,
      absoluteOutputPath: await prepareOutputPath(outputDirectory, asset.outputPath, "Asset output path")
    }))
  );

  const rewrittenEntrypoint = rewriteEntrypoint(
    entrypointContents,
    entrypointSourcePath,
    entrypointOutputPath,
    assets
  );
  await mkdir(path.dirname(absoluteEntrypointPath), { recursive: true });
  await writeFile(absoluteEntrypointPath, rewrittenEntrypoint, "utf8");
  for (const asset of absoluteAssetPaths) {
    await mkdir(path.dirname(asset.absoluteOutputPath), { recursive: true });
    await copyFile(asset.absoluteSourcePath, asset.absoluteOutputPath);
  }

  return {
    assets: assets.map((asset) => ({ ...asset })),
    entrypointPath: absoluteEntrypointPath,
    entrypointOutputPath,
    outputDirectory
  };
}
