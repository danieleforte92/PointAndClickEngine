import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertWindowsSigningPolicy,
  printWindowsSigningStatus,
  resolveWindowsSigningConfig
} from "./signing.mjs";

const DEFAULT_REQUIRED_ENTRIES = [
  "pointclick-studio.exe",
  "resources/app.asar",
  "resources/dist/index.html"
];
const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;
const ZIP_MAX_COMMENT_LENGTH = 0xffff;

function assertRegularFile(filePath, label) {
  if (!existsSync(filePath)) throw new Error(`${label} was not found: ${filePath}`);
  const metadata = lstatSync(filePath);
  if (!metadata.isFile()) throw new Error(`${label} must be a regular file: ${filePath}`);
}

function assertDirectory(directory, label) {
  if (!existsSync(directory)) throw new Error(`${label} was not found: ${directory}`);
  const metadata = lstatSync(directory);
  if (!metadata.isDirectory()) throw new Error(`${label} must be a directory: ${directory}`);
  if (metadata.isSymbolicLink()) throw new Error(`${label} must not be a symbolic link: ${directory}`);
}

function normalizeArchiveName(name) {
  const normalized = name.replaceAll("\\", "/");
  if (
    normalized.includes("\0") ||
    normalized.startsWith("/") ||
    /^[A-Za-z]:\//.test(normalized) ||
    normalized.split("/").some((part) => part === "..")
  ) {
    throw new Error(`Unsafe ZIP entry path: ${name}`);
  }
  return normalized;
}

function walkDirectory(directory, entries = []) {
  const metadata = lstatSync(directory);
  if (metadata.isSymbolicLink()) throw new Error(`Package contains a symbolic-link directory: ${directory}`);
  if (!metadata.isDirectory()) return entries;

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = resolve(directory, entry.name);
    const entryMetadata = lstatSync(fullPath);
    if (entryMetadata.isSymbolicLink()) {
      throw new Error(`Package contains a symbolic-link entry: ${fullPath}`);
    }
    if (entryMetadata.isDirectory()) walkDirectory(fullPath, entries);
    else if (entryMetadata.isFile()) entries.push(fullPath);
    else throw new Error(`Package contains an unsupported filesystem entry: ${fullPath}`);
  }
  return entries;
}

function requiredEntryPath(directory, entry) {
  const normalized = entry.replaceAll("\\", "/");
  const destination = resolve(directory, ...normalized.split("/"));
  const relativeDestination = relative(resolve(directory), destination);
  if (relativeDestination.startsWith(`..${sep}`) || relativeDestination === "..") {
    throw new Error(`Required package entry escapes the package directory: ${entry}`);
  }
  return destination;
}

export function verifyPortablePackage(directory, options = {}) {
  const packageDirectory = resolve(directory);
  const requiredEntries = options.requiredEntries ?? DEFAULT_REQUIRED_ENTRIES;
  assertDirectory(packageDirectory, "Portable Windows package");
  const files = walkDirectory(packageDirectory);
  if (files.length === 0) throw new Error(`Portable Windows package is empty: ${packageDirectory}`);

  const missing = [];
  for (const entry of requiredEntries) {
    const entryPath = requiredEntryPath(packageDirectory, entry);
    if (!existsSync(entryPath) || !lstatSync(entryPath).isFile()) missing.push(entry);
  }
  if (missing.length > 0) {
    throw new Error(`Portable Windows package is missing expected content: ${missing.join(", ")}`);
  }

  return {
    directory: packageDirectory,
    files: files.length,
    requiredEntries: [...requiredEntries]
  };
}

function findEndOfCentralDirectory(buffer) {
  const start = Math.max(0, buffer.length - (22 + ZIP_MAX_COMMENT_LENGTH));
  for (let offset = buffer.length - 22; offset >= start; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) return offset;
  }
  throw new Error("ZIP end-of-central-directory record was not found.");
}

function readZipEntries(zipPath) {
  const buffer = readFileSync(zipPath);
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const diskNumber = buffer.readUInt16LE(eocdOffset + 4);
  const centralDirectoryDisk = buffer.readUInt16LE(eocdOffset + 6);
  const entriesOnDisk = buffer.readUInt16LE(eocdOffset + 8);
  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);

  if (diskNumber !== 0 || centralDirectoryDisk !== 0 || entriesOnDisk !== totalEntries) {
    throw new Error("Multi-disk ZIP archives are not supported for release packages.");
  }
  if (
    totalEntries === 0xffff ||
    centralDirectorySize === 0xffffffff ||
    centralDirectoryOffset === 0xffffffff
  ) {
    throw new Error("ZIP64 archives are not supported for release packages.");
  }
  if (centralDirectoryOffset + centralDirectorySize > buffer.length) {
    throw new Error("ZIP central directory exceeds the archive bounds.");
  }

  const entries = [];
  const seenNames = new Set();
  let offset = centralDirectoryOffset;
  for (let index = 0; index < totalEntries; index += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error(`Invalid ZIP central-directory entry at offset ${offset}.`);
    }

    const madeBy = buffer.readUInt16LE(offset + 4);
    const flags = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const externalAttributes = buffer.readUInt32LE(offset + 38);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const recordLength = 46 + nameLength + extraLength + commentLength;
    if (offset + recordLength > buffer.length) throw new Error("ZIP central-directory entry exceeds the archive bounds.");

    const rawName = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    const name = normalizeArchiveName(rawName);
    if (seenNames.has(name)) throw new Error(`ZIP contains duplicate entry: ${name}`);
    seenNames.add(name);
    if (localHeaderOffset + 4 > buffer.length || buffer.readUInt32LE(localHeaderOffset) !== LOCAL_FILE_SIGNATURE) {
      throw new Error(`ZIP local header is invalid for entry: ${name}`);
    }

    const unixMode = (externalAttributes >>> 16) & 0xffff;
    const isUnixSymlink = (madeBy >>> 8) === 3 && (unixMode & 0xf000) === 0xa000;
    entries.push({
      name,
      isDirectory: name.endsWith("/"),
      isSymlink: isUnixSymlink,
      compressedSize,
      uncompressedSize,
      flags
    });
    offset += recordLength;
  }

  return entries;
}

function matchingArchiveEntries(entries, requiredEntry) {
  const normalized = requiredEntry.replaceAll("\\", "/");
  return entries.filter((entry) => entry.name === normalized || entry.name.endsWith(`/${normalized}`));
}

export function verifyPortableZip(zipPath, options = {}) {
  const archivePath = resolve(zipPath);
  const requiredEntries = options.requiredEntries ?? DEFAULT_REQUIRED_ENTRIES;
  assertRegularFile(archivePath, "Portable Windows ZIP");
  const entries = readZipEntries(archivePath);
  if (entries.length === 0) throw new Error(`Portable Windows ZIP is empty: ${archivePath}`);

  const symlinkEntries = entries.filter((entry) => entry.isSymlink);
  if (symlinkEntries.length > 0) {
    throw new Error(`Portable Windows ZIP contains symbolic-link entries: ${symlinkEntries.map((entry) => entry.name).join(", ")}`);
  }

  const missing = [];
  const duplicateMatches = [];
  for (const entry of requiredEntries) {
    const matches = matchingArchiveEntries(entries, entry);
    if (matches.length === 0) missing.push(entry);
    if (matches.length > 1) duplicateMatches.push(`${entry} (${matches.map((match) => match.name).join(", ")})`);
  }
  if (missing.length > 0) throw new Error(`Portable Windows ZIP is missing expected content: ${missing.join(", ")}`);
  if (duplicateMatches.length > 0) throw new Error(`Portable Windows ZIP contains ambiguous content: ${duplicateMatches.join(", ")}`);

  return {
    archive: archivePath,
    entries: entries.length,
    requiredEntries: [...requiredEntries]
  };
}

function sha1File(filePath) {
  return createHash("sha1").update(readFileSync(filePath)).digest("hex");
}

export function verifySquirrelArtifacts(directory) {
  const squirrelDirectory = resolve(directory);
  assertDirectory(squirrelDirectory, "Squirrel output directory");
  const releaseFile = resolve(squirrelDirectory, "RELEASES");
  assertRegularFile(releaseFile, "Squirrel RELEASES manifest");

  const files = readdirSync(squirrelDirectory, { withFileTypes: true });
  const setupFiles = files
    .filter((entry) => entry.isFile() && / setup\.exe$/i.test(entry.name))
    .map((entry) => entry.name);
  const fullPackages = files
    .filter((entry) => entry.isFile() && /-full\.nupkg$/i.test(entry.name))
    .map((entry) => entry.name);
  if (setupFiles.length === 0) throw new Error(`Squirrel output is missing a Setup.exe installer: ${squirrelDirectory}`);
  if (fullPackages.length === 0) throw new Error(`Squirrel output is missing a full .nupkg package: ${squirrelDirectory}`);

  const releaseLines = readFileSync(releaseFile, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (releaseLines.length === 0) throw new Error(`Squirrel RELEASES manifest is empty: ${releaseFile}`);

  const referencedFiles = [];
  for (const line of releaseLines) {
    const [digest, fileName, sizeText, ...extra] = line.split(/\s+/);
    if (extra.length > 0 || !/^[a-f0-9]{40}$/i.test(digest ?? "") || !fileName || !/^\d+$/.test(sizeText ?? "")) {
      throw new Error(`Invalid Squirrel RELEASES line: ${line}`);
    }
    const normalizedFileName = normalizeArchiveName(fileName);
    if (normalizedFileName.includes("/")) throw new Error(`Squirrel RELEASES entry must be a file name: ${fileName}`);
    const referencedPath = resolve(squirrelDirectory, normalizedFileName);
    const relativePath = relative(squirrelDirectory, referencedPath);
    if (relativePath.startsWith(`..${sep}`) || relativePath === "..") {
      throw new Error(`Squirrel RELEASES entry escapes its output directory: ${fileName}`);
    }
    assertRegularFile(referencedPath, "Squirrel RELEASES artifact");
    const metadata = statSync(referencedPath);
    const actualDigest = sha1File(referencedPath);
    if (actualDigest.toLowerCase() !== digest.toLowerCase()) {
      throw new Error(`Squirrel RELEASES checksum mismatch for ${fileName}.`);
    }
    if (metadata.size !== Number(sizeText)) {
      throw new Error(`Squirrel RELEASES size mismatch for ${fileName}.`);
    }
    referencedFiles.push(referencedPath);
  }

  return {
    directory: squirrelDirectory,
    releaseFile,
    setupFiles,
    fullPackages,
    referencedFiles
  };
}

async function sha256File(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

function relativeManifestPath(baseDirectory, filePath) {
  const path = relative(baseDirectory, filePath).replaceAll("\\", "/");
  return path === "" ? "." : path;
}

export async function createSha256Manifest(filePaths, outputPath, options = {}) {
  const output = resolve(outputPath);
  const baseDirectory = resolve(options.baseDirectory ?? process.cwd());
  const uniqueFiles = [...new Set(filePaths.map((filePath) => resolve(filePath)))].sort();
  if (uniqueFiles.length === 0) throw new Error("Cannot create a checksum manifest without artifacts.");
  if (uniqueFiles.includes(output)) throw new Error("Checksum output cannot also be a checksum input.");

  const entries = [];
  for (const filePath of uniqueFiles) {
    assertRegularFile(filePath, "Checksum input");
    entries.push({
      filePath,
      name: relativeManifestPath(baseDirectory, filePath),
      digest: await sha256File(filePath)
    });
  }
  entries.sort((left, right) => left.name.localeCompare(right.name));
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${entries.map((entry) => `${entry.digest}  ${entry.name}`).join("\n")}\n`);
  return { output, entries };
}

function optionValues(argumentsList, name) {
  const values = [];
  for (let index = 0; index < argumentsList.length; index += 1) {
    if (argumentsList[index] === name) {
      const value = argumentsList[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${name} requires a value.`);
      values.push(value);
      index += 1;
    }
  }
  return values;
}

export async function verifyWindowsRelease({
  portablePackageDirectory,
  portableZipPath,
  squirrelDirectory,
  artifactPaths = [],
  checksumsPath,
  signingStatus,
  emitSigningWarning = false
}) {
  const result = {};
  if (portablePackageDirectory) result.portablePackage = verifyPortablePackage(portablePackageDirectory);
  if (portableZipPath) result.portableZip = verifyPortableZip(portableZipPath);
  if (squirrelDirectory) result.squirrel = verifySquirrelArtifacts(squirrelDirectory);

  const artifacts = [
    ...artifactPaths,
    ...(portableZipPath ? [portableZipPath] : []),
    ...(result.squirrel
      ? [result.squirrel.releaseFile, ...result.squirrel.setupFiles.map((file) => resolve(result.squirrel.directory, file)), ...result.squirrel.fullPackages.map((file) => resolve(result.squirrel.directory, file))]
      : [])
  ];
  if (checksumsPath) result.checksums = await createSha256Manifest(artifacts, checksumsPath);

  if (signingStatus) {
    assertWindowsSigningPolicy(signingStatus);
    if (emitSigningWarning || signingStatus.unsigned) printWindowsSigningStatus(signingStatus);
  }
  return result;
}

async function main() {
  const argumentsList = process.argv.slice(2);
  const packageDirectories = optionValues(argumentsList, "--package");
  const zipPaths = optionValues(argumentsList, "--zip");
  const squirrelDirectories = optionValues(argumentsList, "--squirrel");
  const checksumsPaths = optionValues(argumentsList, "--checksums");
  const artifacts = optionValues(argumentsList, "--artifact");
  if (packageDirectories.length > 1 || zipPaths.length > 1 || squirrelDirectories.length > 1 || checksumsPaths.length > 1) {
    throw new Error("Each package, ZIP, Squirrel, and checksum option may be supplied only once.");
  }
  if (packageDirectories.length === 0 && zipPaths.length === 0 && squirrelDirectories.length === 0) {
    throw new Error("Usage: node scripts/package-verification.mjs --package <dir> --zip <file> --squirrel <dir> [--artifact <file>] [--checksums <file>]");
  }

  const signingStatus = resolveWindowsSigningConfig();
  const result = await verifyWindowsRelease({
    portablePackageDirectory: packageDirectories[0],
    portableZipPath: zipPaths[0],
    squirrelDirectory: squirrelDirectories[0],
    artifactPaths: artifacts,
    checksumsPath: checksumsPaths[0],
    signingStatus,
    emitSigningWarning: true
  });
  console.log(
    `Windows distribution verification passed${checksumsPaths[0] ? `; checksums written to ${resolve(checksumsPaths[0])}` : ""}.`
  );
  if (process.argv.includes("--json")) console.log(JSON.stringify(result, null, 2));
}

function isMainModule() {
  if (!process.argv[1]) return false;
  return fileURLToPath(import.meta.url) === resolve(process.argv[1]);
}

if (isMainModule()) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
