import assert from 'node:assert/strict';
import test from 'node:test';

import { collectRegistryPackages, findAuditFindings, severityRank } from './audit-dependencies.mjs';

test('collectRegistryPackages includes registry nodes and skips workspace links', () => {
  const tree = [
    {
      name: 'workspace-root',
      version: '1.0.0',
      path: 'C:\\repo',
      dependencies: {
        alpha: {
          from: 'alpha',
          version: '1.2.0',
          resolved: 'https://registry.npmjs.org/alpha/-/alpha-1.2.0.tgz',
          path: 'C:\\repo\\node_modules\\.pnpm\\alpha@1.2.0\\node_modules\\alpha',
          dependencies: {
            beta: {
              from: 'beta',
              version: '2.0.0',
              path: 'C:\\repo\\node_modules\\.pnpm\\beta@2.0.0\\node_modules\\beta',
            },
          },
        },
        local: {
          from: '@pointclick/local',
          version: '0.4.0',
          path: 'C:\\repo\\packages\\local',
        },
      },
    },
  ];

  assert.deepEqual(collectRegistryPackages(tree), {
    alpha: ['1.2.0'],
    beta: ['2.0.0'],
  });
});

test('findAuditFindings applies the threshold and sorts by severity', () => {
  const findings = findAuditFindings(
    {
      alpha: [{ severity: 'high', title: 'High issue' }],
      beta: [{ severity: 'critical', title: 'Critical issue' }],
      gamma: [{ severity: 'moderate', title: 'Below threshold' }],
    },
    { alpha: ['1.0.0'], beta: ['2.0.0'], gamma: ['3.0.0'] },
    'high',
  );

  assert.deepEqual(findings.map(({ packageName, severity }) => [packageName, severity]), [
    ['beta', 'critical'],
    ['alpha', 'high'],
  ]);
  assert.equal(severityRank('critical') > severityRank('high'), true);
});
