import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

import {
  MATCHED_FRAME_ASPECT_TOLERANCE,
  MATCHED_FRAME_MIN_SHORT_SIDE,
  validateCuratedPlacementGeometry
} from '../../../../../scripts/assets/frame-geometry.mjs';

const sceneRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const projectRoot = resolve(sceneRoot, '../../../..');
const artRoot = resolve(projectRoot, 'assets/cinematic/art-pieces/still-life-with-wisteria');
const immutableMasterPath = resolve(sceneRoot, 'source/castle-gallery-master-v3.png');
const curatedMasterPath = resolve(sceneRoot, 'source/castle-gallery-master-v4.png');
const repairDonorPath = resolve(sceneRoot, 'source/repairs/gallery-sparse-curation-v4-donor.png');
const repairMaskPath = resolve(sceneRoot, 'source/repairs/gallery-sparse-curation-v4-repair-mask.png');
const repairPromptPath = resolve(sceneRoot, 'source/repairs/gallery-sparse-curation-v4-prompt.md');
const artPath = resolve(artRoot, 'source/still-life-with-wisteria-v1.png');
const proxyPath = resolve(artRoot, 'source/proxy/still-life-with-wisteria-wall-proxy-v1.png');
const deliveryRoot = resolve(sceneRoot, 'delivery');
const artDeliveryRoot = resolve(artRoot, 'delivery');
const proofRoot = resolve(sceneRoot, 'proofs');

const canvas = { width: 1672, height: 941 };
const normalizedExhibitRegion = { x: 0.14, y: 0.14, width: 0.75, height: 0.56 };
const exhibitRegion = { x: 234, y: 132, width: 1254, height: 527 };
const placement = {
  id: 'gallery-placement-still-life-v1',
  artworkId: 'still-life-with-wisteria',
  artKind: 'painting',
  hotspotId: 'castle-gallery-still-life-with-wisteria',
  frameBounds: { x: 636, y: 272, width: 400, height: 288 },
  apertureBounds: { x: 658, y: 292, width: 356, height: 267 },
  apertureMaskId: 'gallery-placement-still-life-v1-mask',
  aspectPolicy: 'match-source-frame'
};
const emptySupports = [
  { id: 'gallery-left-empty-support', bounds: { x: 386, y: 317, width: 154, height: 227 } },
  { id: 'gallery-right-empty-support', bounds: { x: 1132, y: 317, width: 154, height: 227 } }
];
const repairClusters = [
  { x: 244, y: 177, width: 190, height: 454 },
  { x: 1238, y: 177, width: 190, height: 454 }
];
const protectedSupportAssemblies = [
  { x: 365, y: 295, width: 195, height: 290 },
  { x: 1115, y: 295, width: 195, height: 290 }
];

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

function contains(bounds, x, y) {
  return x >= bounds.x && x < bounds.x + bounds.width && y >= bounds.y && y < bounds.y + bounds.height;
}

function fillMask(mask, bounds, value) {
  for (let y = bounds.y; y < bounds.y + bounds.height; y += 1) {
    mask.fill(value, y * canvas.width + bounds.x, y * canvas.width + bounds.x + bounds.width);
  }
}

function maskFor(bounds) {
  const mask = Buffer.alloc(canvas.width * canvas.height);
  fillMask(mask, bounds, 255);
  return mask;
}

async function buildSparseRepairMask() {
  const binary = Buffer.alloc(canvas.width * canvas.height);
  for (const bounds of repairClusters) fillMask(binary, bounds, 255);
  for (const bounds of protectedSupportAssemblies) fillMask(binary, bounds, 0);

  const blurred = await sharp(binary, {
    raw: { width: canvas.width, height: canvas.height, channels: 1 }
  }).blur(4).raw().toBuffer({ resolveWithObject: true });
  const softened = Buffer.alloc(canvas.width * canvas.height);
  for (let pixel = 0; pixel < softened.length; pixel += 1) {
    softened[pixel] = blurred.data[pixel * blurred.info.channels];
  }
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      if (!contains(exhibitRegion, x, y)) softened[y * canvas.width + x] = 0;
    }
  }
  return softened;
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
  mkdir(proofRoot, { recursive: true }),
  mkdir(dirname(repairMaskPath), { recursive: true })
]);

const [immutableMasterBuffer, repairDonorBuffer, repairPromptBuffer, artBuffer, proxyBuffer] = await Promise.all([
  readFile(immutableMasterPath),
  readFile(repairDonorPath),
  readFile(repairPromptPath),
  readFile(artPath),
  readFile(proxyPath)
]);
const [masterMetadata, donorMetadata, artMetadata, proxyMetadata] = await Promise.all([
  sharp(immutableMasterBuffer).metadata(),
  sharp(repairDonorBuffer).metadata(),
  sharp(artBuffer).metadata(),
  sharp(proxyBuffer).metadata()
]);
for (const [label, metadata] of [['master', masterMetadata], ['donor', donorMetadata]]) {
  if (metadata.width !== canvas.width || metadata.height !== canvas.height) {
    throw new Error(`Gallery ${label} must remain ${canvas.width}x${canvas.height}.`);
  }
}
if (!artMetadata.width || !artMetadata.height || !proxyMetadata.width || !proxyMetadata.height) {
  throw new Error('Gallery artwork and wall proxy dimensions are required.');
}

const geometryValidation = validateCuratedPlacementGeometry({
  source: { width: artMetadata.width, height: artMetadata.height },
  aperture: placement.apertureBounds,
  frame: placement.frameBounds,
  exhibitRegion
});
if (geometryValidation.errors.length) throw new Error(geometryValidation.errors.join(' '));

const repairMaskRaw = await buildSparseRepairMask();
const repairMaskPng = await sharp(repairMaskRaw, {
  raw: { width: canvas.width, height: canvas.height, channels: 1 }
}).png().toBuffer();
await writeFile(repairMaskPath, repairMaskPng);

const donorRaw = await sharp(repairDonorBuffer).ensureAlpha().raw().toBuffer();
for (let pixel = 0; pixel < canvas.width * canvas.height; pixel += 1) {
  donorRaw[pixel * 4 + 3] = Math.min(donorRaw[pixel * 4 + 3], repairMaskRaw[pixel]);
}
const maskedDonorPng = await sharp(donorRaw, {
  raw: { width: canvas.width, height: canvas.height, channels: 4 }
}).png().toBuffer();
const curatedMasterBuffer = await sharp(immutableMasterBuffer)
  .composite([{ input: maskedDonorPng }])
  .png()
  .toBuffer();
await writeFile(curatedMasterPath, curatedMasterBuffer);

const [immutableRaw, curatedRaw] = await Promise.all([
  sharp(immutableMasterBuffer).ensureAlpha().raw().toBuffer(),
  sharp(curatedMasterBuffer).ensureAlpha().raw().toBuffer()
]);
let outsideRepairDifferencePixels = 0;
let repairMaskPixelsOutsideExhibitRegion = 0;
for (let y = 0; y < canvas.height; y += 1) {
  for (let x = 0; x < canvas.width; x += 1) {
    const pixel = y * canvas.width + x;
    const offset = pixel * 4;
    if (repairMaskRaw[pixel] > 0 && !contains(exhibitRegion, x, y)) {
      repairMaskPixelsOutsideExhibitRegion += 1;
    }
    if (repairMaskRaw[pixel] > 0) continue;
    if (
      immutableRaw[offset] !== curatedRaw[offset] ||
      immutableRaw[offset + 1] !== curatedRaw[offset + 1] ||
      immutableRaw[offset + 2] !== curatedRaw[offset + 2] ||
      immutableRaw[offset + 3] !== curatedRaw[offset + 3]
    ) outsideRepairDifferencePixels += 1;
  }
}
if (outsideRepairDifferencePixels !== 0 || repairMaskPixelsOutsideExhibitRegion !== 0) {
  throw new Error(
    `Gallery repair changed ${outsideRepairDifferencePixels} pixels outside its mask and placed ${repairMaskPixelsOutsideExhibitRegion} mask pixels outside the exhibit region.`
  );
}

const apertureMaskRaw = maskFor(placement.apertureBounds);
const apertureMaskPng = await sharp(apertureMaskRaw, {
  raw: { width: canvas.width, height: canvas.height, channels: 1 }
}).png().toBuffer();
await writeFile(resolve(deliveryRoot, `${placement.apertureMaskId}.png`), apertureMaskPng);

const shellRaw = Buffer.from(curatedRaw);
let shellTransparencyMismatchPixels = 0;
for (let y = 0; y < canvas.height; y += 1) {
  for (let x = 0; x < canvas.width; x += 1) {
    const offset = (y * canvas.width + x) * 4;
    const isAperture = contains(placement.apertureBounds, x, y);
    if (isAperture) shellRaw[offset + 3] = 0;
    if ((isAperture && shellRaw[offset + 3] !== 0) || (!isAperture && shellRaw[offset + 3] !== curatedRaw[offset + 3])) {
      shellTransparencyMismatchPixels += 1;
    }
  }
}
if (shellTransparencyMismatchPixels !== 0) {
  throw new Error(`Gallery shell has ${shellTransparencyMismatchPixels} pixels outside its aperture contract.`);
}
const shellPng = await sharp(shellRaw, {
  raw: { width: canvas.width, height: canvas.height, channels: 4 }
}).png().toBuffer();
await writeFile(resolve(deliveryRoot, 'gallery-frame-shell.png'), shellPng);

const proxyFitted = await sharp(proxyBuffer)
  .resize({
    width: placement.apertureBounds.width,
    height: placement.apertureBounds.height,
    fit: 'inside'
  })
  .ensureAlpha()
  .png()
  .toBuffer();
const proxyFittedImage = sharp(proxyFitted).ensureAlpha();
const proxyFittedMetadata = await proxyFittedImage.metadata();
if (
  proxyFittedMetadata.width !== placement.apertureBounds.width ||
  proxyFittedMetadata.height !== placement.apertureBounds.height
) {
  throw new Error('Matched wall proxy did not resolve to the exact aperture dimensions.');
}
const proxyFittedRaw = await proxyFittedImage.raw().toBuffer();
let transparentProxyPixels = 0;
for (let pixel = 0; pixel < placement.apertureBounds.width * placement.apertureBounds.height; pixel += 1) {
  if (proxyFittedRaw[pixel * 4 + 3] !== 255) transparentProxyPixels += 1;
}
if (transparentProxyPixels !== 0) {
  throw new Error(`Gallery wall proxy leaves ${transparentProxyPixels} transparent aperture pixels.`);
}

const transparentCanvas = {
  create: {
    width: canvas.width,
    height: canvas.height,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 }
  }
};
const proxyLayerPng = await sharp(transparentCanvas)
  .composite([{
    input: proxyFitted,
    left: placement.apertureBounds.x,
    top: placement.apertureBounds.y
  }])
  .png()
  .toBuffer();
await writeFile(resolve(deliveryRoot, 'gallery-artwork-proxies.png'), proxyLayerPng);

const fallbackPng = await sharp(curatedMasterBuffer)
  .composite([{
    input: proxyFitted,
    left: placement.apertureBounds.x,
    top: placement.apertureBounds.y
  }])
  .png()
  .toBuffer();
await writeFile(resolve(proofRoot, 'gallery-approved-composite.png'), fallbackPng);

const fallbackRaw = await sharp(fallbackPng).ensureAlpha().raw().toBuffer();
let outsideApertureDifferencePixels = 0;
for (let y = 0; y < canvas.height; y += 1) {
  for (let x = 0; x < canvas.width; x += 1) {
    if (contains(placement.apertureBounds, x, y)) continue;
    const offset = (y * canvas.width + x) * 4;
    if (
      fallbackRaw[offset] !== curatedRaw[offset] ||
      fallbackRaw[offset + 1] !== curatedRaw[offset + 1] ||
      fallbackRaw[offset + 2] !== curatedRaw[offset + 2] ||
      fallbackRaw[offset + 3] !== curatedRaw[offset + 3]
    ) outsideApertureDifferencePixels += 1;
  }
}
if (outsideApertureDifferencePixels !== 0) {
  throw new Error(`Gallery composite changed ${outsideApertureDifferencePixels} pixels outside the painting aperture.`);
}

await Promise.all([
  sharp(immutableMasterBuffer)
    .composite([{ input: curatedMasterBuffer, blend: 'difference' }])
    .normalise()
    .png()
    .toFile(resolve(proofRoot, 'gallery-sparse-curation-v4-amplified-difference.png')),
  sharp(curatedMasterBuffer)
    .composite([{ input: fallbackPng, blend: 'difference' }])
    .normalise()
    .png()
    .toFile(resolve(proofRoot, 'gallery-amplified-difference.png'))
]);

for (const width of [1254, 1672]) {
  await Promise.all([
    resizedWebp(curatedMasterBuffer, resolve(deliveryRoot, `castle-gallery-base-${width}.webp`), width),
    resizedWebp(fallbackPng, resolve(deliveryRoot, `castle-gallery-fallback-${width}.webp`), width),
    resizedWebp(shellPng, resolve(deliveryRoot, `castle-gallery-shell-${width}.webp`), width),
    resizedWebp(proxyLayerPng, resolve(deliveryRoot, `castle-gallery-proxy-${width}.webp`), width)
  ]);
}

for (const width of [724, 1448]) {
  await Promise.all([
    resizedWebp(artBuffer, resolve(artDeliveryRoot, `still-life-with-wisteria-${width}.webp`), width, { quality: 92 }),
    resizedWebp(proxyBuffer, resolve(artDeliveryRoot, `still-life-with-wisteria-proxy-${width}.webp`), width)
  ]);
}

const manifest = {
  schemaVersion: 3,
  sceneId: 'castle-gallery-wall',
  mode: 'curated-exhibit',
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
  composition: {
    version: 1,
    hash: '29f09b5ce3d98807ba114bfcdbc6539377aa81ce33114ee2e2619ea93aec1c9c',
    exhibitRegion,
    normalizedExhibitRegion,
    layerOrder: ['base', 'artwork-proxies', 'foreground-support-shell', 'hotspots'],
    emptySupports,
    placements: [{
      ...placement,
      revelationMode: 'self-revealing',
      normalizedFrameBounds: normalized(placement.frameBounds),
      normalizedApertureBounds: normalized(placement.apertureBounds),
      mask: `${placement.apertureMaskId}.png`,
      canonicalArtwork: {
        source: 'assets/cinematic/art-pieces/still-life-with-wisteria/source/still-life-with-wisteria-v1.png',
        width: artMetadata.width,
        height: artMetadata.height,
        sha256: sha256(artBuffer)
      },
      proxy: {
        source: 'assets/cinematic/art-pieces/still-life-with-wisteria/source/proxy/still-life-with-wisteria-wall-proxy-v1.png',
        layer: 'gallery-artwork-proxies.png',
        sha256: sha256(proxyBuffer),
        transparentPixelsInsideAperture: transparentProxyPixels
      },
      aspectRatioError: geometryValidation.ratioError,
      aspectRatioTolerance: MATCHED_FRAME_ASPECT_TOLERANCE,
      minimumApertureShortSide: MATCHED_FRAME_MIN_SHORT_SIDE
    }]
  },
  repair: {
    immutableMaster: 'source/castle-gallery-master-v3.png',
    immutableMasterSha256: sha256(immutableMasterBuffer),
    donor: 'source/repairs/gallery-sparse-curation-v4-donor.png',
    donorSha256: sha256(repairDonorBuffer),
    prompt: 'source/repairs/gallery-sparse-curation-v4-prompt.md',
    promptSha256: sha256(repairPromptBuffer),
    mask: 'source/repairs/gallery-sparse-curation-v4-repair-mask.png',
    maskSha256: sha256(repairMaskPng),
    repairClusters,
    protectedSupportAssemblies,
    outsideRepairDifferencePixels,
    repairMaskPixelsOutsideExhibitRegion
  },
  protectedPixels: {
    outsideExhibitRegion: true,
    outsideApertures: true,
    shellTransparencyMismatchPixels,
    outsideApertureDifferencePixels,
    outsideRepairDifferencePixels,
    repairMaskPixelsOutsideExhibitRegion
  },
  source: {
    master: 'source/castle-gallery-master-v4.png',
    masterSha256: sha256(curatedMasterBuffer)
  }
};
await writeFile(
  resolve(deliveryRoot, 'gallery-layer-manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`
);

console.log(
  `Built Castle Gallery curated composition v1 with ${outsideRepairDifferencePixels} changed pixels outside the repair mask, ${repairMaskPixelsOutsideExhibitRegion} mask pixels outside the exhibit region, ${outsideApertureDifferencePixels} composite changes outside the painting aperture, ${shellTransparencyMismatchPixels} shell mismatches, and ${transparentProxyPixels} uncovered proxy pixels.`
);
