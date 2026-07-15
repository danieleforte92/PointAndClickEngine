# Point & Click Engine Roadmap

This roadmap is the product view. The implementation detail for the active
editor refactor lives in the [Editor Modularization and Visual Convergence
Roadmap](superpowers/plans/2026-07-14-editor-modularization-visual-convergence-roadmap.md).

## Status at a glance

| Milestone | Status | Evidence |
| --- | --- | --- |
| `v0.1.1-alpha.1` Stabilization | Shipped | Electron security, error logging, packaged smoke |
| `v0.2.0-alpha` Runtime Foundation | Shipped | Waypoint navigation, saves, persistence adapters |
| `v0.3.0-alpha` Narrative Authoring | Shipped | Schema-v2 migration, Flow VM, graph diagnostics, audio |
| `v0.4.0-alpha.3` Creator Alpha | Current | Windows package, static web export, accessibility, local-first AI |
| `v0.4.0-beta.1` Distribution and editor readiness | Next | Modular editor, docs alignment, compatibility and release gates |

The current workspace version is `0.4.0-alpha.3`. The next public candidate is
an explicitly marked prerelease with a clean version, asset set, checksums, and
release evidence. No new gameplay schema or AI provider is planned before the
beta gates pass.

## Current beta work

1. Correct the public candidate metadata and publish the matching Windows
   artifacts.
2. Complete the editor modularization and visual convergence initiative. The
   current checkpoint has the PR-04 command/session/error seams and the first
   AI/Scenes/Assets structural tranche implemented locally. The next gate is
   one consolidation PR, followed by a serial ownership launchpad and three
   parallel feature-completion workstreams.
3. Keep the player behavior stable while the editor theme is migrated; defer
   the player visual refresh to its own reviewed surface.
4. Align active documentation with the shipped schema-v2, graph editor, static
   web export, provenance, and accessibility behavior.
5. Add migrated-project compatibility, clean-install upgrade, accessibility,
   packaged smoke, and release-evidence checks to the beta gate.
6. Track the current 720 kB minified player bundle as a non-blocking
   performance item and decide code-splitting boundaries after editor stability.

The engineering execution details, ownership rules, budgets, and gate evidence
live in the [Editor Modularization and Visual Convergence Roadmap](superpowers/plans/2026-07-14-editor-modularization-visual-convergence-roadmap.md).

## Product direction after beta

After beta feedback, select the next product milestone from validated creator
needs. Candidate areas are richer authoring polish, stronger Character Gym
presets, and improved distribution ergonomics; none is committed until the
beta acceptance data exists.

## Release engineering

- Keep `develop` as the integration branch and `master` as the release branch.
- Use semantic prereleases with a human changelog and machine-readable release
  evidence; alpha and beta releases must be marked prerelease on GitHub.
- Maintain milestones and focused issues labelled `runtime`, `editor`,
  `security`, `release`, and `docs`.
- Run the full quality matrix before a PR is ready: unit tests, coverage,
  typecheck, sample/starter validation, E2E, packaging, provenance, CodeQL,
  and dependency audit.

## Explicitly out of scope through beta

Public plugin/SDK distribution, mobile export, executable hybrid 3D, cloud
collaboration, runtime LLM gameplay, generative music, hosted marketing/demo
infrastructure, and automatic updates remain deferred.
