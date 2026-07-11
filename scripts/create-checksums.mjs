import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { relative, resolve, join, relative as relativePath } from "node:path";

const source = resolve(process.argv[2] ?? "apps/editor/out");
const output = resolve(process.argv[3] ?? "release-artifacts/SHA256SUMS.txt");

if (!statSync(source).isDirectory()) throw new Error(`Package source is not a directory: ${source}`);
const outputRelativeToSource = relativePath(source, output);
if (outputRelativeToSource === "" || (!outputRelativeToSource.startsWith("..") && !outputRelativeToSource.includes(":"))) {
  throw new Error("Checksum output must be outside the package source directory.");
}

function filesUnder(directory) {
  if (lstatSync(directory).isSymbolicLink()) {
    throw new Error(`Refusing to hash symbolic-link directory ${directory}`);
  }

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Refusing to hash symbolic-link package entry ${fullPath}`);
    }
    return entry.isDirectory() ? filesUnder(fullPath) : [fullPath];
  });
}

const files = filesUnder(source).filter((file) => statSync(file).isFile()).sort();
if (files.length === 0) throw new Error(`No package files found under ${source}`);
const lines = files.map((file) => {
  const digest = createHash("sha256").update(readFileSync(file)).digest("hex");
  return `${digest}  ${relative(source, file).replace(/\\/g, "/")}`;
});
mkdirSync(resolve(output, ".."), { recursive: true });
writeFileSync(output, `${lines.join("\n")}\n`);
console.log(`Wrote ${lines.length} SHA-256 checksums to ${output}`);
