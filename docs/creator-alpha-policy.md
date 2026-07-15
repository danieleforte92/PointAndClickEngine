# Creator Alpha Support and Version Policy

## Release scope

Creator Alpha is a Windows-first, local-first technical alpha for authoring and
playing 2D point-and-click projects. The supported package target is the
Windows editor built by the release-candidate workflow. The browser player is a
development and embedded-preview surface, not a general hosted web-export
product.

The release does not promise a public SDK, hosted collaboration, enterprise
support, code signing, SBOM delivery, complete WCAG conformance, or autonomous
puzzle design. Static web export is available as a local build target. The
local copilot only proposes review-required beats; it does not write gameplay
or run during play. Those are possible later product decisions, not Alpha
commitments.

## Compatibility

The current Creator Alpha line authors schema-v2 documents and keeps v1 projects
readable and playable until an explicit `pointclick migrate` operation is run.
Migration supports dry-run, backup, staging, rollback, and fixture coverage.
Any compatibility exception must be called out in the release notes before a
tag is created. Pre-1.0 APIs and editor behavior can otherwise change between
minor releases.

## Provider policy

Mock generation, local LM Studio, and local ComfyUI are the local-first paths.
Cloud providers are experimental and opt-in: no provider account, key, or paid
service is required for the editor's core authoring loop. Credentials and
provider settings remain session-local, and generated material requires human
review before it becomes a release asset.

## Support and ownership

Maintainers triage reproducible bugs, security reports, and contribution
proposals through the repository. This is a best-effort community project;
there is no guaranteed response time, compatibility SLA, or support channel for
private production projects. See [SUPPORT.md](../SUPPORT.md),
[SECURITY.md](../SECURITY.md), and [GOVERNANCE.md](../GOVERNANCE.md).

## Release decisions

Only maintainers approve a release after the technical checks, manual packaged
preview, provenance decision, and any applicable signing decision are recorded
in the release evidence. The strict provenance gate is intentionally separate
from normal development checks so unreviewed local/starter assets do not block
every contributor build.

## CI and dependency controls

The stabilization gate runs on both Windows and Ubuntu, including threshold-
enforced unit-test coverage. CodeQL and a high-severity dependency audit are
required checks for candidate changes. Dependabot monitors npm dependencies and
GitHub Actions weekly. Workflow actions are pinned to immutable commit SHAs,
and failed browser or packaged smoke checks must retain their diagnostics for
review.
