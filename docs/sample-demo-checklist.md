# Sample Demo Checklist

Use this checklist to record the current **The Isle of Echoes** loop as a short
GIF or a 15-30 second demo clip.

## Goal

Show the smallest complete loop that proves the product direction:

`scene -> hotspot -> inventory -> item use -> flow -> state update`

## Recording Pass

1. Start the player and wait for the dock scene to appear.
2. Click `look`, then click the amber tavern door to trigger the first dialogue.
3. Advance the dialogue.
4. Click `use`, then click the rusty hook on the dock to collect it.
5. Advance the pickup dialogue.
6. Click `Rusty Hook` in the inventory strip.
7. Click the tavern entrance again to trigger the item-use flow.
8. Advance the final dialogue and leave the footer visible long enough to show
   the latest event and updated sequence.

## Framing Notes

- Keep the stage, verb bar, inventory strip, and footer visible in frame.
- Let the dialogue card stay on screen for a beat before advancing it.
- End with the selected scene and event trace still readable.

## Optional Screenshot Capture

To refresh the checked-in sample screenshot after UI changes, run:

```powershell
$env:CAPTURE_SAMPLE_SCREENSHOT_PATH='docs/assets/sample-player-demo.png'
pnpm test:e2e
```

The Playwright run currently completes the browser test successfully and may
still time out during shutdown. If the test output shows `ok 1` and the image
file was updated, the screenshot capture itself succeeded.

## Talking Points

- The same deterministic runtime powers the web player and editor preview.
- The loop is intentionally tiny, but it already shows verbs, pickups,
  inventory state, flow execution, and state mutation.
- The sample is meant to be recorded in one take without extra explanation.
