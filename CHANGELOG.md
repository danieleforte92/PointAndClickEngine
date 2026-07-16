# Changelog

## 0.5.0-alpha - 2026-07-15

### Visual Authoring

- Complete the M01–M09 Visual Authoring roadmap: resizable authoring shell,
  scene navigator and inspector layers, schema-v3 collider migration, fit and
  zoom controls, global resource dock, Gameplay Graph transition wizard, and
  Narrative Graph authoring tools.
- Add shared collider geometry and runtime hit testing while preserving legacy
  rectangle compatibility at the validation boundary.
- Add Playwright coverage for the visual authoring surfaces, accessibility,
  narrow desktop overflow, and 1440×900 / 1920×1080 screenshot evidence.

### Release engineering

- Align all workspace package metadata on `0.5.0-alpha`.

## 0.4.0-alpha.3 - 2026-07-14

### Release alignment

- Align all workspace package metadata, active documentation, and release
  evidence paths on `0.4.0-alpha.3`.
- Keep the player on its legacy theme entry point while the editor uses the
  scoped studio theme contract.
- Add repository checks for the editor budget, theme contract, and active
  documentation links/version references.

### Editor engineering

- Add editor characterization coverage, pure authoring/UI model tests, and
  ratcheted editor stylesheet and source budgets.

## 0.4.0-alpha.1 - 2026-07-13

### Added

- Deterministic waypoint navigation with pending interactions completed at
  `movement/completed`.
- Versioned save documents with manual slots, autosave, checkpoints, browser
  storage, validation, corruption detection, and project fingerprint checks.
- Schema-v2 migration with dry-run, backup, staging, rollback, and fixture
  coverage.
- Flow VM conditions, choices, sub-flows, inventory commands, waits, scene
  triggers, presentation cues, graph diagnostics, and puzzle dependencies.
- Audio mixer, captions, scene music/ambience, SFX, and optional voice lines.
- Static web export with relative assets and browser save storage.
- Keyboard/focus support, reduced-motion behavior, contrast-oriented player
  surfaces, and onboarding improvements for creators.
- Windows distribution validation for the portable package, ZIP, and Squirrel
  installer outputs.

### Fixed

- Player event feedback now renders movement completion with stable coordinates.
- Coverage runs are reproducible with the hoisted pnpm workspace layout.

### Release engineering

- Align the workspace candidate metadata on `0.4.0-alpha.1`.
- Keep the Windows candidate explicitly unsigned and prerelease until signing
  evidence is available.

## 0.1.1-alpha.1 - 2026-07-13

### Fixed

- Reject selecting inventory items that the player does not own.
- Allow distinct pickups to be collected when they grant the same unique item.

### Security

- Add Electron CSP, navigation, popup, permission, and external URL policies.
- Add local redacted JSONL error logging for packaged editor diagnostics.

### Release engineering

- Add the packaged Windows smoke-test entry point.
- Update the roadmap and prepare the alpha prerelease version.
