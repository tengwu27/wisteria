import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const routes = [
  ['village', 'dist/index.html'],
  ['living room', 'dist/lifestyle/index.html'],
  ['cafe gallery', 'dist/art/index.html'],
  ['car interior', 'dist/travel/index.html'],
  ['garage', 'dist/garage/index.html']
];

const failures = [];

for (const [label, relativePath] of routes) {
  const path = resolve(relativePath);
  const html = await readFile(path, 'utf8');
  const videos = html.match(/<video\b[^>]*>/g) ?? [];

  for (const video of videos) {
    if (/\ssrc=/.test(video)) {
      failures.push(`${label}: video has an eager src attribute`);
    }
    if (/\sposter=/.test(video)) {
      failures.push(`${label}: video has an eager poster attribute`);
    }
    if (/\spreload=["']auto["']/.test(video)) {
      failures.push(`${label}: video uses preload=auto`);
    }
  }

  if (label !== 'village') {
    const exits = videos.filter((video) =>
      video.includes('data-exit-video')
    );
    if (exits.length !== 1) {
      failures.push(
        `${label}: expected one reusable exit video, found ${exits.length}`
      );
    }
  }
}

const village = await readFile(resolve('dist/index.html'), 'utf8');
if (/<link\b[^>]*welcome-to-wisteria\.png/.test(village)) {
  failures.push('village: welcome artwork is unconditionally preloaded');
}
if (/<img\b[^>]*data-welcome-logo[^>]*\ssrc=/.test(village)) {
  failures.push('village: welcome artwork has an eager src attribute');
}

if (failures.length > 0) {
  console.error('Cinematic loading audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `Cinematic loading audit passed for ${routes.length} immersive routes.`
  );
}
