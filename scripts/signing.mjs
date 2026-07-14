import { existsSync, lstatSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CERTIFICATE_FILE_ENVIRONMENTS = [
  "POINTCLICK_WINDOWS_CERTIFICATE_FILE",
  "WINDOWS_CERTIFICATE_FILE"
];
const CERTIFICATE_PASSWORD_ENVIRONMENTS = [
  "POINTCLICK_WINDOWS_CERTIFICATE_PASSWORD",
  "WINDOWS_CERTIFICATE_PASSWORD"
];
const SIGN_TOOL_ENVIRONMENTS = [
  "POINTCLICK_WINDOWS_SIGNTOOL_PATH",
  "WINDOWS_SIGNTOOL_PATH"
];
const SIGN_PARAMS_ENVIRONMENTS = [
  "POINTCLICK_WINDOWS_SIGN_WITH_PARAMS",
  "WINDOWS_SIGN_WITH_PARAMS"
];
const TIMESTAMP_ENVIRONMENTS = [
  "POINTCLICK_WINDOWS_TIMESTAMP_SERVER",
  "WINDOWS_TIMESTAMP_SERVER"
];
const RELEASE_CHANNEL_ENVIRONMENTS = ["POINTCLICK_RELEASE_CHANNEL", "RELEASE_CHANNEL"];

export const UNSIGNED_BETA_WARNING =
  "WARNING: Windows artifacts are unsigned. Publish them only as an explicitly unsigned beta/alpha, together with SHA-256 checksums and this warning.";

function firstNonEmpty(environment, names) {
  for (const name of names) {
    const value = environment[name];
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return undefined;
}

function booleanEnvironmentValue(value) {
  return ["1", "true", "yes", "on"].includes(String(value ?? "").trim().toLowerCase());
}

function isStableChannel(environment) {
  const channel = firstNonEmpty(environment, RELEASE_CHANNEL_ENVIRONMENTS)?.toLowerCase();
  return channel === "stable" || channel === "release" || channel === "production";
}

function certificatePath(value, cwd) {
  return value ? resolve(cwd, value) : undefined;
}

function isRegularFile(filePath) {
  try {
    return lstatSync(filePath).isFile();
  } catch {
    return false;
  }
}

/**
 * Resolve signing options without exposing the certificate password in the
 * returned status object or in console output.
 *
 * The POINTCLICK_* names are project-specific aliases. The WINDOWS_* names
 * are also accepted because they are understood by @electron/windows-sign.
 */
export function resolveWindowsSigningConfig(environment = process.env, cwd = process.cwd()) {
  const configuredCertificate = firstNonEmpty(environment, CERTIFICATE_FILE_ENVIRONMENTS);
  const configuredPassword = firstNonEmpty(environment, CERTIFICATE_PASSWORD_ENVIRONMENTS);
  const configuredSignTool = firstNonEmpty(environment, SIGN_TOOL_ENVIRONMENTS);
  const configuredSignParams = firstNonEmpty(environment, SIGN_PARAMS_ENVIRONMENTS);
  const configuredTimestamp = firstNonEmpty(environment, TIMESTAMP_ENVIRONMENTS);
  const certificateFile = certificatePath(configuredCertificate, cwd);
  const hasCertificatePair = Boolean(certificateFile && configuredPassword);
  const certificateExists = Boolean(certificateFile && existsSync(certificateFile) && isRegularFile(certificateFile));
  const incompleteCertificate = Boolean(configuredCertificate) !== Boolean(configuredPassword);
  const customSignerConfigured = Boolean(configuredSignTool || configuredSignParams);
  const configured = Boolean((hasCertificatePair && certificateExists) || customSignerConfigured);
  const required =
    booleanEnvironmentValue(environment.POINTCLICK_REQUIRE_WINDOWS_SIGNING) || isStableChannel(environment);

  const reasons = [];
  if (incompleteCertificate) reasons.push("both certificate file and certificate password are required");
  if (hasCertificatePair && !certificateExists) reasons.push(`certificate file is missing or not regular: ${certificateFile}`);
  if (!configured && !incompleteCertificate && !hasCertificatePair && !customSignerConfigured) {
    reasons.push("no Windows certificate or custom signing parameters are configured");
  }

  const windowsSign = configured
    ? {
        ...(certificateFile && configuredPassword
          ? { certificateFile, certificatePassword: configuredPassword }
          : {}),
        ...(configuredSignTool ? { signToolPath: resolve(cwd, configuredSignTool) } : {}),
        ...(configuredSignParams ? { signWithParams: configuredSignParams } : {}),
        ...(configuredTimestamp ? { timestampServer: configuredTimestamp } : {}),
        description: "Point & Click Studio",
        website: "https://github.com/danieleforte92/PointAndClickEngine"
      }
    : undefined;

  return {
    configured,
    required,
    unsigned: !configured,
    certificateFile,
    certificatePresent: certificateExists,
    certificatePairPresent: hasCertificatePair,
    customSignerConfigured,
    reasons,
    windowsSign,
    channel: firstNonEmpty(environment, RELEASE_CHANNEL_ENVIRONMENTS) ?? "beta"
  };
}

export function assertWindowsSigningPolicy(status) {
  if (status.required && !status.configured) {
    throw new Error(
      `Windows signing is required for the ${status.channel} release. Configure POINTCLICK_WINDOWS_CERTIFICATE_FILE and POINTCLICK_WINDOWS_CERTIFICATE_PASSWORD (or an explicit signing tool) before packaging.`
    );
  }
  return status;
}

export function printWindowsSigningStatus(status, output = console) {
  if (status.configured) {
    const signer = status.certificateFile ? `certificate ${basename(status.certificateFile)}` : "custom signing tool";
    output.log(`Windows signing configured (${signer}).`);
    return;
  }

  output.warn(UNSIGNED_BETA_WARNING);
  for (const reason of status.reasons) output.warn(`Unsigned reason: ${reason}`);
}

function isMainModule() {
  if (!process.argv[1]) return false;
  return fileURLToPath(import.meta.url) === resolve(process.argv[1]);
}

if (isMainModule()) {
  const status = resolveWindowsSigningConfig();
  try {
    assertWindowsSigningPolicy(status);
    if (process.argv.includes("--json")) {
      console.log(
        JSON.stringify(
          {
            configured: status.configured,
            required: status.required,
            unsigned: status.unsigned,
            certificatePresent: status.certificatePresent,
            certificatePairPresent: status.certificatePairPresent,
            customSignerConfigured: status.customSignerConfigured,
            reasons: status.reasons,
            channel: status.channel
          },
          null,
          2
        )
      );
    } else {
      printWindowsSigningStatus(status);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
