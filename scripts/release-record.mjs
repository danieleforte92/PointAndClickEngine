import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const output = option("--output");
if (!output) throw new Error("Usage: node scripts/release-record.mjs --output <file> [--checksums <file>]");
const command = (file, args, options = {}) => execFileSync(file, args, { encoding: "utf8", ...options }).trim();
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const strictGate = spawnSync(process.execPath, ["scripts/validate-provenance.mjs", "--strict", "--format=json"], {
  encoding: "utf8"
});
let strictReport;
try {
  strictReport = JSON.parse(strictGate.stdout);
} catch {
  strictReport = { parseError: strictGate.stderr || "No strict provenance report was produced." };
}

const checksumsPath = option("--checksums");
const record = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  releaseVersion: JSON.parse(readFileSync("package.json", "utf8")).version,
  commit: command("git", ["rev-parse", "HEAD"]),
  gitStatus: command("git", ["status", "--porcelain"]),
  cleanWorkingTree: command("git", ["status", "--porcelain"]) === "",
  toolchain: {
    node: process.version,
    pnpm: command(pnpmCommand, ["--version"], { shell: process.platform === "win32" }),
    packageManager: JSON.parse(readFileSync("package.json", "utf8")).packageManager
  },
  checksums: checksumsPath ? { path: checksumsPath, sha256sumFile: readFileSync(checksumsPath, "utf8") } : null,
  signing: { status: process.env.RELEASE_SIGNING_STATUS ?? "not-configured", evidence: process.env.RELEASE_SIGNING_EVIDENCE ?? null },
  manualPackagedPreview: { status: process.env.RELEASE_PACKAGED_PREVIEW ?? "pending", evidence: process.env.RELEASE_PACKAGED_PREVIEW_EVIDENCE ?? null },
  strictProvenanceGate: { passed: strictGate.status === 0, report: strictReport }
};

const outputPath = resolve(output);
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(record, null, 2)}\n`);
console.log(`Wrote release evidence to ${outputPath}`);
