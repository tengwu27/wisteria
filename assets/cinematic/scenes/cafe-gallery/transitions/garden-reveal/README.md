# Active café transition artwork

The day and night transitions are registered 1672×941 four-plate
compositions. The sky stays fixed while every other plate translates left
using one shared, monotonic progress curve. Motion distance increases with
proximity to the camera, producing a garden-to-café parallax reveal without a
door animation.

Back-to-front ownership:

1. Static sky
2. Coffee shop, open gallery entrance, distant landscape, and patio
3. Middle garden
4. Dense near-camera flower and bush curtain

Render the active transitions with:

```bash
python scripts/media/render_cafe_parallax_reveal.py \
  assets/cinematic/scenes/cafe-gallery/transitions/garden-reveal/layers/day \
  assets/cinematic/delivery-sources/cafe-gallery/transitions/garden-reveal/cafe-reveal-day-v1.mp4 \
  assets/cinematic/delivery-sources/cafe-gallery/transitions/garden-reveal/cafe-reveal-day-v1-poster.jpg

python scripts/media/render_cafe_parallax_reveal.py \
  assets/cinematic/scenes/cafe-gallery/transitions/garden-reveal/layers/night \
  assets/cinematic/delivery-sources/cafe-gallery/transitions/garden-reveal/cafe-reveal-night-v1.mp4 \
  assets/cinematic/delivery-sources/cafe-gallery/transitions/garden-reveal/cafe-reveal-night-v1-poster.jpg
```
