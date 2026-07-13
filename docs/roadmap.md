# Point & Click Engine Roadmap

This roadmap turns Creator Alpha from a technically strong vertical slice into
an engine for producing complete 2D point-and-click adventures. The next
releases prioritize the gameplay loop — movement, interaction, and persistence
— before expanding authoring breadth or AI integrations.

## v0.1.1-alpha — Stabilization

The stabilization release closes correctness and distribution gaps without
changing the project schema or adding new AI providers.

- Enforce inventory selection and pickup invariants, including multiple pickups
  that grant the same unique item.
- Harden Electron with an explicit CSP, navigation and popup guards, denied
  permissions, and a restricted external URL policy.
- Add local, credential-free crash and renderer-error logging.
- Launch the packaged Windows executable in an automated smoke test, open a
  temporary project, save a change, open embedded preview, and close cleanly.
- Run quality checks on Windows and Ubuntu; add coverage, CodeQL, dependency
  update automation, immutable action pinning, and failure artifacts.
- Publish the next candidate as `0.1.1-alpha.1`; use a later `alpha.2` after
  packaged smoke coverage is available.

The 0.1.x line remains schema-v1 compatible. No new provider, workflow family,
or AI authoring surface is scheduled in this milestone; bug fixes, provenance,
security, and essential UX maintenance remain allowed.

## v0.2.0-alpha — Runtime Foundation

- Drive the player through deterministic navigation waypoints rather than a
  single straight-line animation.
- Keep interactions pending until `movement/completed`; expose path progress
  to the renderer without making frame timing part of gameplay state.
- Cache navigation grids per scene and reject diagonal corner cutting.
- Add versioned save documents with three manual slots, one autosave, and
  stable-state checkpoints.
- Support save validation, project fingerprint checks, corruption detection,
  restore, and browser/Electron storage adapters.
- Localize all runtime feedback with engine fallbacks and allow runtime locale
  switching.
- Add a developer-only world-state and path debug overlay.

## v0.3.0-alpha — Narrative Authoring

- Introduce schema-v2 and an idempotent `pointclick migrate` command with
  dry-run, backup, staging, rollback, and fixture coverage.
- Extend the Flow VM with conditions, choices, sub-flow calls/returns,
  inventory commands, waits, scene-entry triggers, and presentation cues.
- Add a minimal visual flow graph editor with validation and a puzzle
  dependency/debug view.
- Add audio assets, scene music/ambience, SFX, optional voice lines, captions,
  mute, and channel volume controls.
- Keep v1 projects readable and playable while requiring explicit migration for
  v2 authoring.

## v0.4.0-beta — Distribution

- Ship a verified portable ZIP and Squirrel installer.
- Sign the executable and installer when a certificate is configured; if the
  certificate is unavailable, publish an explicitly unsigned beta with
  checksums and a clear warning. Signing is required before a non-beta stable
  release.
- Add static web export with relative assets and browser save storage.
- Add keyboard navigation, focus management, captions, reduced-motion support,
  contrast checks, and onboarding for non-technical creators.
- Add compatibility tests across migrated projects and clean-install upgrade
  checks.

## Release engineering and community

- Keep `develop` as the integration branch and `master` as the release branch.
- Use semantic prereleases such as `0.1.1-alpha.1`, `0.2.0-alpha.1`, and
  `0.4.0-beta.1`, with a human changelog and machine-readable release manifest.
- Maintain public milestones for stabilization, runtime foundation, narrative
  authoring, and distribution, with focused issues labelled `runtime`,
  `editor`, `security`, `release`, `docs`, `good first issue`, and `help wanted`.
- Freeze new AI integrations until the v0.4 gates pass. Existing providers may
  receive bug, security, provenance, and essential UX fixes.

## Explicitly out of scope for this roadmap

Public plugin/SDK distribution, mobile export, executable hybrid 3D, cloud
collaboration, runtime LLM gameplay, generative music, and automatic updates
are deferred beyond v0.4.
