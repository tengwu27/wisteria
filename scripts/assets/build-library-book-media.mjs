import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

const sources = [
  'src/assets/images/art/retro-studio',
  'src/assets/images/lifestyle/retro-morning',
  'src/assets/images/travel/retro-coast-train'
];
const variants = [
  { width: 720, height: 540, quality: 82 },
  { width: 1448, height: 1086, quality: 78 }
];

for (const sourceStem of sources) {
  const source = resolve(`${sourceStem}.png`);
  const metadata = await sharp(source).metadata();
  if (metadata.width !== 1448 || metadata.height !== 1086) {
    throw new Error(
      `${sourceStem}.png must remain registered at 1448x1086; got ${metadata.width}x${metadata.height}`
    );
  }

  for (const variant of variants) {
    const output = resolve(`${sourceStem}-${variant.width}.webp`);
    await sharp(source)
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
    console.log(
      `Wrote ${output.replace(`${process.cwd()}/`, '')} (${(await stat(output)).size} bytes)`
    );
  }
}
