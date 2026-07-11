# Third-Party and Asset Notices

The repository source and documentation authored for Point & Click Engine are
licensed under [Apache-2.0](LICENSE). That license does not establish rights for
sample artwork, starter-project material, screenshots, AI outputs, workflow
exports, model weights, or third-party packages.

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

For an approved third-party item, add its name, version, license, source URL or
included license location, and any required attribution here (or in a clearly
linked packaged notice file). For an approved asset or workflow, record its
creator/source, license or permission, any model/provider terms that apply, and
the evidence location in the inventory. This file deliberately contains no
invented attributions.
