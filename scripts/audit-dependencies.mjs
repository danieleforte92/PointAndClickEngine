import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

const execFile = promisify(execFileCallback);
const DEFAULT_REGISTRY = 'https://registry.npmjs.org';
const MAX_BUFFER = 128 * 1024 * 1024;
const SEVERITY_RANK = Object.freeze({ info: 0, low: 1, moderate: 2, high: 3, critical: 4 });

export function severityRank(severity) {
  return SEVERITY_RANK[String(severity).toLowerCase()] ?? -1;
}

function isRegistryPackage(node) {
  if (!node || typeof node !== 'object' || typeof node.version !== 'string') return false;
  const resolved = typeof node.resolved === 'string' ? node.resolved : '';
  const path = typeof node.path === 'string' ? node.path : '';
  return resolved.startsWith(DEFAULT_REGISTRY) || /[\\/]node_modules[\\/]/i.test(path);
}

function packageName(node) {
  const name = typeof node.name === 'string' ? node.name : node.from;
  if (typeof name !== 'string' || name.length === 0) return undefined;
  if (name.startsWith('workspace:') || name.startsWith('file:')) return undefined;
  return name;
}

export function collectRegistryPackages(tree) {
  const packages = new Map();
  const visited = new Set();

  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (visited.has(value)) return;
    visited.add(value);

    if (!Array.isArray(value) && isRegistryPackage(value)) {
      const name = packageName(value);
      if (name) {
        const versions = packages.get(name) ?? new Set();
        versions.add(value.version);
        packages.set(name, versions);
      }
    }

    for (const child of Object.values(value)) visit(child);
  }

  visit(tree);
  return Object.fromEntries(
    [...packages.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, versions]) => [name, [...versions].sort()]),
  );
}

export function findAuditFindings(advisoryResponse, packages, minimumLevel = 'high') {
  const minimumRank = severityRank(minimumLevel);
  return Object.entries(advisoryResponse ?? {})
    .flatMap(([name, advisories]) =>
      Array.isArray(advisories)
        ? advisories.map((advisory) => ({
            ...advisory,
            packageName: name,
            installedVersions: packages[name] ?? [],
          }))
        : [],
    )
    .filter((advisory) => severityRank(advisory.severity) >= minimumRank)
    .sort(
      (left, right) =>
        severityRank(right.severity) - severityRank(left.severity) ||
        left.packageName.localeCompare(right.packageName) ||
        String(left.title ?? '').localeCompare(String(right.title ?? '')),
    );
}

export async function readDependencyTree() {
  const { stdout } = await execFile('pnpm', ['list', '--recursive', '--json', '--depth', 'Infinity'], {
    maxBuffer: MAX_BUFFER,
    windowsHide: true,
  });
  return JSON.parse(stdout);
}

export async function queryBulkAdvisories(packages, registry = DEFAULT_REGISTRY) {
  const response = await fetch(`${registry.replace(/\/$/, '')}/-/npm/v1/security/advisories/bulk`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'user-agent': 'point-and-click-engine-dependency-audit',
    },
    body: JSON.stringify(packages),
  });

  if (!response.ok) {
    const detail = (await response.text()).trim();
    throw new Error(`npm bulk advisory endpoint returned ${response.status}${detail ? `: ${detail}` : ''}`);
  }

  return response.json();
}

function optionValue(args, option, fallback) {
  const index = args.indexOf(option);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

export async function runAudit({ auditLevel = 'high', registry = DEFAULT_REGISTRY } = {}) {
  if (severityRank(auditLevel) < 0) throw new Error(`Unknown audit level: ${auditLevel}`);

  const packages = collectRegistryPackages(await readDependencyTree());
  const packageCount = Object.keys(packages).length;
  const versionCount = Object.values(packages).reduce((total, versions) => total + versions.length, 0);
  process.stdout.write(`Auditing ${packageCount} packages (${versionCount} installed versions) via npm bulk advisories...\n`);

  const findings = findAuditFindings(await queryBulkAdvisories(packages, registry), packages, auditLevel);
  if (findings.length === 0) {
    process.stdout.write(`Dependency audit passed at ${auditLevel} severity.\n`);
    return findings;
  }

  process.stderr.write(`Dependency audit found ${findings.length} ${auditLevel}-or-higher advisories:\n`);
  for (const finding of findings) {
    const versions = finding.installedVersions.join(', ');
    const reference = finding.url ? ` (${finding.url})` : '';
    process.stderr.write(`- ${finding.packageName}@${versions}: ${finding.severity} — ${finding.title ?? 'advisory'}${reference}\n`);
  }
  return findings;
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined;
if (entrypoint === import.meta.url) {
  const auditLevel = optionValue(process.argv.slice(2), '--audit-level', 'high');
  const registry = optionValue(process.argv.slice(2), '--registry', process.env.NPM_CONFIG_REGISTRY || DEFAULT_REGISTRY);
  runAudit({ auditLevel, registry }).then((findings) => {
    if (findings.length > 0) process.exitCode = 1;
  }).catch((error) => {
    process.stderr.write(`Dependency audit failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
