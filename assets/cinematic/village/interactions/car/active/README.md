# Active multilayer car transition

The day and night transitions are registered to the 1672×941 car artwork.
The car-free near background reconstructs the house, café edge, garden and
road. A registered matte assigns that complete near scene—including the
umbrella, fence and ground—to the same horizontal translation as the car. The
separate `00-far-trees-v6.png` plates contain only distant foliage and move at
roughly one third of the foreground speed. The renderer reduces these far
plates to 70% visual scale with mirrored overscan, then applies a 3.2 px
Gaussian depth blur to that plate only. The car, road, fence, architecture and
door remain sharp at 100%. The camera remains locked at 1×.

The moving driver door uses exact v3 metal/frame and glazing masks. The outer
handle is on the rear side, so the conventional hinge is on the opposite front
side. Its nearly vertical x=950 hinge keeps the door upright while horizontal
foreshortening depicts a 68-degree outward swing. Because the swing remains
below 90 degrees, the original painted exterior face and rear handle remain
visible; the renderer never substitutes an inside panel.

Back-to-front ownership:

1. `00-far-trees-v6.png`: far-only tree plate
2. `01-background.png` through `car-near-scene-alpha-mask-v4.png`
3. Localized contact shadow and night headlight spill
4. Car body and visible interior through `car-foreground-alpha-mask-v3.png`
5. Rigid exterior door metal/frame, mirror and exact glazing aperture

Depth-of-field rule: blur a registered, reconstructed far plate before its
horizontal transform. Never blur the flattened frame or the car/ground group;
doing so creates halos at masks and makes rigid near objects look detached.

Rebuild masks and render with:

```bash
python scripts/media/build_car_transition_masks.py

python scripts/media/render_3d_car_door_walk.py \
  assets/cinematic/village/interactions/car/sources/car-closeup-day-closed-v1.png \
  assets/cinematic/village/interactions/car/sources/car-closeup-day-interior-v1.png \
  assets/cinematic/village/interactions/car/active/layers/day/01-background.png \
  assets/cinematic/village/interactions/car/active/layers/day/00-far-trees-v6.png \
  assets/cinematic/village/interactions/car/masks/car-near-scene-alpha-mask-v4.png \
  assets/cinematic/village/interactions/car/masks/car-foreground-alpha-mask-v3.png \
  assets/cinematic/village/interactions/car/masks/car-driver-door-outer-mask-v3.png \
  assets/cinematic/village/interactions/car/masks/car-driver-door-glazing-mask-v3.png \
  public/media/village/interactions/car/driver-door-day-v6.mp4 \
  public/media/village/interactions/car/driver-door-day-v6-poster.jpg

python scripts/media/render_3d_car_door_walk.py \
  assets/cinematic/village/interactions/car/sources/car-closeup-night-closed-v1.png \
  assets/cinematic/village/interactions/car/sources/car-closeup-night-interior-v1.png \
  assets/cinematic/village/interactions/car/active/layers/night/01-background.png \
  assets/cinematic/village/interactions/car/active/layers/night/00-far-trees-v6.png \
  assets/cinematic/village/interactions/car/masks/car-near-scene-alpha-mask-v4.png \
  assets/cinematic/village/interactions/car/masks/car-foreground-alpha-mask-v3.png \
  assets/cinematic/village/interactions/car/masks/car-driver-door-outer-mask-v3.png \
  assets/cinematic/village/interactions/car/masks/car-driver-door-glazing-mask-v3.png \
  public/media/village/interactions/car/driver-door-night-v6.mp4 \
  public/media/village/interactions/car/driver-door-night-v6-poster.jpg \
  --night
```
