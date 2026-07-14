import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const budgets = [
  {
    file: "apps/editor/src/ui/editor-app.tsx",
    lines: 15194,
    colors: 26
  },
  {
    file: "apps/editor/src/ui/editor.css",
    lines: 5334,
    colors: 660
  },
  {
    file: "apps/editor/src/ui/editor-shell.tsx",
    lines: 1196,
    colors: 0
  },
  {
    file: "apps/editor/src/editor-session.ts",
    lines: 1522,
    colors: 0
  }
];

function physicalLineCount(source) {
  const lines = source.split(/\r?\n/);
  return source.endsWith("\n") ? lines.length - 1 : lines.length;
}

function colorLiteralCount(source) {
  return (source.match(/#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\(/gi) ?? []).length;
}

let failed = false;
console.log("Editor budget report");

for (const budget of budgets) {
  const source = readFileSync(budget.file, "utf8");
  const lines = physicalLineCount(source);
  const colors = colorLiteralCount(source);
  const lineDelta = lines - budget.lines;
  const colorDelta = colors - budget.colors;
  const lineStatus = lineDelta <= 0 ? "ok" : "over";
  const colorStatus = colorDelta <= 0 ? "ok" : "over";

  console.log(
    `${budget.file}: lines ${lines}/${budget.lines} (${lineStatus}), colors ${colors}/${budget.colors} (${colorStatus})`
  );
  if (lineDelta > 0 || colorDelta > 0) failed = true;
}

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
  console.error("Editor budget exceeded: split or recolor work must be reviewed before merge.");
  process.exitCode = 1;
}
