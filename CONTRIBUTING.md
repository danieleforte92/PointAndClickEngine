# Contributing

## Setup

```powershell
pnpm install
pnpm check
```

Use Node.js 22.17 or newer and pnpm 9.6.

## Development Rules

- Keep project state in Git-friendly JSON documents.
- Keep simulation state renderer-independent.
- Add schema and semantic validation when introducing new document references.
- Prefer focused tests near the package that owns the behavior.
- Do not add real AI provider calls to Creator Alpha paths.

## Release Gate

Before opening a PR, run:

```powershell
pnpm check
```

This runs unit tests, typecheck, sample validation, starter validation, and
builds all packages that expose a build script.
