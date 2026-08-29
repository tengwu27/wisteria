import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

import {
  MATCHED_FRAME_ASPECT_TOLERANCE,
  MATCHED_FRAME_MIN_SHORT_SIDE,
  validateMatchedFrameGeometry
} from '../../../../../scripts/assets/frame-geometry.mjs';

const sceneRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const projectRoot = resolve(sceneRoot, '../../../..');
const artRoot = resolve(projectRoot, 'assets/cinematic/art-pieces/still-life-with-wisteria');
const immutableMasterPath = resolve(sceneRoot, 'source/castle-gallery-master-v2.png');
const repairedMasterPath = resolve(sceneRoot, 'source/castle-gallery-master-v3.png');
const repairDonorPath = resolve(sceneRoot, 'source/repairs/gallery-center-frame-v3-donor.png');
const repairMaskPath = resolve(sceneRoot, 'source/repairs/gallery-center-frame-v3-repair-mask.png');
const artPath = resolve(artRoot, 'source/still-life-with-wisteria-v1.png');
const proxyPath = resolve(artRoot, 'source/proxy/still-life-with-wisteria-wall-proxy-v1.png');
const deliveryRoot = resolve(sceneRoot, 'delivery');
const artDeliveryRoot = resolve(artRoot, 'delivery');
const proofRoot = resolve(sceneRoot, 'proofs');

const canvas = { width: 1672, height: 941 };
const frameEnvelopes = {
  'gallery-left-frame': { x: 386, y: 317, width: 154, height: 227 },
  'gallery-center-frame': { x: 612, y: 272, width: 450, height: 288 },
  'gallery-right-frame': { x: 1132, y: 317, width: 154, height: 227 }
};
const frames = {
  'gallery-left-frame': { ...frameEnvelopes['gallery-left-frame'] },
  'gallery-center-frame': { x: 636, y: 272, width: 400, height: 288 },
  'gallery-right-frame': { ...frameEnvelopes['gallery-right-frame'] }
};
const apertures = {
  'gallery-left-frame': { x: 407, y: 338, width: 112, height: 204 },
  'gallery-center-frame': { x: 658, y: 292, width: 356, height: 267 },
  'gallery-right-frame': { x: 1153, y: 338, width: 112, height: 204 }
};
const centerArtwork = { ...apertures['gallery-center-frame'] };
const repairContext = { x: 560, y: 220, width: 552, height: 410 };
const repairOwnership = { x: 575, y: 225, width: 522, height: 400 };

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
  return x >= bounds.x && x < bounds.x + bounds.width && y >= bounds.y && y < bounds.y + bounds.height;
}

function isMagenta(raw, offset) {
  return raw[offset] > 220 && raw[offset + 2] > 180 && raw[offset + 1] < 40;
}

function isChromaFringe(raw, offset) {
  const red = raw[offset];
  const green = raw[offset + 1];
  const blue = raw[offset + 2];
  return red > 80 && blue > 60 && red > green * 1.7 && blue > green * 1.3;
}

function chromaBounds(raw, width, height, channels) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let pixels = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * channels;
      if (!isMagenta(raw, offset)) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      pixels += 1;
    }
  }
  if (!pixels) throw new Error('The Gallery frame donor has no chroma aperture.');
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1, maxX, maxY, pixels };
}

async function registerRepairDonor(donorBuffer) {
  const donor = await sharp(donorBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const sourceChroma = chromaBounds(donor.data, donor.info.width, donor.info.height, donor.info.channels);
  const scale = centerArtwork.height / sourceChroma.height;
  const resizedHeight = Math.round(donor.info.height * scale);
  const resizedBuffer = await sharp(donorBuffer)
    .resize({ height: resizedHeight, withoutEnlargement: true })
    .ensureAlpha()
    .png()
    .toBuffer();
  const resized = await sharp(resizedBuffer).raw().toBuffer({ resolveWithObject: true });
  const resizedChroma = chromaBounds(resized.data, resized.info.width, resized.info.height, resized.info.channels);
  const targetCenterX = centerArtwork.x + centerArtwork.width / 2;
  const donorCenterX = resizedChroma.x + resizedChroma.width / 2;
  const left = Math.round(targetCenterX - donorCenterX);
  const top = centerArtwork.y - resizedChroma.y;
  const registeredPng = await sharp({
    create: { width: canvas.width, height: canvas.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  })
    .composite([{ input: resizedBuffer, left, top }])
    .png()
    .toBuffer();
  const registered = await sharp(registeredPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const registeredChroma = chromaBounds(registered.data, registered.info.width, registered.info.height, registered.info.channels);
  const repairedRaw = Buffer.from(registered.data);
  const targetRight = centerArtwork.x + centerArtwork.width - 1;
  const targetBottom = centerArtwork.y + centerArtwork.height - 1;

  for (let y = registeredChroma.y; y <= registeredChroma.maxY; y += 1) {
    for (let x = registeredChroma.x; x <= registeredChroma.maxX; x += 1) {
      const offset = (y * canvas.width + x) * 4;
      if (contains(centerArtwork, x, y)) continue;
      let sourceX = x;
      let sourceY = y;
      if (x < centerArtwork.x) sourceX = registeredChroma.x - (centerArtwork.x - x);
      else if (x > targetRight) sourceX = registeredChroma.maxX + (x - targetRight);
      else if (y < centerArtwork.y) sourceY = registeredChroma.y - (centerArtwork.y - y);
      else if (y > targetBottom) sourceY = registeredChroma.maxY + (y - targetBottom);
      sourceX = Math.max(0, Math.min(canvas.width - 1, sourceX));
      sourceY = Math.max(0, Math.min(canvas.height - 1, sourceY));
      const sourceOffset = (sourceY * canvas.width + sourceX) * 4;
      repairedRaw.copy(repairedRaw, offset, sourceOffset, sourceOffset + 4);
    }
  }

  // Image-generation chroma edges are antialiased, so strict keying alone leaves
  // a narrow purple fringe just outside the measured opening. Replace only those
  // keyed fringe pixels from the adjacent frame trim; the exact aperture remains
  // owned by the artwork layer and is never sampled or repainted here.
  const fringe = 8;
  const band = {
    x: centerArtwork.x - fringe,
    y: centerArtwork.y - fringe,
    width: centerArtwork.width + fringe * 2,
    height: centerArtwork.height + fringe * 2
  };
  for (let y = band.y; y < band.y + band.height; y += 1) {
    for (let x = band.x; x < band.x + band.width; x += 1) {
      if (contains(centerArtwork, x, y)) continue;
      const offset = (y * canvas.width + x) * 4;
      if (!isChromaFringe(repairedRaw, offset)) continue;
      let sourceX = x;
      let sourceY = y;
      if (x < centerArtwork.x) sourceX = centerArtwork.x - fringe - 1 - (centerArtwork.x - 1 - x);
      else if (x > targetRight) sourceX = targetRight + fringe + 1 + (x - targetRight - 1);
      if (y < centerArtwork.y) sourceY = centerArtwork.y - fringe - 1 - (centerArtwork.y - 1 - y);
      else if (y > targetBottom) sourceY = targetBottom + fringe + 1 + (y - targetBottom - 1);
      const sourceOffset = (sourceY * canvas.width + sourceX) * 4;
      repairedRaw.copy(repairedRaw, offset, sourceOffset, sourceOffset + 4);
    }
  }

  return {
    png: await sharp(repairedRaw, { raw: { width: canvas.width, height: canvas.height, channels: 4 } }).png().toBuffer(),
    sourceChroma,
    registeredChroma,
    scale,
    offset: { x: left, y: top }
  };
}

async function buildRepairMask() {
  const binary = maskFor(repairOwnership);
  const blurred = await sharp(binary, { raw: { width: canvas.width, height: canvas.height, channels: 1 } })
    .blur(4)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const softened = Buffer.alloc(canvas.width * canvas.height);
  for (let pixel = 0; pixel < softened.length; pixel += 1) {
    softened[pixel] = blurred.data[pixel * blurred.info.channels];
  }
  for (let y = centerArtwork.y; y < centerArtwork.y + centerArtwork.height; y += 1) {
    softened.fill(0, y * canvas.width + centerArtwork.x, y * canvas.width + centerArtwork.x + centerArtwork.width);
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

const [immutableMasterBuffer, repairDonorBuffer, artBuffer, proxyBuffer] = await Promise.all([
  readFile(immutableMasterPath),
  readFile(repairDonorPath),
  readFile(artPath),
  readFile(proxyPath)
]);
const [masterMetadata, artMetadata, proxyMetadata] = await Promise.all([
  sharp(immutableMasterBuffer).metadata(),
  sharp(artBuffer).metadata(),
  sharp(proxyBuffer).metadata()
]);
if (masterMetadata.width !== canvas.width || masterMetadata.height !== canvas.height) {
  throw new Error(`Gallery master must remain ${canvas.width}x${canvas.height}.`);
}
if (!artMetadata.width || !artMetadata.height || !proxyMetadata.width || !proxyMetadata.height) {
  throw new Error('Gallery artwork and wall proxy dimensions are required.');
}

const geometryValidation = validateMatchedFrameGeometry({
  source: { width: artMetadata.width, height: artMetadata.height },
  aperture: centerArtwork,
  frame: frames['gallery-center-frame'],
  envelope: frameEnvelopes['gallery-center-frame']
});
if (geometryValidation.errors.length) throw new Error(geometryValidation.errors.join(' '));

const registeredDonor = await registerRepairDonor(repairDonorBuffer);
const repairMaskRaw = await buildRepairMask();
const repairMaskPng = await sharp(repairMaskRaw, { raw: { width: canvas.width, height: canvas.height, channels: 1 } }).png().toBuffer();
await writeFile(repairMaskPath, repairMaskPng);

const registeredDonorRaw = await sharp(registeredDonor.png).ensureAlpha().raw().toBuffer();
for (let pixel = 0; pixel < canvas.width * canvas.height; pixel += 1) {
  registeredDonorRaw[pixel * 4 + 3] = Math.min(registeredDonorRaw[pixel * 4 + 3], repairMaskRaw[pixel]);
}
const maskedDonorPng = await sharp(registeredDonorRaw, { raw: { width: canvas.width, height: canvas.height, channels: 4 } }).png().toBuffer();
const repairedMasterBuffer = await sharp(immutableMasterBuffer).composite([{ input: maskedDonorPng }]).png().toBuffer();
await writeFile(repairedMasterPath, repairedMasterBuffer);

const [immutableRaw, repairedRaw] = await Promise.all([
  sharp(immutableMasterBuffer).ensureAlpha().raw().toBuffer(),
  sharp(repairedMasterBuffer).ensureAlpha().raw().toBuffer()
]);
let outsideRepairDifferencePixels = 0;
for (let pixel = 0; pixel < canvas.width * canvas.height; pixel += 1) {
  if (repairMaskRaw[pixel] > 0) continue;
  const offset = pixel * 4;
  if (
    immutableRaw[offset] !== repairedRaw[offset] ||
    immutableRaw[offset + 1] !== repairedRaw[offset + 1] ||
    immutableRaw[offset + 2] !== repairedRaw[offset + 2] ||
    immutableRaw[offset + 3] !== repairedRaw[offset + 3]
  ) outsideRepairDifferencePixels += 1;
}
if (outsideRepairDifferencePixels !== 0) {
  throw new Error(`Gallery repair changed ${outsideRepairDifferencePixels} pixels outside its mask.`);
}

for (const [id, bounds] of Object.entries(apertures)) {
  await sharp(maskFor(bounds), { raw: { width: canvas.width, height: canvas.height, channels: 1 } })
    .png()
    .toFile(resolve(deliveryRoot, `${id}-mask.png`));
}

const masterRaw = Buffer.from(repairedRaw);
const shellRaw = Buffer.from(masterRaw);
let shellTransparencyMismatchPixels = 0;
for (let y = 0; y < canvas.height; y += 1) {
  for (let x = 0; x < canvas.width; x += 1) {
    const offset = (y * canvas.width + x) * 4;
    const isAperture = Object.values(apertures).some((bounds) => contains(bounds, x, y));
    if (isAperture) shellRaw[offset + 3] = 0;
    if ((isAperture && shellRaw[offset + 3] !== 0) || (!isAperture && shellRaw[offset + 3] !== masterRaw[offset + 3])) {
      shellTransparencyMismatchPixels += 1;
    }
  }
}
if (shellTransparencyMismatchPixels !== 0) {
  throw new Error(`Gallery shell has ${shellTransparencyMismatchPixels} pixels outside its exact aperture contract.`);
}
const shellPng = await sharp(shellRaw, { raw: { width: canvas.width, height: canvas.height, channels: 4 } }).png().toBuffer();
await writeFile(resolve(deliveryRoot, 'gallery-frame-shell.png'), shellPng);

const proxyFitted = await sharp(proxyBuffer)
  .resize({ width: centerArtwork.width, height: centerArtwork.height, fit: 'inside' })
  .ensureAlpha()
  .png()
  .toBuffer();
const proxyFittedImage = sharp(proxyFitted).ensureAlpha();
const proxyFittedMetadata = await proxyFittedImage.metadata();
if (proxyFittedMetadata.width !== centerArtwork.width || proxyFittedMetadata.height !== centerArtwork.height) {
  throw new Error('Matched wall proxy did not resolve to the exact aperture dimensions.');
}
const proxyFittedRaw = await proxyFittedImage.raw().toBuffer();
let transparentProxyPixels = 0;
for (let pixel = 0; pixel < centerArtwork.width * centerArtwork.height; pixel += 1) {
  if (proxyFittedRaw[pixel * 4 + 3] !== 255) transparentProxyPixels += 1;
}
if (transparentProxyPixels !== 0) {
  throw new Error(`Gallery wall proxy leaves ${transparentProxyPixels} transparent aperture pixels.`);
}

const transparentCanvas = {
  create: { width: canvas.width, height: canvas.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
};
const proxyLayerPng = await sharp(transparentCanvas)
  .composite([{ input: proxyFitted, left: centerArtwork.x, top: centerArtwork.y }])
  .png()
  .toBuffer();
await writeFile(resolve(deliveryRoot, 'gallery-center-proxy-layer.png'), proxyLayerPng);

const fallbackPng = await sharp(repairedMasterBuffer)
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
    ) outsideDifferencePixels += 1;
  }
}
if (outsideDifferencePixels !== 0) {
  throw new Error(`Gallery composite changed ${outsideDifferencePixels} pixels outside the center aperture.`);
}

await Promise.all([
  sharp(repairedMasterBuffer)
    .extract({ left: repairContext.x, top: repairContext.y, width: repairContext.width, height: repairContext.height })
    .png()
    .toFile(resolve(proofRoot, 'gallery-center-frame-v3-composite-crop.png')),
  sharp(registeredDonor.png)
    .extract({ left: repairContext.x, top: repairContext.y, width: repairContext.width, height: repairContext.height })
    .png()
    .toFile(resolve(proofRoot, 'gallery-center-frame-v3-donor-registered.png')),
  sharp(immutableMasterBuffer)
    .composite([{ input: repairedMasterBuffer, blend: 'difference' }])
    .normalise()
    .png()
    .toFile(resolve(proofRoot, 'gallery-frame-repair-amplified-difference.png')),
  sharp(repairedMasterBuffer)
    .composite([{ input: fallbackPng, blend: 'difference' }])
    .normalise()
    .png()
    .toFile(resolve(proofRoot, 'gallery-amplified-difference.png'))
]);

for (const width of [1254, 1672]) {
  await Promise.all([
    resizedWebp(repairedMasterBuffer, resolve(deliveryRoot, `castle-gallery-base-${width}.webp`), width),
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
  schemaVersion: 2,
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
    Object.entries(apertures).map(([id, bounds]) => [id, {
      frameEnvelopeBounds: frameEnvelopes[id],
      frameBounds: frames[id],
      bounds,
      normalizedFrameEnvelopeBounds: normalized(frameEnvelopes[id]),
      normalizedFrameBounds: normalized(frames[id]),
      normalizedBounds: normalized(bounds),
      mask: `${id}-mask.png`,
      aspectPolicy: 'match-source-frame'
    }])
  ),
  occupied: {
    'gallery-center-frame': {
      wisteriaId: 'still-life-with-wisteria',
      artworkBounds: centerArtwork,
      normalizedArtworkBounds: normalized(centerArtwork),
      sourceDimensions: { width: artMetadata.width, height: artMetadata.height },
      aspectRatioError: geometryValidation.ratioError,
      aspectRatioTolerance: MATCHED_FRAME_ASPECT_TOLERANCE,
      minimumApertureShortSide: MATCHED_FRAME_MIN_SHORT_SIDE,
      transparentProxyPixels,
      sourceSha256: sha256(artBuffer),
      proxySha256: sha256(proxyBuffer)
    }
  },
  repair: {
    immutableMaster: 'source/castle-gallery-master-v2.png',
    donor: 'source/repairs/gallery-center-frame-v3-donor.png',
    mask: 'source/repairs/gallery-center-frame-v3-repair-mask.png',
    contextBounds: repairContext,
    ownershipBounds: repairOwnership,
    donorUniformScale: registeredDonor.scale,
    donorOffset: registeredDonor.offset,
    donorSourceChromaBounds: registeredDonor.sourceChroma,
    donorRegisteredChromaBounds: registeredDonor.registeredChroma,
    outsideRepairDifferencePixels
  },
  protectedPixels: {
    outsideApertures: true,
    shellTransparencyMismatchPixels,
    outsideDifferencePixels,
    outsideRepairDifferencePixels
  },
  source: {
    master: 'source/castle-gallery-master-v3.png',
    masterSha256: sha256(repairedMasterBuffer),
    immutableMaster: 'source/castle-gallery-master-v2.png',
    immutableMasterSha256: sha256(immutableMasterBuffer)
  }
};
await writeFile(resolve(deliveryRoot, 'gallery-layer-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(
  `Built Castle Gallery matched-frame bundle with ${outsideRepairDifferencePixels} changed pixels outside the repair mask, ${outsideDifferencePixels} outside the artwork aperture, ${shellTransparencyMismatchPixels} shell-mask mismatches, and ${transparentProxyPixels} uncovered proxy pixels.`
);
