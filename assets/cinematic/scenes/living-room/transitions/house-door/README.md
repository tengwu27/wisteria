# Active multilayer house transition

The day and night transitions use the existing registered 1672×941 house
closed/interior plates plus two independently moving foreground garden plates.
The house camera keeps its forward push while the gardens split outward and the
deterministic door opens.

Back-to-front ownership:

1. Registered house and doorway interior
2. Rigid moving door leaf
3. Left near-camera flower and bush curtain
4. Right near-camera flower and bush curtain

The garden plates are derived from the approved café reveal so the two village
entrances share one botanical art language. Run:

```bash
python scripts/media/build_house_transition_layers.py

python scripts/media/render_multilayer_house_transition.py \
  assets/cinematic/scenes/living-room/transitions/house-door/sources/main-house-closeup-corrected-door.png \
  assets/cinematic/scenes/living-room/transitions/house-door/sources/main-house-closeup-interior-plate.png \
  assets/cinematic/scenes/living-room/transitions/house-door/layers/day \
  assets/cinematic/delivery-sources/living-room/transitions/house-door/door-day-v4.mp4 \
  assets/cinematic/delivery-sources/living-room/transitions/house-door/door-day-v4-poster.jpg

python scripts/media/render_multilayer_house_transition.py \
  assets/cinematic/scenes/living-room/transitions/house-door/sources/main-house-closeup-night-closed-v2.png \
  assets/cinematic/scenes/living-room/transitions/house-door/sources/main-house-closeup-night-interior-v2.png \
  assets/cinematic/scenes/living-room/transitions/house-door/layers/night \
  assets/cinematic/delivery-sources/living-room/transitions/house-door/door-night-v4.mp4 \
  assets/cinematic/delivery-sources/living-room/transitions/house-door/door-night-v4-poster.jpg
```
