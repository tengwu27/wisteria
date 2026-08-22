import { mkdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const sceneRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(sceneRoot, 'source/coffee-factory-approved.png');
const output = resolve(sceneRoot, 'delivery/coffee-factory-approved.webp');
const expected = { width: 1672, height: 941 };

const image = sharp(source);
const metadata = await image.metadata();
if (metadata.width !== expected.width || metadata.height !== expected.height) {
  throw new Error(
    `Expected approved artwork at ${expected.width}x${expected.height}, got ${metadata.width}x${metadata.height}`
  );
}

await mkdir(dirname(output), { recursive: true });
await image
  .webp({ quality: 86, effort: 6, smartSubsample: true })
  .toFile(output);

console.log(`Wrote delivery/coffee-factory-approved.webp (${(await stat(output)).size} bytes)`);
