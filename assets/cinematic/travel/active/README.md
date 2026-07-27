# Active travel car interior

The day and night scenes share one registered 1672×941 geometry master and one
exact aperture mask. The page first renders a one-way vertical parallax reveal,
then switches to an eight-second final-pose ambient loop.

Back-to-front ownership:

1. `01-exterior.png`: clean bay, road, lighthouse, and café plate
2. `03-interior-cutout.png`: roof, windshield and door frames, dashboard, map,
   mirror, crabs, correctly scaled left steering wheel, closed driver door,
   open passenger door, and lower cabin
3. `06-buddha-charm.png`: independently pivoted charm beneath the mirror
4. `04-front-seat.png`: independently translating, complete generated front
   bench seat on a below-frame overscan canvas

`00-composite-master.png` is the approved final-pose composite.
`02-interior-keyed.png` is the registered no-seat foreground source with exact
chroma-magenta glazing; `04-bench-seat-keyed.png` is the complete generated
bench source. The build script uses the installed chroma-removal helper and the
day-derived alpha to lock both theme apertures and both seat silhouettes.

The driver-side glass remains transparent while its lower door panel, handle,
trim, and sill remain part of the keyed opaque foreground. The passenger door
remains open.

The arrival starts with softly defocused far scenery and resolves to the sharp
registered endpoint before the ambient handoff. The complete bench begins
almost entirely in frame, then moves below the viewport until only its top
occupies roughly the bottom 10% of the final composition.

Rebuild layers:

```bash
python scripts/media/build_travel_interior_layers.py
```

Render arrival clips:

```bash
python scripts/media/render_travel_interior_arrival.py \
  assets/cinematic/travel/active/day \
  public/media/travel/transition/car-interior-rise-day-v1.mp4 \
  public/media/travel/transition/car-interior-rise-day-v1-poster.jpg

python scripts/media/render_travel_interior_arrival.py \
  assets/cinematic/travel/active/night \
  public/media/travel/transition/car-interior-rise-night-v1.mp4 \
  public/media/travel/transition/car-interior-rise-night-v1-poster.jpg
```

Render ambient loops:

```bash
python scripts/media/render_travel_interior_loop.py \
  assets/cinematic/travel/active/day \
  public/media/travel/ambient/car-interior-day-v1.mp4 \
  public/media/travel/ambient/car-interior-day-v1-poster.jpg \
  --theme day

python scripts/media/render_travel_interior_loop.py \
  assets/cinematic/travel/active/night \
  public/media/travel/ambient/car-interior-night-v1.mp4 \
  public/media/travel/ambient/car-interior-night-v1-poster.jpg \
  --theme night
```
