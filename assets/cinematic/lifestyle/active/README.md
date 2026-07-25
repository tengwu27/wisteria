# Active lifestyle room media

This directory contains only the registered source plates for the two lifestyle
room loops currently used by the site.

- `day/` renders `living-room-multilayer-v6`.
- `night/` renders `living-room-night-v5`.

Both themes use the same 1672×941 geometry master. The foreground/window frame,
camera, crop, and horizon remain fixed. The boat rocks periodically without
horizontal travel; the night loop additionally includes localized moonlight,
lighthouse glow, and practical-light effects.

Render the active bundles with:

```bash
python scripts/media/render_lifestyle_multilayer.py \
  assets/cinematic/lifestyle/active/day \
  public/media/lifestyle/ambient/living-room-multilayer-v6.mp4 \
  public/media/lifestyle/ambient/living-room-multilayer-v6-poster.jpg

python scripts/media/render_lifestyle_multilayer.py \
  assets/cinematic/lifestyle/active/day \
  public/media/lifestyle/ambient/living-room-night-v5.mp4 \
  public/media/lifestyle/ambient/living-room-night-v5-poster.jpg \
  --theme night \
  --night-layer-dir assets/cinematic/lifestyle/active/night
```
