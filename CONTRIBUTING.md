# Contributing

## Setup

```powershell
pnpm install --frozen-lockfile
pnpm check
```

Use Node.js 22.17 or newer and pnpm 9.6.

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
builds all packages that expose a build script.

Use [docs/release-checklist.md](docs/release-checklist.md) before tagging a
public Creator Alpha release.
