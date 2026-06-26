import { execFileSync } from "node:child_process";

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

console.log("Release check passed.");
