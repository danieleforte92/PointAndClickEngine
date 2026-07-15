import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { execFileSync } from "node:child_process";

const repoRoot = new URL("../", import.meta.url).pathname.replace(/^\/(\w):/, "$1:");

const publicBudgets = [
  { file: "apps/editor/src/ui/editor-app.tsx", maxLines: 500 },
  { file: "apps/editor/src/ui/editor.css", maxLines: 800 },
  { file: "apps/editor/src/editor-session.ts", maxLines: 800 },
  { file: "apps/editor/src/ui/editor-shell.tsx", maxLines: 800 }
];

const featureAreas = [
  {
    id: "M06 AI",
    directory: "apps/editor/src/ui/features/ai",
    view: "ai-studio-workspace.tsx",
    controller: "ai-studio-controller.ts",
    stylesheet: "ai-studio.css",
    test: "ai-studio-controller.test.ts"
  },
  {
    id: "M07 Scenes",
    directory: "apps/editor/src/ui/features/scenes",
    view: "scenes-launchpad.tsx",
    controller: "scene-studio-controller.ts",
    stylesheet: "scene-studio.css",
    test: "scene-studio-controller.test.ts"
  },
  {
    id: "M08 Assets",
    directory: "apps/editor/src/ui/features/assets",
    view: "asset-studio-launchpad.tsx",
    controller: "asset-studio-controller.ts",
    stylesheet: "asset-studio.css",
    test: "asset-studio-controller.test.ts"
  },
  {
    id: "M10 Narrative",
    directory: "apps/editor/src/ui/features/narrative",
    view: "narrative-graph.tsx",
    controller: "narrative-controller.ts",
    stylesheet: "narrative.css",
    test: "narrative-controller.test.ts"
  },
  {
    id: "M11 Project",
    directory: "apps/editor/src/ui/features/project",
    view: "project-workspace.tsx",
    controller: "project-controller.ts",
    stylesheet: "project.css",
    test: "project-controller.test.ts"
  },
  {
    id: "M11 Build",
    directory: "apps/editor/src/ui/features/build",
    view: "build-workspace.tsx",
    controller: "build-controller.ts",
    stylesheet: "build.css",
    test: "build-controller.test.ts"
  },
  {
    id: "M12 Test Lab",
    directory: "apps/editor/src/ui/features/test-lab",
    view: "runtime-debug-view.tsx",
    controller: "test-lab-controller.ts",
    stylesheet: "test-lab.css",
    test: "test-lab-controller.test.ts"
  }
];

const colorExceptions = [
  {
    file: "apps/editor/src/ui/features/narrative/narrative-graph.tsx",
    count: 3,
    rationale: "React Flow canvas/minimap content colors retain graph semantics until the library accepts CSS tokens."
  },
  {
    file: "apps/editor/src/ui/features/scenes/scene-viewport.tsx",
    count: 1,
    rationale: "One empty-canvas fallback preserves the deterministic scene-art baseline."
  }
];

const colorPattern = /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\(/gi;
const sourceExtensions = new Set([".ts", ".tsx", ".css"]);

function absolute(relativePath) {
  return join(repoRoot, relativePath);
}

function read(relativePath) {
  return readFileSync(absolute(relativePath), "utf8");
}

function physicalLineCount(source) {
  return source.endsWith("\n") ? source.split(/\r?\n/).length - 1 : source.split(/\r?\n/).length;
}

function colorLiteralCount(source) {
  return source.match(colorPattern)?.length ?? 0;
}

// Keep the traversal synchronous and dependency-free for CI and packaged checks.
function walk(directory) {
  const result = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...walk(fullPath));
    else if (sourceExtensions.has(entry.name.slice(entry.name.lastIndexOf(".")))) result.push(fullPath);
  }
  return result;
}

let failed = false;
console.log("Terminal editor budget report");

for (const budget of publicBudgets) {
  const path = absolute(budget.file);
  if (!existsSync(path)) {
    console.error(`${budget.file}: missing`);
    failed = true;
    continue;
  }
  const source = read(budget.file);
  const lines = physicalLineCount(source);
  const colors = colorLiteralCount(source);
  console.log(`${budget.file}: lines ${lines}/${budget.maxLines}, colors ${colors}`);
  if (lines > budget.maxLines) failed = true;
}

let ownedCount = 0;
for (const area of featureAreas) {
  const required = [area.view, area.controller, area.stylesheet, area.test].map((file) => `${area.directory}/${file}`);
  const missing = required.filter((file) => !existsSync(absolute(file)));
  if (missing.length) {
    console.error(`${area.id}: missing ${missing.join(", ")}`);
    failed = true;
    continue;
  }
  ownedCount += 1;
  console.log(`${area.id}: owned view/controller/style/test`);
}
console.log(`Fully owned feature areas: ${ownedCount}/${featureAreas.length}`);
if (ownedCount !== featureAreas.length) failed = true;

const allFeatureFiles = featureAreas.flatMap((area) => walk(absolute(area.directory)));
for (const file of allFeatureFiles) {
  const relativePath = relative(repoRoot, file).replaceAll("\\", "/");
  if (relativePath.endsWith("-legacy.css")) continue;
  const lines = physicalLineCount(read(relativePath));
  if (lines > 800) {
    console.error(`${relativePath}: ${lines} lines exceeds hard feature ceiling 800`);
    failed = true;
  }
}

for (const file of allFeatureFiles) {
  const relativePath = relative(repoRoot, file).replaceAll("\\", "/");
  if (relativePath.endsWith("-legacy.css")) continue;
  const source = read(relativePath);
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  if (/\b(?:EditorGateway|createBrowserEditorGateway)\b|\b(?:gateway|injectedGateway)\s*(?:\.|\()/.test(code)) {
    console.error(`${relativePath}: direct gateway access in feature presentation/controller`);
    failed = true;
  }
  const currentArea = featureAreas.find((area) => relativePath.startsWith(`${area.directory}/`));
  const siblingImport = /from\s+["'][^"']*features\/(ai|scenes|assets|narrative|project|build|test-lab)\//g;
  for (const match of source.matchAll(siblingImport)) {
    if (!currentArea || !relativePath.startsWith(`apps/editor/src/ui/features/${match[1]}/`)) {
      console.error(`${relativePath}: sibling feature import ${match[1]}`);
      failed = true;
    }
  }
}

const monitoredFeatureSources = allFeatureFiles.filter((file) => !file.endsWith("-legacy.css"));
const monitoredSources = [
  ...publicBudgets.map((budget) => absolute(budget.file)),
  ...monitoredFeatureSources
];
const totalColors = monitoredSources.reduce((sum, file) => sum + colorLiteralCount(read(relative(repoRoot, file))), 0);
const documentedColorTotal = colorExceptions.reduce((sum, exception) => sum + exception.count, 0);
console.log(`Documented non-theme color exceptions: ${documentedColorTotal}/${totalColors} (target <12)`);
for (const exception of colorExceptions) {
  const actual = colorLiteralCount(read(exception.file));
  console.log(`- ${exception.file}: ${actual}/${exception.count} — ${exception.rationale}`);
  if (actual !== exception.count) failed = true;
}
if (documentedColorTotal !== totalColors || totalColors >= 12) failed = true;

let changedFiles = "(none)";
try {
  const status = execFileSync("git", ["status", "--short"], { encoding: "utf8" }).trim();
  if (status) changedFiles = status;
} catch {
  changedFiles = "(git status unavailable)";
}
console.log("Changed files:");
console.log(changedFiles);

if (failed) {
  console.error("Terminal editor budget failed.");
  process.exitCode = 1;
} else {
  console.log("Terminal editor budget, ownership, gateway, sibling-import, and color gates passed.");
}
