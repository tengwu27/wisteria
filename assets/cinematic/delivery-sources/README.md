# Cinematic delivery sources

This directory retains approved authoring masters outside Astro's public
delivery tree. Production pages must reference only the optimized assets under
`public/media`.

After generating or updating registered PNG plates, posters, or interface
artwork, rebuild image delivery copies with:

```bash
python scripts/media/optimize_cinematic_delivery.py
```

After generating or updating transition MP4 masters, rebuild video delivery
copies with:

```bash
python scripts/media/optimize_cinematic_video_delivery.py
```

The video optimizer preserves resolution, frame rate, frame count, duration,
and transition endpoints. It retains 60 fps sources at 60 fps, verifies H.264
browser compatibility and fast-start metadata, and accepts recompression only
after full-clip and endpoint VMAF gates pass. If a clip would save less than
5%, the approved source is copied unchanged to avoid needless generational
loss.

Ambient loops remain public masters because they are already compact. Avoid
recompressing them unless a new source render materially changes their payload
or playback characteristics.
