import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const currentVersion = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).version;
const errors = [];

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if ([".git", "node_modules", "coverage", "playwright-report", "test-results", "release-artifacts", "out"].includes(entry.name)) {
      return [];
    }
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return entry.isFile() && entry.name.endsWith(".md") ? [fullPath] : [];
  });
}

function relative(file) {
  return path.relative(root, file).replaceAll(path.sep, "/");
}

const markdownFiles = walk(root);
const activeVersionFiles = [
  "README.md",
  "docs/release-notes-creator-alpha.md",
  "docs/release-checklist.md"
];

for (const file of activeVersionFiles) {
  const fullPath = path.join(root, file);
  const contents = readFileSync(fullPath, "utf8");
  if (!contents.includes(currentVersion)) {
    errors.push(`${file} must mention the current workspace version ${currentVersion}`);
  }
}

const staleChecks = [
  ["docs/creator-alpha-policy.md", /0\.1\.x Creator Alpha|schema-v1 project-document/],
  ["docs/release-notes-creator-alpha.md", /not yet a\s+full node-graph editor/],
  ["docs/release-checklist.md", /may still time out during shutdown/]
];

for (const [file, pattern] of staleChecks) {
  if (pattern.test(readFileSync(path.join(root, file), "utf8"))) {
    errors.push(`${file} contains a superseded product statement (${pattern})`);
  }
}

for (const file of markdownFiles) {
  const contents = readFileSync(file, "utf8");
  for (const match of contents.matchAll(/\[[^\]]+\]\(([^)\n]+)\)/g)) {
    const target = match[1].trim().replace(/^<|>$/g, "");
    if (!target || /^(?:https?:\/\/|mailto:|#|data:)/i.test(target)) continue;
    const relativeTarget = target.split("#", 1)[0].split("?", 1)[0];
    if (!relativeTarget) continue;
    const resolved = path.resolve(path.dirname(file), decodeURIComponent(relativeTarget));
    if (!resolved.startsWith(root) || !statExists(resolved)) {
      errors.push(`${relative(file)} links to missing local target ${target}`);
    }
  }
}

function statExists(file) {
  try {
    statSync(file);
    return true;
  } catch {
    return false;
  }
}

if (errors.length > 0) {
  console.error("Documentation check failed");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Documentation check passed (${markdownFiles.length} Markdown files, version ${currentVersion})`);
}
