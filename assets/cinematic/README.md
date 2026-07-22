# Cinematic Asset Sources

This tree contains the editable inputs and retained master renders for the
cinematic village. It mirrors the deployed media taxonomy without mixing
authoring files into `public`.

```text
village/
  ambient/
    sources/                  painted day/night source frames
    renders/                  retained master loop encodes
  interactions/<object>/
    sources/                  aligned closed/interior endpoint frames
    masks/                    optional mechanical-motion masks
    renders/                  retained master interaction encodes
```

Only approved delivery copies belong in `public/media/village`. Older renders
move to `assets/archive/cinematic-media` so they remain available for comparison
without being deployed.
