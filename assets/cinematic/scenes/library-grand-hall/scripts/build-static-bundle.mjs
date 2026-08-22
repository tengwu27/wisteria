import { mkdir, rm, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const sceneRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const master = resolve(sceneRoot, 'source/library-grand-hall-full-tile-v3.png');
const deliveryRoot = resolve(sceneRoot, 'delivery');
const proofRoot = resolve(sceneRoot, 'proofs');

const hall = {
  expected: { width: 4096, height: 1536 },
  variants: [
    { width: 2048, height: 768, quality: 84 },
    { width: 3072, height: 1152, quality: 80 },
    { width: 4096, height: 1536, quality: 76 }
  ]
};

const focusPlates = [
  {
    id: 'shelf',
    outputStem: 'shelf-close',
    source: resolve(sceneRoot, 'source/library-shelf-close-v1.png'),
    arrangementReference: resolve(
      sceneRoot,
      'source/library-shelf-focus-refined.png'
    ),
    registration: {
      kind: 'independent-viewpoint',
      sourceZone: { x: 0.135, y: 0.34, width: 0.235, height: 0.39 }
    },
    expected: { width: 1672, height: 941 }
  },
  {
    id: 'table',
    outputStem: 'table-over-chair',
    source: resolve(sceneRoot, 'source/library-table-over-chair-v1.png'),
    arrangementReference: resolve(
      sceneRoot,
      'source/library-table-focus-refined.png'
    ),
    registration: {
      kind: 'independent-viewpoint',
      sourceZone: { x: 0.285, y: 0.56, width: 0.2, height: 0.37 }
    },
    expected: { width: 1672, height: 941 }
  }
];

await assertDimensions(master, hall.expected, 'approved hall master');
for (const plate of focusPlates) {
  await assertDimensions(plate.source, plate.expected, `${plate.id} focus source`);
}

await rm(deliveryRoot, { recursive: true, force: true });
await mkdir(deliveryRoot, { recursive: true });
await mkdir(proofRoot, { recursive: true });

for (const variant of hall.variants) {
  const output = resolve(
    deliveryRoot,
    `library-grand-hall-${variant.width}.webp`
  );

  await sharp(master)
    .resize(variant.width, variant.height, {
      fit: 'fill',
      kernel: sharp.kernel.lanczos3
    })
    .webp({
      quality: variant.quality,
      effort: 6,
      smartSubsample: true
    })
    .toFile(output);

  await report(output);
}

for (const plate of focusPlates) {
  for (const variant of [
    { width: 1254, height: 706, quality: 84 },
    { width: 1672, height: 941, quality: 80 }
  ]) {
    const output = resolve(
      deliveryRoot,
      `library-${plate.outputStem}-${variant.width}.webp`
    );

    await sharp(plate.source)
      .resize(variant.width, variant.height, {
        fit: 'cover',
        position: 'centre',
        kernel: sharp.kernel.lanczos3
      })
      .webp({
        quality: variant.quality,
        effort: 6,
        smartSubsample: true
      })
      .toFile(output);

    await report(output);
  }

  if (plate.registration.kind === 'registered-crop') {
    await writeRegistrationProof(plate);
  } else {
    await writeContinuityProof(plate);
  }
}

async function writeRegistrationProof(plate) {
  const halfWidth = Math.floor(plate.expected.width / 2);
  const proofHeight = Math.floor(plate.expected.height / 2);
  const original = await sharp(master)
    .extract(plate.registration.masterCrop)
    .resize(halfWidth, proofHeight, { fit: 'fill' })
    .jpeg({ quality: 90 })
    .toBuffer();
  const refined = await sharp(plate.source)
    .resize(plate.expected.width - halfWidth, proofHeight, { fit: 'fill' })
    .jpeg({ quality: 90 })
    .toBuffer();

  await sharp({
    create: {
      width: plate.expected.width,
      height: proofHeight,
      channels: 3,
      background: '#101d1b'
    }
  })
    .composite([
      { input: original, left: 0, top: 0 },
      { input: refined, left: halfWidth, top: 0 }
    ])
    .jpeg({ quality: 88, chromaSubsampling: '4:4:4' })
    .toFile(resolve(proofRoot, `library-${plate.id}-registration-contact-sheet.jpg`));
}

async function writeContinuityProof(plate) {
  const panelWidth = Math.floor(plate.expected.width / 3);
  const proofHeight = Math.floor(plate.expected.height / 2);
  const zone = plate.registration.sourceZone;
  const sourceCrop = {
    left: Math.round(zone.x * hall.expected.width),
    top: Math.round(zone.y * hall.expected.height),
    width: Math.round(zone.width * hall.expected.width),
    height: Math.round(zone.height * hall.expected.height)
  };
  const panels = await Promise.all([
    sharp(master).extract(sourceCrop).resize(panelWidth, proofHeight, { fit: 'cover' }).jpeg({ quality: 90 }).toBuffer(),
    sharp(plate.arrangementReference).resize(panelWidth, proofHeight, { fit: 'cover' }).jpeg({ quality: 90 }).toBuffer(),
    sharp(plate.source).resize(plate.expected.width - panelWidth * 2, proofHeight, { fit: 'cover' }).jpeg({ quality: 90 }).toBuffer()
  ]);
  const labels = [
    'HALL ZONE',
    'ARRANGEMENT REFERENCE',
    plate.id === 'table' ? 'NEW OVER-CHAIR VIEW' : 'NEW CLOSE-SHELF VIEW'
  ];
  const labelSvg = Buffer.from(
    `<svg width="${plate.expected.width}" height="${proofHeight}" xmlns="http://www.w3.org/2000/svg">` +
      labels.map((label, index) => `<g transform="translate(${index * panelWidth + 14} 14)"><rect width="${index === 1 ? 210 : 170}" height="28" rx="5" fill="#101d1b" fill-opacity=".88" stroke="#d8ae62"/><text x="10" y="19" font-family="sans-serif" font-size="12" fill="#fff2c8">${label}</text></g>`).join('') +
    `</svg>`
  );

  await sharp({
    create: {
      width: plate.expected.width,
      height: proofHeight,
      channels: 3,
      background: '#101d1b'
    }
  })
    .composite([
      { input: panels[0], left: 0, top: 0 },
      { input: panels[1], left: panelWidth, top: 0 },
      { input: panels[2], left: panelWidth * 2, top: 0 },
      { input: labelSvg, left: 0, top: 0 }
    ])
    .jpeg({ quality: 88, chromaSubsampling: '4:4:4' })
    .toFile(resolve(proofRoot, `library-${plate.id}-continuity-contact-sheet.jpg`));
}

async function assertDimensions(path, expected, label) {
  const metadata = await sharp(path).metadata();
  if (metadata.width !== expected.width || metadata.height !== expected.height) {
    throw new Error(
      `Expected ${label} at ${expected.width}x${expected.height}, got ${metadata.width}x${metadata.height}`
    );
  }
}

async function report(output) {
  console.log(
    `Wrote delivery/${output.split('/').at(-1)} (${(await stat(output)).size} bytes)`
  );
}
