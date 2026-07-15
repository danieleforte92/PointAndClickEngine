import { readFileSync } from "node:fs";

const repoRoot = new URL("../", import.meta.url);
const readRepoFile = (relativePath) => readFileSync(new URL(relativePath, repoRoot), "utf8");

const requiredTokens = [
  "--pc-bg-canvas",
  "--pc-bg-app",
  "--pc-bg-panel",
  "--pc-bg-raised",
  "--pc-bg-control",
  "--pc-border-subtle",
  "--pc-border-strong",
  "--pc-text-primary",
  "--pc-text-secondary",
  "--pc-text-muted",
  "--pc-accent-brand",
  "--pc-state-info",
  "--pc-state-success",
  "--pc-state-warning",
  "--pc-state-danger",
  "--pc-focus"
];

const contract = readRepoFile("packages/ui-theme/src/theme-contract.css");
const studio = readRepoFile("packages/ui-theme/src/studio.css");
const player = readRepoFile("packages/ui-theme/src/player.css");
const packageJson = JSON.parse(readRepoFile("packages/ui-theme/package.json"));

const colorValues = new Map(
  [...contract.matchAll(/(--pc-color-[\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((match) => [
    match[1],
    match[2]
  ])
);

function relativeLuminance(hex) {
  const channels = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset + 1, offset + 3), 16) / 255);
  const linear = channels.map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrastRatio(foreground, background) {
  const foregroundLuminance = relativeLuminance(colorValues.get(foreground));
  const backgroundLuminance = relativeLuminance(colorValues.get(background));
  const light = Math.max(foregroundLuminance, backgroundLuminance);
  const dark = Math.min(foregroundLuminance, backgroundLuminance);
  return (light + 0.05) / (dark + 0.05);
}

const missingTokens = requiredTokens.filter((token) => !contract.includes(`${token}:`));
const missingExports = ["./studio.css", "./player.css", "./theme-contract.css"].filter(
  (entry) => !packageJson.exports?.[entry]
);
const violations = [];
if (!studio.includes('@import "./theme-contract.css"')) {
  violations.push("studio.css must import theme-contract.css");
}
if (player.includes("theme-contract.css")) {
  violations.push("player.css must not import theme-contract.css");
}

const contrastChecks = [
  ["--pc-color-text-primary", "--pc-color-deep-navy-950", 4.5],
  ["--pc-color-text-secondary", "--pc-color-deep-navy-900", 4.5],
  ["--pc-color-text-muted", "--pc-color-deep-navy-900", 4.5],
  ["--pc-color-text-on-accent", "--pc-color-violet-500", 4.5],
  ["--pc-color-blue-400", "--pc-color-deep-navy-900", 3]
];

for (const [foreground, background, minimum] of contrastChecks) {
  if (!colorValues.has(foreground) || !colorValues.has(background)) {
    violations.push(`contrast check cannot resolve ${foreground} on ${background}`);
    continue;
  }
  const ratio = contrastRatio(foreground, background);
  if (ratio < minimum) {
    violations.push(`${foreground} on ${background} has contrast ${ratio.toFixed(2)} (minimum ${minimum})`);
  }
}

if (missingTokens.length || missingExports.length || violations.length) {
  console.error("Theme contract check failed");
  if (missingTokens.length) console.error(`Missing tokens: ${missingTokens.join(", ")}`);
  if (missingExports.length) console.error(`Missing exports: ${missingExports.join(", ")}`);
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.log(`Theme contract ok (${requiredTokens.length} tokens, contrast checks, scoped studio/player entries)`);
}
