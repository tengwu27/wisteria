import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const sceneRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const projectRoot = resolve(sceneRoot, '../../../..');
const artRoot = resolve(
  projectRoot,
  'assets/cinematic/art-pieces/still-life-with-wisteria'
);
const masterPath = resolve(sceneRoot, 'source/castle-gallery-master-v2.png');
const artPath = resolve(artRoot, 'source/still-life-with-wisteria-v1.png');
const proxyPath = resolve(
  artRoot,
  'source/proxy/still-life-with-wisteria-wall-proxy-v1.png'
);
const deliveryRoot = resolve(sceneRoot, 'delivery');
const artDeliveryRoot = resolve(artRoot, 'delivery');
const proofRoot = resolve(sceneRoot, 'proofs');

const canvas = { width: 1672, height: 941 };
const apertures = {
  'gallery-left-frame': { x: 407, y: 338, width: 112, height: 204 },
  'gallery-center-frame': { x: 633, y: 292, width: 406, height: 267 },
  'gallery-right-frame': { x: 1153, y: 338, width: 112, height: 204 }
};
const centerArtwork = { x: 658, y: 292, width: 356, height: 267 };

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function normalized(bounds) {
  return {
    x: bounds.x / canvas.width,
    y: bounds.y / canvas.height,
    width: bounds.width / canvas.width,
    height: bounds.height / canvas.height
  };
}

function maskFor(bounds) {
  const mask = Buffer.alloc(canvas.width * canvas.height);
  for (let y = bounds.y; y < bounds.y + bounds.height; y += 1) {
    mask.fill(255, y * canvas.width + bounds.x, y * canvas.width + bounds.x + bounds.width);
  }
  return mask;
}

function contains(bounds, x, y) {
  return (
    x >= bounds.x &&
    x < bounds.x + bounds.width &&
    y >= bounds.y &&
    y < bounds.y + bounds.height
  );
}

async function resizedWebp(input, output, width, options = {}) {
  await sharp(input)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: options.quality ?? 88, alphaQuality: options.alphaQuality ?? 92 })
    .toFile(output);
}

await Promise.all([
  mkdir(deliveryRoot, { recursive: true }),
  mkdir(artDeliveryRoot, { recursive: true }),
  mkdir(proofRoot, { recursive: true })
]);

const [masterBuffer, artBuffer, proxyBuffer] = await Promise.all([
  readFile(masterPath),
  readFile(artPath),
  readFile(proxyPath)
]);
const masterMetadata = await sharp(masterBuffer).metadata();
if (masterMetadata.width !== canvas.width || masterMetadata.height !== canvas.height) {
  throw new Error(`Gallery master must remain ${canvas.width}x${canvas.height}.`);
}

for (const [id, bounds] of Object.entries(apertures)) {
  await sharp(maskFor(bounds), {
    raw: { width: canvas.width, height: canvas.height, channels: 1 }
  })
    .png()
    .toFile(resolve(deliveryRoot, `${id}-mask.png`));
}

const masterRaw = await sharp(masterBuffer).ensureAlpha().raw().toBuffer();
const shellRaw = Buffer.from(masterRaw);
for (let y = 0; y < canvas.height; y += 1) {
  for (let x = 0; x < canvas.width; x += 1) {
    if (Object.values(apertures).some((bounds) => contains(bounds, x, y))) {
      shellRaw[(y * canvas.width + x) * 4 + 3] = 0;
    }
  }
}
const shellPng = await sharp(shellRaw, {
  raw: { width: canvas.width, height: canvas.height, channels: 4 }
})
  .png()
  .toBuffer();
await writeFile(resolve(deliveryRoot, 'gallery-frame-shell.png'), shellPng);

const proxyFitted = await sharp(proxyBuffer)
  .resize({
    width: centerArtwork.width,
    height: centerArtwork.height,
    fit: 'contain',
    withoutEnlargement: true
  })
  .png()
  .toBuffer();
const transparentCanvas = {
  create: {
    width: canvas.width,
    height: canvas.height,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 }
  }
};
const proxyLayerPng = await sharp(transparentCanvas)
  .composite([{ input: proxyFitted, left: centerArtwork.x, top: centerArtwork.y }])
  .png()
  .toBuffer();
await writeFile(resolve(deliveryRoot, 'gallery-center-proxy-layer.png'), proxyLayerPng);

const fallbackPng = await sharp(masterBuffer)
  .composite([{ input: proxyFitted, left: centerArtwork.x, top: centerArtwork.y }])
  .png()
  .toBuffer();
await writeFile(resolve(proofRoot, 'gallery-approved-composite.png'), fallbackPng);

const fallbackRaw = await sharp(fallbackPng).ensureAlpha().raw().toBuffer();
let outsideDifferencePixels = 0;
for (let y = 0; y < canvas.height; y += 1) {
  for (let x = 0; x < canvas.width; x += 1) {
    if (contains(apertures['gallery-center-frame'], x, y)) continue;
    const offset = (y * canvas.width + x) * 4;
    if (
      fallbackRaw[offset] !== masterRaw[offset] ||
      fallbackRaw[offset + 1] !== masterRaw[offset + 1] ||
      fallbackRaw[offset + 2] !== masterRaw[offset + 2] ||
      fallbackRaw[offset + 3] !== masterRaw[offset + 3]
    ) {
      outsideDifferencePixels += 1;
    }
  }
}
if (outsideDifferencePixels !== 0) {
  throw new Error(`Gallery composite changed ${outsideDifferencePixels} pixels outside the center aperture.`);
}

await sharp(masterBuffer)
  .composite([{ input: fallbackPng, blend: 'difference' }])
  .normalise()
  .png()
  .toFile(resolve(proofRoot, 'gallery-amplified-difference.png'));

for (const width of [1254, 1672]) {
  await Promise.all([
    resizedWebp(masterBuffer, resolve(deliveryRoot, `castle-gallery-base-${width}.webp`), width),
    resizedWebp(fallbackPng, resolve(deliveryRoot, `castle-gallery-fallback-${width}.webp`), width),
    resizedWebp(shellPng, resolve(deliveryRoot, `castle-gallery-shell-${width}.webp`), width),
    resizedWebp(proxyLayerPng, resolve(deliveryRoot, `castle-gallery-proxy-${width}.webp`), width)
  ]);
}

for (const width of [724, 1448]) {
  await Promise.all([
    resizedWebp(artBuffer, resolve(artDeliveryRoot, `still-life-with-wisteria-${width}.webp`), width, {
      quality: 92
    }),
    resizedWebp(proxyBuffer, resolve(artDeliveryRoot, `still-life-with-wisteria-proxy-${width}.webp`), width)
  ]);
}

const manifest = {
  schemaVersion: 1,
  sceneId: 'castle-gallery-wall',
  registration: {
    kind: 'independent-viewpoint',
    canvas,
    camera: 'Eye level near 1.6 m, level horizon, rectilinear natural wide angle near 30 mm, facing the principal wall nearly straight-on.',
    continuityAnchors: [
      'terracotta-red salon wall within pale carved limestone',
      'dark walnut dado, doors, and coffered ceiling',
      'aged brass and patinated teal ornament',
      'cool coastal daylight at the left arch against amber practical lights'
    ]
  },
  layerOrder: ['base', 'framed-art-proxy', 'foreground-frame-shell'],
  apertures: Object.fromEntries(
    Object.entries(apertures).map(([id, bounds]) => [
      id,
      {
        bounds,
        normalizedBounds: normalized(bounds),
        mask: `${id}-mask.png`,
        aspectPolicy: 'contain-with-mat'
      }
    ])
  ),
  occupied: {
    'gallery-center-frame': {
      wisteriaId: 'still-life-with-wisteria',
      artworkBounds: centerArtwork,
      normalizedArtworkBounds: normalized(centerArtwork),
      sourceSha256: sha256(artBuffer),
      proxySha256: sha256(proxyBuffer)
    }
  },
  protectedPixels: {
    outsideApertures: true,
    outsideDifferencePixels
  },
  source: {
    master: 'source/castle-gallery-master-v2.png',
    masterSha256: sha256(masterBuffer)
  }
};
await writeFile(
  resolve(deliveryRoot, 'gallery-layer-manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`
);

console.log(
  `Built Castle Gallery bundle with ${outsideDifferencePixels} changed pixels outside registered apertures.`
);
