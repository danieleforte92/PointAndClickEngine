# Contributing

## Setup

```powershell
corepack enable
pnpm install --frozen-lockfile
pnpm check
```

Project edits create committed, reviewable records under `.pointclick/changes/`.
Keep those records with the JSON documents they describe; do not edit a history
record to conceal or rewrite an authoring change. Use `pointclick history init`
for an existing project and `pointclick diff` to compare two project directories.

Use Node.js 22.17.0 and pnpm 9.6.0. The pinned `packageManager` field is the
source of truth; use a frozen install for contributor, CI, and release work.

## Project Shape

- `apps/starter-game/project` must stay minimal and free of local generated
  assets.
- `apps/sample-game/project` is the public Creator Alpha demo and should only
  contain intentional, validating content.
- Exported ComfyUI workflows, logs, local screenshots, and experimental assets
  should stay untracked unless they are deliberately promoted into docs or the
  sample.

## Development Rules

- Keep project state in Git-friendly JSON documents.
- Keep simulation state renderer-independent.
- Add schema and semantic validation when introducing new document references.
- Prefer focused tests near the package that owns the behavior.
- Keep Creator Alpha useful without paid provider keys.
- Mock external AI calls in tests.
- Keep LM Studio and ComfyUI provider docs explicit about localhost, credentials,
  provenance, and failure behavior.

## Release Gate

Before opening a PR, run:

```powershell
pnpm check
```

This runs unit tests, typecheck, sample validation, starter validation, and
builds all packages that expose a build script, plus release hygiene and
development-mode provenance coverage. It does not assert that assets are cleared
for redistribution.

Before proposing a public release, also run:

```powershell
pnpm audit --audit-level high
pnpm test:e2e
pnpm check:release:candidate
pnpm validate:provenance:strict
```

The strict gate is expected to fail while the inventory marks assets or
third-party notices as `review-required`. Do not change those entries to pass a
gate without recorded source and redistribution evidence.

`pnpm check:release:candidate` is for a committed release checkout. It rejects
untracked required controls, dirty source files, version drift, and packages
that could be accidentally published.

Use [docs/release-checklist.md](docs/release-checklist.md) before tagging a
public Creator Alpha release.
