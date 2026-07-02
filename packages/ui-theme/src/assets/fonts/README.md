# Storyboard Studio Fonts

Place these OSS font files here before a branded release build:

- `Fraunces-Variable.woff2`
- `SourceSans3-Variable.woff2`
- `JetBrainsMono-Variable.woff2`

Keep the original font license files beside the binaries. After adding the
files, update `../../fonts.css` to append the `url(...) format("woff2")`
sources after the existing `local(...)` entries.
