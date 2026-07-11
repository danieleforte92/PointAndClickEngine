import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const strict = process.argv.includes("--strict");
const json = process.argv.includes("--format=json");
const inventoryPath = resolve("provenance/inventory.json");

function globToRegExp(glob) {
  let expression = "^";
  for (let index = 0; index < glob.length; index += 1) {
    const character = glob[index];
    if (character === "*") {
      if (glob[index + 1] === "*") {
        index += 1;
        if (glob[index + 1] === "/") {
          index += 1;
          expression += "(?:.*/)?";
        } else {
          expression += ".*";
        }
      } else {
        expression += "[^/]*";
      }
    } else if ("\\^$+?.()|{}[]".includes(character)) {
      expression += `\\${character}`;
    } else {
      expression += character;
    }
  }
  return new RegExp(`${expression}$`);
}

function report(result) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  for (const error of result.errors) console.error(`Error: ${error}`);
  console.log(`Provenance inventory: ${result.coveredFiles}/${result.candidateFiles} tracked release inputs covered.`);
  if (result.unresolvedEntries.length > 0) {
    console.log(`Review required: ${result.unresolvedEntries.join(", ")}.`);
  }
  if (strict && result.unresolvedEntries.length > 0) {
    console.error("Strict release provenance gate is blocked. See provenance/inventory.json and THIRD_PARTY_NOTICES.md.");
  } else if (result.errors.length === 0) {
    console.log(strict ? "Strict release provenance gate passed." : "Development provenance validation passed.");
  }
}

let inventory;
const errors = [];
try {
  inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));
} catch (error) {
  errors.push(`Cannot read ${inventoryPath}: ${error.message}`);
  inventory = { entries: [] };
}

if (inventory.schemaVersion !== 1 || !Array.isArray(inventory.entries)) {
  errors.push("Inventory must declare schemaVersion 1 and an entries array.");
}

const validStatuses = new Set(["approved", "review-required", "not-applicable"]);
const entries = Array.isArray(inventory.entries) ? inventory.entries : [];
const seenIds = new Set();
for (const entry of entries) {
  if (!entry.id || seenIds.has(entry.id)) errors.push("Each inventory entry needs a unique id.");
  seenIds.add(entry.id);
  if (!entry.kind || !Array.isArray(entry.paths) || entry.paths.length === 0) {
    errors.push(`Entry ${entry.id ?? "<unknown>"} needs a kind and at least one path.`);
  }
  if (!validStatuses.has(entry.status)) errors.push(`Entry ${entry.id ?? "<unknown>"} has an invalid status.`);
  if (!("license" in entry) || !entry.evidence || !entry.releaseAction) {
    errors.push(`Entry ${entry.id ?? "<unknown>"} needs license, evidence, and releaseAction fields.`);
  }
}

const trackedFiles = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split(/\r?\n/)
  .filter(Boolean)
  .map((file) => file.replace(/\\/g, "/"));
// A GitHub source archive contains every tracked path. The Windows package is a
// second distribution surface, but it does not make tracked screenshots,
// planning documents, sample assets, or workflow exports disappear from the
// source distribution. Keep the inventory exhaustive rather than inferring a
// smaller release surface from directory names.
const candidates = trackedFiles;
const compiledEntries = entries.map((entry) => ({ ...entry, matchers: (entry.paths ?? []).map(globToRegExp) }));
const uncovered = candidates.filter((file) => !compiledEntries.some((entry) => entry.matchers.some((matcher) => matcher.test(file))));
if (uncovered.length > 0) errors.push(`Uncovered release inputs: ${uncovered.join(", ")}`);

const unmatchedEntries = compiledEntries
  .filter((entry) => !candidates.some((file) => entry.matchers.some((matcher) => matcher.test(file))))
  .map((entry) => entry.id ?? "<unknown>");
if (unmatchedEntries.length > 0) errors.push(`Inventory entries match no tracked release inputs: ${unmatchedEntries.join(", ")}`);

const unresolvedEntries = entries
  .filter((entry) => entry.status === "review-required" && candidates.some((file) => (entry.paths ?? []).map(globToRegExp).some((matcher) => matcher.test(file))))
  .map((entry) => entry.id);
const result = {
  schemaVersion: 1,
  mode: strict ? "strict-release" : "development",
  candidateFiles: candidates.length,
  coveredFiles: candidates.length - uncovered.length,
  unresolvedEntries,
  errors
};

report(result);
if (errors.length > 0 || (strict && unresolvedEntries.length > 0)) process.exit(1);
