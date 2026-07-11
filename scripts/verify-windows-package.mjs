import { existsSync, lstatSync } from "node:fs";
import { join, resolve } from "node:path";

const packageDirectory = resolve(process.argv[2] ?? "apps/editor/out/PointClickStudio-win32-x64");
const requiredEntries = [
  "pointclick-studio.exe",
  "resources/app.asar",
  "resources/dist/index.html"
];

if (!existsSync(packageDirectory)) {
  console.error(`Windows package was not found: ${packageDirectory}`);
  process.exit(1);
}

if (lstatSync(packageDirectory).isSymbolicLink()) {
  console.error(`Windows package directory must not be a symbolic link: ${packageDirectory}`);
  process.exit(1);
}

const missing = requiredEntries.filter((entry) => !existsSync(join(packageDirectory, entry)));
if (missing.length > 0) {
  console.error(`Windows package is missing expected content: ${missing.join(", ")}`);
  process.exit(1);
}

const symbolicLinks = requiredEntries.filter((entry) => lstatSync(join(packageDirectory, entry)).isSymbolicLink());
if (symbolicLinks.length > 0) {
  console.error(`Windows package contains symbolic-link release inputs: ${symbolicLinks.join(", ")}`);
  process.exit(1);
}

console.log(`Windows package smoke check passed: ${packageDirectory}`);
