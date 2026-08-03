# Active café-gallery interior artwork

The day and night masters share the same 1672×941 camera, architecture,
furniture, artwork, and hotspot geometry. The large framed landscape painting
near the center is the primary route to the art archive.

The ambient renderer keeps the camera and all scene structure fixed. Only
localized periodic practical-light glow and coffee steam are synthesized, so
the eight-second loops close without a visible jump.

```bash
python scripts/media/render_cafe_interior_loop.py \
  assets/cinematic/scenes/cafe-gallery/interior/sources/day-master.png \
  public/media/cafe-gallery/ambient/cafe-gallery-day-v1.mp4 \
  assets/cinematic/delivery-sources/cafe-gallery/ambient/cafe-gallery-day-v1-poster.jpg

python scripts/media/render_cafe_interior_loop.py \
  assets/cinematic/scenes/cafe-gallery/interior/sources/night-master.png \
  public/media/cafe-gallery/ambient/cafe-gallery-night-v1.mp4 \
  assets/cinematic/delivery-sources/cafe-gallery/ambient/cafe-gallery-night-v1-poster.jpg \
  --theme night
```
