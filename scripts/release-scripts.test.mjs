import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { afterEach, test } from "node:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const checkRelease = join(scriptsDirectory, "check-release.mjs");
const createChecksums = join(scriptsDirectory, "create-checksums.mjs");
const verifyWindowsPackage = join(scriptsDirectory, "verify-windows-package.mjs");
const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function temporaryDirectory() {
  const directory = mkdtempSync(join(tmpdir(), "pointclick-release-script-"));
  temporaryDirectories.push(directory);
  return directory;
}

function writeFile(root, file, content = "release control\n") {
  const destination = join(root, file);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, content);
}

function createCandidateRepository({ omitFromCommit, extraManifest } = {}) {
  const root = temporaryDirectory();
  const controls = [
    "LICENSE",
    "SECURITY.md",
    "THIRD_PARTY_NOTICES.md",
    "CODE_OF_CONDUCT.md",
    "GOVERNANCE.md",
    "SUPPORT.md",
    "docs/creator-alpha-policy.md",
    "docs/release-checklist.md",
    "docs/release-notes-creator-alpha.md",
    "docs/creator-alpha-release-issue.md",
    ".github/workflows/release-candidate.yml",
    "provenance/inventory.json"
  ];
  writeFile(root, "package.json", JSON.stringify({
    name: "fixture",
    version: "0.1.0",
    private: true,
    license: "Apache-2.0",
    packageManager: "pnpm@9.6.0",
    engines: { node: ">=22.17.0" }
  }));
  for (const control of controls) {
    if (control !== omitFromCommit) writeFile(root, control);
  }
  if (extraManifest) writeFile(root, "packages/fixture/package.json", JSON.stringify(extraManifest));
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["config", "user.email", "release-test@example.invalid"], { cwd: root });
  execFileSync("git", ["config", "user.name", "Release test"], { cwd: root });
  execFileSync("git", ["add", "."], { cwd: root });
  execFileSync("git", ["commit", "-qm", "fixture"], { cwd: root });
  if (omitFromCommit) writeFile(root, omitFromCommit);
  return root;
}

test("committed candidate release check accepts a clean, complete fixture", () => {
  const root = createCandidateRepository();
  const result = spawnSync(process.execPath, [checkRelease, "--committed"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Committed candidate release check passed/);
});

test("release check rejects an untracked required control", () => {
  const root = createCandidateRepository({ omitFromCommit: "THIRD_PARTY_NOTICES.md" });
  const result = spawnSync(process.execPath, [checkRelease], { cwd: root, encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /THIRD_PARTY_NOTICES\.md \(missing or untracked\)/);
});

test("release check rejects inconsistent workspace package metadata", () => {
  const root = createCandidateRepository({
    extraManifest: { name: "@fixture/package", version: "0.2.0", private: false }
  });
  const result = spawnSync(process.execPath, [checkRelease], { cwd: root, encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /version must match root/);
  assert.match(result.stderr, /must be private/);
});

test("checksum generation is deterministic and refuses output inside the package", () => {
  const root = temporaryDirectory();
  writeFile(root, "package/pointclick-studio.exe", "binary fixture");
  writeFile(root, "release/PointClickStudio-v0.1.0-win32-x64.zip", "zip fixture");
  const output = join(root, "checksums.txt");
  const success = spawnSync(
    process.execPath,
    [createChecksums, join(root, "package"), output, join(root, "release", "PointClickStudio-v0.1.0-win32-x64.zip")],
    { encoding: "utf8" }
  );
  assert.equal(success.status, 0, success.stderr);
  assert.match(readFileSync(output, "utf8"), /pointclick-studio\.exe/);
  assert.match(readFileSync(output, "utf8"), /PointClickStudio-v0\.1\.0-win32-x64\.zip/);

  const unsafe = spawnSync(process.execPath, [createChecksums, join(root, "package"), join(root, "package", "SHA256SUMS.txt")], { encoding: "utf8" });
  assert.notEqual(unsafe.status, 0);
  assert.match(unsafe.stderr, /outside the package source directory/);
});

test("Windows package verifier checks the executable, ASAR, and bundled preview", () => {
  const root = temporaryDirectory();
  writeFile(root, "PointClickStudio-win32-x64/pointclick-studio.exe");
  writeFile(root, "PointClickStudio-win32-x64/resources/app.asar");
  writeFile(root, "PointClickStudio-win32-x64/resources/dist/index.html");
  const result = spawnSync(process.execPath, [verifyWindowsPackage, join(root, "PointClickStudio-win32-x64")], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});
