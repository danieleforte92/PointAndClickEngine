import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const committedCandidate = process.argv.includes("--committed");

const trackedFiles = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split(/\r?\n/)
  .filter(Boolean)
  .map((file) => file.replace(/\\/g, "/"));

const releaseHostilePatterns = [
  { label: "build output directory", pattern: /(^|\/)(dist|out|\.vite|node_modules)\// },
  { label: "log file", pattern: /(^|\/)[^/]+\.log$/i },
  { label: "zip archive", pattern: /(^|\/)[^/]+\.zip$/i },
  { label: "root experimental workflow JSON", pattern: /^[^/]*(workflow|comfy|krea|imggen|t2i)[^/]*\.json$/i }
];

const requiredReleaseFiles = [
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

const violations = trackedFiles.flatMap((file) =>
  releaseHostilePatterns
    .filter(({ pattern }) => pattern.test(file))
    .map(({ label }) => `${file} (${label})`)
);

if (violations.length > 0) {
  console.error("Release check failed. Remove these tracked release-hostile artifacts:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

const trackedFileSet = new Set(trackedFiles);
const missingFiles = requiredReleaseFiles.filter((file) => !trackedFileSet.has(file));
if (missingFiles.length > 0) {
  console.error("Release check failed. Required Creator Alpha release controls must be committed:");
  for (const file of missingFiles) console.error(`- ${file} (missing or untracked)`);
  process.exit(1);
}

const manifestFiles = trackedFiles.filter((file) => file === "package.json" || /(^|\/)package\.json$/.test(file));
const manifests = manifestFiles.map((file) => {
  try {
    return { file, manifest: JSON.parse(readFileSync(file, "utf8")) };
  } catch (error) {
    console.error(`Release check failed. Cannot parse ${file}: ${error.message}`);
    process.exit(1);
  }
});

const rootManifest = manifests.find(({ file }) => file === "package.json")?.manifest;
if (!rootManifest?.name || !rootManifest.version || !rootManifest.license || rootManifest.private !== true) {
  console.error("Release check failed. Root package.json needs name, version, license, and private: true.");
  process.exit(1);
}
if (!/^pnpm@\d+\.\d+\.\d+$/.test(rootManifest.packageManager ?? "")) {
  console.error("Release check failed. Root package.json must pin packageManager as pnpm@<major>.<minor>.<patch>.");
  process.exit(1);
}
if (!rootManifest.engines?.node) {
  console.error("Release check failed. Root package.json must declare the supported Node.js range.");
  process.exit(1);
}

const metadataViolations = manifests.flatMap(({ file, manifest }) => {
  const violations = [];
  if (!manifest.name) violations.push("missing name");
  if (manifest.version !== rootManifest.version) violations.push(`version must match root (${rootManifest.version})`);
  if (manifest.private !== true) violations.push("must be private to prevent accidental package publication");
  return violations.map((violation) => `${file} (${violation})`);
});
if (metadataViolations.length > 0) {
  console.error("Release check failed. Workspace package metadata is inconsistent:");
  for (const violation of metadataViolations) console.error(`- ${violation}`);
  process.exit(1);
}

if (committedCandidate) {
  const status = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], { encoding: "utf8" }).trim();
  if (status) {
    console.error("Release check failed. A committed candidate must have a clean working tree:");
    console.error(status);
    process.exit(1);
  }
}

console.log(committedCandidate ? "Committed candidate release check passed." : "Release hygiene check passed.");
