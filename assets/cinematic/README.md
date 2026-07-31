# Cinematic Asset Sources

This tree contains the editable inputs and registered authoring plates for each
immersive scene. Browser-delivered assets use the same scene names under
`public/media`.

```text
scenes/
  <scene>/
    interior/
      sources/                approved masters or registered source plates
      repairs/                localized reconstruction inputs, when required
      masks/                  exact alpha or object mattes, when required
    transitions/
      <shot>/
        sources/              approved transition artwork
        masks/                mechanical or aperture masks, when required
        layers/               registered render-ready plates
```

Canonical scene names are `village`, `living-room`, `cafe-gallery`,
`car-interior`, and `garage-workshop`. Site-route labels such as `art`,
`lifestyle`, and `travel` do not own cinematic assets.

Only active delivery copies belong in `public/media/<scene>`. Superseded
renders remain recoverable from Git history instead of being kept in parallel
source or archive folders.
