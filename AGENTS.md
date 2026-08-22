# Wisteria Project Guidance

## Cinematic Art Direction

Apply this visual language to all new or revised Wisteria cinematic artwork unless the user explicitly requests a different direction.

### Canonical references

- Use `assets/cinematic/scenes/gamified-coastal-village/isometric-parallax/source/core-village-master.png` as the primary authority for the Mediterranean world, exterior architecture, geography, terraced landscapes, vegetation, docks, roads, coastline, palette, and isometric exterior rendering.
- Use `assets/cinematic/scenes/windmill-cafe-interior/source/windmill-cafe-approved.png` as the primary authority for interior design language, eye-level perspective, materials, ornament, furniture scale, painterly finish, and warm-versus-cool lighting.
- Use each scene-specific approved master as the authority for its local geometry, architectural subtype, palette variation, lighting, materials, prop arrangement, landmarks, apertures, and content. The canonical village and cafe references continue to govern the shared Wisteria world identity. Do not let a low-resolution reference override a higher-resolution approved authority.
- Before generating or repainting cinematic art, inspect the applicable canonical references and state each input image's role precisely.

### Unified style

Create high-detail, hand-painted cinematic environment illustrations with gentle storybook environmental storytelling and a romantic Mediterranean atmosphere. Combine intricate Gothic and Art Nouveau architecture with pale carved limestone, warm walnut wood, patinated teal metalwork, aged brass, blue-and-white ceramics, mustard textiles, botanical ornament, hanging flowers, and lush terraced vegetation. Handcrafted whimsical machinery should feel functional, tactile, and integrated into the architecture.

Use Ghibli-inspired environmental storytelling: inviting architecture, nature integrated into inhabited spaces, nostalgic domestic detail, handcrafted whimsical machinery, and quiet evidence of unseen daily life. Treat this as an influence on atmosphere and background storytelling, not permission to copy recognizable characters, locations, or compositions.

Use believable perspective and materials, fine illustrative contours, cinematic layered depth, and a clear focal hierarchy. Balance warm amber interiors and practical lights against luminous coastal daylight. Keep important architectural openings, navigation paths, and interactive focal objects immediately readable while allowing sky, water, and distant scenery visual breathing room.

### Camera and composition defaults

- Author cinematic scene masters in a wide 16:9 composition unless an approved geometry master requires another canvas.
- For interiors and interior-to-exterior reveals, default to an eye-level camera near 1.6 meters, a level horizon, and a rectilinear natural wide angle around 28-32 mm full-frame equivalent. Avoid fisheye distortion and arbitrary camera tilt.
- Artifact inspection plates may use a motivated close viewpoint, downward pitch, or near-straight-on detail view when required by the interaction. Record the camera relationship and preserve recognizable transition anchors.
- For village overviews, preserve the approved isometric camera and world geometry from the coastal-village master.
- Establish readable foreground, midground, and background planes. Use architecture and floor or road lines to lead toward the intended focal object without blocking it.
- Preserve approved camera, crop, perspective, silhouettes, landmarks, aperture geometry, and interaction coordinates when producing registered variants.
- Do not describe a newly generated camera as pixel-registered. Classify it as an independent viewpoint and preserve semantic continuity through documented architecture, furniture, props, materials, lighting direction, and interaction targets.

### Avoid

- No visible characters unless the user explicitly requests them.
- No modern minimalism, neon science fiction, coarse pixel art, flat cartoon rendering, photorealistic photography, or generic dark-fantasy dungeon treatment.
- No invented readable text, logos, watermarks, malformed furniture or machinery, repeated-detail artifacts, cluttered focal areas, muddy shadows, or equal sharpness everywhere.
- Do not recursively restyle a generated derivative when an approved source master is available; always return to the approved master and canonical references.

### Delivery checks

- Compare the result with the canonical references for palette, ornament density, material rendering, perspective, and lighting.
- Verify focal objects and interaction apertures remain readable at final display size.
- For registered variants, reject camera or geometry drift. For independent viewpoints, reject departures from the documented camera relationship or continuity anchors. In every case reject new unrequested objects, inconsistent world architecture, and changes outside the requested region.
- Save approved project artwork and prompts in the scene's versioned `source/` or `delivery/` structure rather than relying on temporary or chat-only files.
