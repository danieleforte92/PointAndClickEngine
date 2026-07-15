# Visual Authoring v0.5.0-alpha Evidence

This candidate covers M01–M09 of the Visual Authoring roadmap. The final
commands below were run locally on the dedicated branch
`codex/visual-authoring-v05-m01-m09`; they must be repeated against the
integrated PR commit before publishing the tag.

| Milestone | Delivered surface | Evidence |
| --- | --- | --- |
| M01 | Visual Authoring roadmap, design notes, release alignment | `pnpm check:docs`, `pnpm check:release` |
| M02 | Resizable shell, persisted view preferences, resource dock state | `editor-baseline.spec.ts`, `editor-test-lab.spec.ts` |
| M03 | Scene navigator search, Inspector/Layers tabs, contextual selection | `editor-scenes.spec.ts`, visual authoring E2E |
| M04 | Schema v3 colliders, migration, shared runtime geometry | contracts/project-io/runtime Vitest suites |
| M05 | Fit/zoom controls and collider-aware viewport rendering | `editor-scenes.spec.ts`, renderer/runtime typecheck |
| M06 | Global resource dock with search, grid/list, preview, drag-and-drop | visual authoring E2E and asset E2E |
| M07 | Gameplay Graph, scene ownership, guided transition wizard | gameplay graph model tests and visual authoring E2E |
| M08 | Narrative palette, quick-add, connect/reconnect, duplicate/delete, auto-layout | narrative E2E and visual authoring E2E |
| M09 | Accessibility assertions, narrow viewport, screenshot evidence | Playwright 15/15; 1440×900 and 1920×1080 snapshots |

## Final local gates

- Vitest: 66 files, 331 passed, 1 skipped.
- TypeScript: all 15 workspace projects passed.
- Playwright: 15 passed, including player desktop/mobile and Test Lab.
- Editor budget, theme contract, docs, release hygiene, and provenance passed.
- Windows x64 package verification and packaged player smoke passed.
