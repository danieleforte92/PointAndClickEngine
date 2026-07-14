# How to prepare a Creator Alpha release

This guide prepares a reproducible Windows release candidate from a clean
checkout. It assumes Node.js 22.17.0, pnpm 9.6.0, and a maintainer account with
permission to publish a GitHub prerelease.

## 1. Align the candidate

Update the root version and every workspace package version to the same
semantic prerelease. Keep the tag immutable once it is published. Update the
matching changelog, release notes, checklist, and README links.

## 2. Run the local gates

```powershell
corepack enable
pnpm install --frozen-lockfile
pnpm check
pnpm audit --audit-level high
pnpm test:e2e
pnpm validate:provenance:strict
```

The editor budget, theme contract, documentation contract, sample/starter
validation, and package build are included in `pnpm check`.

## 3. Verify the Windows package

```powershell
pnpm verify:windows-package
pnpm --filter @pointclick/editor make
pnpm test:e2e:packaged
```

Confirm the portable directory contains the embedded player preview and that
the smoke test can create a temporary project, save a change, open preview, and
close cleanly. GPU stall messages may appear in headless environments; the
packaged smoke result remains the acceptance signal.

## 4. Record and publish evidence

Generate checksums and release evidence only after the candidate has passed the
manual smoke checklist. Upload the portable ZIP, installer, `RELEASES`, full
`.nupkg`, checksums, and evidence JSON to the matching GitHub prerelease.

Unsigned alpha and beta packages must say so explicitly. Do not mark signing,
strict provenance, or manual smoke as passed without recorded evidence.
