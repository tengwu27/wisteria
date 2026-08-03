import { readdir, readFile, stat } from 'node:fs/promises';
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
  const deferredImages = html.match(/<img\b[^>]*\sdata-src=[^>]*>/g) ?? [];
  const stylesheetPaths = [
    ...html.matchAll(/href=["']([^"']+\.css)["']/g)
  ].map((match) => match[1]);
  const stylesheets = await Promise.all(
    stylesheetPaths.map((href) =>
      readFile(resolve('dist', href.replace(/^\//, '')), 'utf8')
    )
  );
  // Astro may inline small route-specific styles, so audit both the document
  // and every linked stylesheet as one effective CSS payload.
  const routeCss = [html, ...stylesheets].join('\n');

  if (!routeCss.includes('/fonts/wisteria-immersive-ui.woff2')) {
    failures.push(`${label}: compact immersive font is not registered`);
  }
  if (
    routeCss.includes('zcool-kuaile-chinese-simplified') ||
    routeCss.includes('lxgwwenkai-regular-subset') ||
    routeCss.includes('lxgwwenkai-bold-subset')
  ) {
    failures.push(`${label}: editorial font bundle leaked into immersive route`);
  }

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

  for (const image of deferredImages) {
    if (/\ssrc=/.test(image)) {
      failures.push(`${label}: deferred layer image has an eager src attribute`);
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

const immersiveFontPath = resolve(
  'public/fonts/wisteria-immersive-ui.woff2'
);
if ((await stat(immersiveFontPath)).size > 32 * 1024) {
  failures.push('immersive UI font exceeds 32 KiB');
}

const village = await readFile(resolve('dist/index.html'), 'utf8');
if (/<link\b[^>]*welcome-to-wisteria\.(?:png|webp)/.test(village)) {
  failures.push('village: welcome artwork is unconditionally preloaded');
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

const deliveryRoots = [
  'public/media/living-room/parallax',
  'public/media/cafe-gallery/parallax',
  'public/media/car-interior/parallax',
  'public/media/garage-workshop/parallax'
];
for (const root of deliveryRoots) {
  for (const path of await walk(root)) {
    if (path.endsWith('.png') || path.endsWith('layers.json')) {
      failures.push(`${path}: authoring asset remains in the public tree`);
    }
    if (path.endsWith('.webp') && (await stat(path)).size > 1024 * 1024) {
      failures.push(`${path}: delivery image exceeds 1 MiB`);
    }
  }
}

for (const path of await walk('public/media')) {
  if (path.endsWith('-poster.jpg')) {
    failures.push(`${path}: superseded JPEG poster remains public`);
  }
  if (
    path.includes('/transitions/') &&
    path.endsWith('.mp4') &&
    (await stat(path)).size > 7 * 1024 * 1024
  ) {
    failures.push(`${path}: transition delivery exceeds 7 MiB`);
  }
}
if (/<img\b[^>]*data-welcome-logo[^>]*\ssrc=/.test(village)) {
  failures.push('village: welcome artwork has an eager src attribute');
}

const netlifyConfig = await readFile(resolve('netlify.toml'), 'utf8');
const cacheContracts = [
  {
    label: 'hashed Astro assets',
    pattern:
      /for\s*=\s*["']\/_astro\/\*["'][\s\S]*?Cache-Control\s*=\s*["'][^"']*max-age=31536000[^"']*immutable[^"']*["']/
  },
  {
    label: 'cinematic media',
    pattern:
      /for\s*=\s*["']\/media\/\*["'][\s\S]*?Cache-Control\s*=\s*["'][^"']*max-age=604800[^"']*stale-while-revalidate=2592000[^"']*["']/
  },
  {
    label: 'immersive fonts',
    pattern:
      /for\s*=\s*["']\/fonts\/\*["'][\s\S]*?Cache-Control\s*=\s*["'][^"']*max-age=604800[^"']*stale-while-revalidate=2592000[^"']*["']/
  }
];
for (const contract of cacheContracts) {
  if (!contract.pattern.test(netlifyConfig)) {
    failures.push(`${contract.label}: production cache contract is missing`);
  }
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
