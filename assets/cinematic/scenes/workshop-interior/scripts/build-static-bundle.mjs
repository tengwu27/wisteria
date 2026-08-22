import { mkdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const sceneRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(sceneRoot, 'source/workshop-refined-2x.png');
const expected = { width: 3344, height: 1882 };
const variants = [
  { width: 1672, quality: 86 },
  { width: 2508, quality: 70 },
  { width: 3072, quality: 58 }
];

const image = sharp(source);
const metadata = await image.metadata();
if (metadata.width !== expected.width || metadata.height !== expected.height) {
  throw new Error(
    `Expected approved artwork at ${expected.width}x${expected.height}, got ${metadata.width}x${metadata.height}`
  );
}

for (const variant of variants) {
  const output = resolve(sceneRoot, `delivery/workshop-${variant.width}.webp`);
  await mkdir(dirname(output), { recursive: true });
  await image
    .clone()
    .resize({ width: variant.width })
    .webp({ quality: variant.quality, effort: 6, smartSubsample: true })
    .toFile(output);
  console.log(`Wrote delivery/workshop-${variant.width}.webp (${(await stat(output)).size} bytes)`);
}
