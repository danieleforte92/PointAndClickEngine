import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { afterEach, test } from "node:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  createSha256Manifest,
  verifyPortablePackage,
  verifyPortableZip,
  verifySquirrelArtifacts
} from "./package-verification.mjs";
import {
  UNSIGNED_BETA_WARNING,
  assertWindowsSigningPolicy,
  printWindowsSigningStatus,
  resolveWindowsSigningConfig
} from "./signing.mjs";

const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function temporaryDirectory() {
  const directory = mkdtempSync(join(tmpdir(), "pointclick-package-verification-"));
  temporaryDirectories.push(directory);
  return directory;
}

function writeFixture(root, file, content = "fixture") {
  const destination = join(root, file);
  mkdirSync(join(destination, ".."), { recursive: true });
  writeFileSync(destination, content);
  return destination;
}

function createStoredZip(destination, names) {
  const localRecords = [];
  const centralRecords = [];
  let offset = 0;
  for (const name of names) {
    const nameBuffer = Buffer.from(name, "utf8");
    const local = Buffer.alloc(30 + nameBuffer.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(0, 18);
    local.writeUInt32LE(0, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);
    nameBuffer.copy(local, 30);

    const central = Buffer.alloc(46 + nameBuffer.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(0, 20);
    central.writeUInt32LE(0, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    nameBuffer.copy(central, 46);

    localRecords.push(local);
    centralRecords.push(central);
    offset += local.length;
  }

  const centralDirectory = Buffer.concat(centralRecords);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(names.length, 8);
  end.writeUInt16LE(names.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  writeFileSync(destination, Buffer.concat([...localRecords, centralDirectory, end]));
}

test("portable package verification requires the executable, ASAR, and preview", () => {
  const root = temporaryDirectory();
  const packageDirectory = join(root, "PointClickStudio-win32-x64");
  writeFixture(packageDirectory, "pointclick-studio.exe");
  writeFixture(packageDirectory, "resources/app.asar");
  writeFixture(packageDirectory, "resources/dist/index.html", "<html></html>");

  const result = verifyPortablePackage(packageDirectory);
  assert.equal(result.files, 3);
  rmSync(join(packageDirectory, "resources/dist/index.html"));
  assert.throws(() => verifyPortablePackage(packageDirectory), /missing expected content/);
});

test("portable ZIP verification rejects traversal and requires all release entries", () => {
  const root = temporaryDirectory();
  const zipPath = join(root, "PointClickStudio-win32-x64.zip");
  createStoredZip(zipPath, [
    "PointClickStudio-win32-x64/pointclick-studio.exe",
    "PointClickStudio-win32-x64/resources/app.asar",
    "PointClickStudio-win32-x64/resources/dist/index.html"
  ]);
  assert.equal(verifyPortableZip(zipPath).entries, 3);

  const unsafeZip = join(root, "unsafe.zip");
  createStoredZip(unsafeZip, ["../pointclick-studio.exe"]);
  assert.throws(() => verifyPortableZip(unsafeZip), /Unsafe ZIP entry path/);
});

test("Squirrel verification validates RELEASES SHA-1 and package size", () => {
  const root = temporaryDirectory();
  const squirrelDirectory = join(root, "squirrel.windows", "x64");
  const fullPackage = writeFixture(squirrelDirectory, "pointclick_editor-1.0.0-full.nupkg", "nupkg fixture");
  writeFixture(squirrelDirectory, "PointClickStudio-1.0.0 Setup.exe", "installer fixture");
  const content = readFileSync(fullPackage);
  const digest = createHash("sha1").update(content).digest("hex");
  writeFixture(
    squirrelDirectory,
    "RELEASES",
    `${digest}  pointclick_editor-1.0.0-full.nupkg ${content.length}\n`
  );

  const result = verifySquirrelArtifacts(squirrelDirectory);
  assert.deepEqual(result.fullPackages, ["pointclick_editor-1.0.0-full.nupkg"]);
  writeFileSync(join(squirrelDirectory, "RELEASES"), `${digest}  pointclick_editor-1.0.0-full.nupkg 999\n`);
  assert.throws(() => verifySquirrelArtifacts(squirrelDirectory), /size mismatch/);
});

test("SHA-256 manifests are deterministic and include release artifact paths", async () => {
  const root = temporaryDirectory();
  const first = writeFixture(root, "release/PointClickStudio.zip", "zip fixture");
  const second = writeFixture(root, "release/PointClickStudioSetup.exe", "installer fixture");
  const output = join(root, "checksums", "SHA256SUMS.txt");
  const result = await createSha256Manifest([second, first], output, { baseDirectory: root });
  const manifest = readFileSync(output, "utf8");
  assert.equal(result.entries.length, 2);
  assert.match(manifest, /release\/PointClickStudio\.zip/);
  assert.match(manifest, /release\/PointClickStudioSetup\.exe/);
  assert.equal(manifest.split(/\r?\n/).filter(Boolean).length, 2);
});

test("Windows signing is enabled only for a valid certificate or explicit signer", () => {
  const root = temporaryDirectory();
  const certificate = writeFixture(root, "signing/certificate.pfx", "certificate fixture");
  const configured = resolveWindowsSigningConfig(
    {
      POINTCLICK_WINDOWS_CERTIFICATE_FILE: certificate,
      POINTCLICK_WINDOWS_CERTIFICATE_PASSWORD: "test-password"
    },
    root
  );
  assert.equal(configured.configured, true);
  assert.equal(configured.windowsSign.certificateFile, certificate);

  const unsigned = resolveWindowsSigningConfig({}, root);
  assert.equal(unsigned.configured, false);
  const warnings = [];
  printWindowsSigningStatus(unsigned, { log() {}, warn(message) { warnings.push(message); } });
  assert.match(warnings[0], /unsigned/i);
  assert.match(UNSIGNED_BETA_WARNING, /checksums/);

  const stable = resolveWindowsSigningConfig({ POINTCLICK_RELEASE_CHANNEL: "stable" }, root);
  assert.throws(() => assertWindowsSigningPolicy(stable), /signing is required/);
});
