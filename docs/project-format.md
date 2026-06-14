# Project Format

A project is a normal Git-friendly directory. The sample lives at
`apps/sample-game/project`.

```text
adventure.project.json
scenes/<id>.scene.json
flows/<id>.flow.json
locales/<locale>.json
```

Every document contains `schemaVersion: 1` and a stable kebab-case ID.
The manifest references other documents by ID and relative path.

The CLI validates schemas and verifies that referenced IDs match the loaded
documents:

```powershell
pnpm validate:sample
```

Current schemas are TypeBox definitions compiled with Ajv. TypeScript types are
derived from the same definitions, preventing the runtime and validators from
drifting apart.

Future migrations must:

- preserve stable IDs;
- run atomically;
- write a backup before mutation;
- support dry-run validation;
- keep caches and generated build output outside canonical project state.

