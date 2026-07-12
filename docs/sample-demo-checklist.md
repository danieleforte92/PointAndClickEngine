# Sample Demo Checklist

Use this checklist to record the current **The Isle of Echoes** loop as a short
GIF or a 15-30 second demo clip.

## Goal

Show the smallest complete loop that proves the product direction:

`scene -> hotspot -> inventory -> item use -> flow -> state update -> transition`

The sample also demonstrates player animation-pack assignment, an animated NPC
actor fallback path, prompt-pack provenance, and saved-project validation.

## Recording Pass

1. Start the player and wait for the dock scene to appear.
2. Press `2` or click `look`, then click the amber tavern door to trigger the first dialogue.
3. Advance the dialogue with `Space`, `Enter`, or a click.
4. Press `3` or click `use`, then click the rusty hook on the dock to collect it.
5. Advance the pickup dialogue.
6. Click `Rusty Hook` in the inventory strip.
7. Click the tavern entrance again to trigger the item-use flow.
8. Advance the final dialogue to enter the Lantern Room.
9. Leave the footer visible long enough to show the latest event, new scene, and
   updated sequence.

## Framing Notes

- Keep the stage, verb bar, inventory strip, and footer visible in frame.
- Let the dialogue card stay on screen for a beat before advancing it.
- End with the selected scene and event trace still readable.
- Switch the player to `Capture` mode before taking a still or recording a
  clean final pass.
- Use `1-4` to swap verbs quickly and `C` to toggle `Capture` mode without
  mousing over the header.

## Optional Screenshot Capture

To refresh the checked-in sample screenshot after UI changes, run:

```powershell
$env:CAPTURE_SAMPLE_SCREENSHOT_PATH='docs/assets/player-showcase-loop.png'
pnpm test:e2e
```

The Playwright run currently completes the browser test successfully and may
still time out during shutdown. If the test output shows `ok 1` and the image
file was updated, the screenshot capture itself succeeded.

That capture path now switches the player into its built-in `Capture` mode
before saving the image, so the checked-in screenshot stays presentation-ready.

## Talking Points

- The same deterministic runtime powers the web player and editor preview.
- The loop is intentionally tiny, but it already shows verbs, pickups,
  inventory state, flow execution, and state mutation.
- The editor can change player asset/animation settings and preview draft scene
  changes before they are saved.
- AI support is authoring-only: prompt packs and ComfyUI imports become reviewed
  project documents and assets.
- The sample is meant to be recorded in one take without extra explanation.
