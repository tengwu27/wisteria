import { mkdir, rm, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const sceneRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const deliveryRoot = resolve(sceneRoot, 'delivery');
const expected = { width: 1672, height: 941 };
const scenes = [
  { id: 'gate', source: 'source/approved/castle-gate-approved.png' },
  { id: 'courtyard', source: 'source/approved/castle-courtyard-approved.png' },
  { id: 'arcade', source: 'source/approved/castle-arcade-approved.png' }
];
const variants = [
  { width: 1254, quality: 82 },
  { width: 1672, quality: 86 }
];

await rm(deliveryRoot, { recursive: true, force: true });
await mkdir(deliveryRoot, { recursive: true });

for (const scene of scenes) {
  const source = resolve(sceneRoot, scene.source);
  const metadata = await sharp(source).metadata();
  if (metadata.width !== expected.width || metadata.height !== expected.height) {
    throw new Error(
      `Expected ${scene.id} artwork at ${expected.width}x${expected.height}, got ${metadata.width}x${metadata.height}`
    );
  }

  for (const variant of variants) {
    const height = Math.round(variant.width * expected.height / expected.width);
    const output = resolve(
      deliveryRoot,
      `castle-${scene.id}-${variant.width}.webp`
    );
    await sharp(source)
      .resize(variant.width, height, {
        fit: 'fill',
        kernel: sharp.kernel.lanczos3
      })
      .webp({
        quality: variant.quality,
        effort: 6,
        smartSubsample: true
      })
      .toFile(output);
    console.log(
      `Wrote delivery/${output.split('/').at(-1)} (${(await stat(output)).size} bytes)`
    );
  }
}
