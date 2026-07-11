# Third-Party and Asset Notices

The repository source and documentation authored for Point & Click Engine are
licensed under [Apache-2.0](LICENSE). That license does not establish rights for
sample artwork, starter-project material, screenshots, AI outputs, workflow
exports, model weights, or third-party packages.

## Resolved dependency review

The 2026-07-11 Creator Alpha candidate was reviewed from `pnpm-lock.yaml`. The
following direct dependencies and packaging tools expose their package license
metadata; their transitive closure is resolved by the same lockfile.

| Package | Version | License | Role |
| --- | --- | --- | --- |
| Electron | 39.8.10 | MIT | Windows runtime |
| React / React DOM | 19.2.7 | MIT | Editor and player UI |
| Vite / `@vitejs/plugin-react` | 6.4.3 / 4.7.0 | MIT | Bundling |
| PixiJS | 8.19.0 | MIT | 2D renderer |
| TypeBox / Ajv / Ajv Formats | 0.34.49 / 8.20.0 / 3.0.1 | MIT | Contracts and validation |
| Lucide React | 1.21.0 | ISC | Editor icons |
| Electron Forge / `@electron/rebuild` | 7.11.2 / 4.2.0 | MIT | Packaging and native rebuild |
| Concurrently / Lodash | 9.2.1 / 4.18.1 | MIT | Development tooling |
| `tmp` / `shell-quote` | 0.2.7 / 1.10.0 | MIT | Resolved packaging-tool transitive dependencies |

The project does not redistribute Electron/ComfyUI model weights, provider
secrets, generated experiments, or external workflow binaries. Package license
files remain available in the installed dependency tree and the source release
retains this notice together with the lockfile.

## Release procedure

`pnpm-lock.yaml` is the authoritative record of resolved JavaScript packages.
Before distributing a Windows package, a maintainer must review the production
dependency set in that lockfile, preserve any required license texts and
attributions with the package, and record the result in
`provenance/inventory.json`. Do not infer package or asset rights from a file
name, a provider name, or an AI-generation record.

Asset and workflow entries marked `review-required` in the inventory are not
cleared for public redistribution. The strict release command deliberately
blocks until evidence and a distribution decision are recorded:

```powershell
pnpm validate:provenance:strict
```

The strict inventory covers every tracked source-archive file, including
screenshots and planning documents. Source-archive distribution does not make a
tracked asset exempt from a rights decision.

For a future third-party item, add its name, version, license, source URL or
included license location, and any required attribution here (or in a clearly
linked packaged notice file). For an approved asset or workflow, record its
creator/source, license or permission, any model/provider terms that apply, and
the evidence location in the inventory. Do not infer rights from a filename,
provider name, or AI-generation record.
