import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { cinematicDeliveryConfig as config } from './cinematic-delivery.config.mjs';

const profileArgument = process.argv.find((argument) =>
  argument.startsWith('--profile=')
);
const profile = profileArgument?.split('=')[1] ?? 'production';
if (!['production', 'prototype'].includes(profile)) {
  console.error(`Unknown cinematic audit profile: ${profile}`);
  process.exit(1);
}

const failures = [];
const warnings = [];
const validPrototypeRoutes = new Set();
let globalPrototypeBypass = false;

if (config.schemaVersion !== 1) {
  failures.push(
    `Unsupported cinematic delivery schema: ${config.schemaVersion}`
  );
}

function validateBypass(label, bypass) {
  if (!bypass || typeof bypass !== 'object') return false;

  const reason = typeof bypass.reason === 'string' ? bypass.reason.trim() : '';
  const expires =
    typeof bypass.expires === 'string' ? bypass.expires.trim() : '';
  const expiration = /^\d{4}-\d{2}-\d{2}$/.test(expires)
    ? new Date(`${expires}T23:59:59.999Z`)
    : null;

  if (reason.length < 8) {
    failures.push(`${label}: performance bypass needs a meaningful reason`);
  }
  if (!expiration || Number.isNaN(expiration.getTime())) {
    failures.push(`${label}: performance bypass needs an ISO expiry date`);
  } else if (expiration.getTime() < Date.now()) {
    failures.push(`${label}: performance bypass expired on ${expires}`);
  }

  return reason.length >= 8 && Boolean(expiration) && expiration >= new Date();
}

const configuredGlobalBypass = config.globalPerformanceBypass;
if (configuredGlobalBypass) {
  globalPrototypeBypass = validateBypass(
    'global cinematic delivery',
    configuredGlobalBypass
  );
  if (profile === 'production') {
    failures.push('global cinematic delivery: active performance bypass');
  }
}

for (const route of config.routes) {
  if (!['production', 'prototype'].includes(route.deliveryStatus)) {
    failures.push(`${route.label}: unknown delivery status`);
    continue;
  }

  const hasValidBypass = validateBypass(
    route.label,
    route.performanceBypass
  );
  if (hasValidBypass) validPrototypeRoutes.add(route.id);

  if (route.deliveryStatus === 'prototype' && !hasValidBypass) {
    failures.push(
      `${route.label}: prototype delivery requires a reason and expiry`
    );
  }
  if (route.deliveryStatus === 'production' && route.performanceBypass) {
    failures.push(`${route.label}: production route cannot carry a bypass`);
  }
  if (profile === 'production' && route.deliveryStatus !== 'production') {
    failures.push(`${route.label}: prototype delivery cannot be deployed`);
  }
  if (profile === 'production' && route.performanceBypass) {
    failures.push(`${route.label}: active performance bypass`);
  }
}

function report(message, route = null, bypassable = true) {
  const canWarn =
    profile === 'prototype' &&
    bypassable &&
    (globalPrototypeBypass ||
      (route !== null && validPrototypeRoutes.has(route.id)));

  (canWarn ? warnings : failures).push(message);
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

async function measureInitialRouteCode(html, htmlPath) {
  const paths = [
    ...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))(?:\?[^"']*)?["']/g)
  ].map((match) => match[1]);
  let bytes = Buffer.byteLength(html);

  for (const path of new Set(paths)) {
    if (/^(?:https?:)?\/\//.test(path)) continue;
    const localPath = resolve('dist', path.replace(/^\//, ''));
    try {
      bytes += (await stat(localPath)).size;
    } catch {
      failures.push(`${htmlPath}: linked code asset is missing: ${path}`);
    }
  }

  return bytes;
}

for (const route of config.routes) {
  const path = resolve(route.html);
  let html;
  try {
    html = await readFile(path, 'utf8');
  } catch {
    failures.push(`${route.label}: built route is missing at ${route.html}`);
    continue;
  }

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
  const routeCss = [html, ...stylesheets].join('\n');
  const initialCodeBytes = await measureInitialRouteCode(html, route.html);

  if (initialCodeBytes > config.budgets.initialRouteCodeBytes) {
    report(
      `${route.label}: initial HTML, CSS, and JavaScript total ${initialCodeBytes} bytes; budget is ${config.budgets.initialRouteCodeBytes}`,
      route
    );
  }

  if (!routeCss.includes('/fonts/wisteria-immersive-ui.woff2')) {
    report(`${route.label}: compact immersive font is not registered`, route);
  }
  if (
    routeCss.includes('zcool-kuaile-chinese-simplified') ||
    routeCss.includes('lxgwwenkai-regular-subset') ||
    routeCss.includes('lxgwwenkai-bold-subset')
  ) {
    report(`${route.label}: editorial font bundle leaked into immersive route`, route);
  }

  for (const video of videos) {
    if (/\ssrc=/.test(video)) {
      report(`${route.label}: video has an eager src attribute`, route);
    }
    if (/\sposter=/.test(video)) {
      report(`${route.label}: video has an eager poster attribute`, route);
    }
    if (/\spreload=["']auto["']/.test(video)) {
      report(`${route.label}: video uses preload=auto`, route);
    }
  }

  for (const image of deferredImages) {
    if (/\ssrc=/.test(image)) {
      report(`${route.label}: deferred layer image has an eager src attribute`, route);
    }
  }

  if (route.id !== 'village') {
    const exits = videos.filter((video) => video.includes('data-exit-video'));
    if (exits.length !== 1) {
      report(
        `${route.label}: expected one reusable exit video, found ${exits.length}`,
        route,
        false
      );
    }
  }
}

const immersiveFontPath = resolve('public/fonts/wisteria-immersive-ui.woff2');
if ((await stat(immersiveFontPath)).size > config.budgets.immersiveFontBytes) {
  report(
    `immersive UI font exceeds ${config.budgets.immersiveFontBytes} bytes`
  );
}

const village = await readFile(resolve('dist/index.html'), 'utf8');
if (/<link\b[^>]*welcome-to-wisteria\.(?:png|webp)/.test(village)) {
  report('village: welcome artwork is unconditionally preloaded', config.routes[0]);
}
if (/<img\b[^>]*data-welcome-logo[^>]*\ssrc=/.test(village)) {
  report('village: welcome artwork has an eager src attribute', config.routes[0]);
}

const publicSourceExtensions = new Set([
  '.jpeg',
  '.jpg',
  '.png',
  '.tif',
  '.tiff'
]);
for (const route of config.routes) {
  for (const root of route.mediaRoots) {
    let paths;
    try {
      paths = await walk(root);
    } catch {
      failures.push(`${route.label}: media root is missing: ${root}`);
      continue;
    }

    for (const path of paths) {
      const extension = extname(path).toLowerCase();
      if (publicSourceExtensions.has(extension) || path.endsWith('layers.json')) {
        report(`${path}: authoring asset remains in the public tree`, route);
      }
      if (
        extension === '.webp' &&
        (await stat(path)).size > config.budgets.deliveryImageBytes
      ) {
        report(
          `${path}: delivery image exceeds ${config.budgets.deliveryImageBytes} bytes`,
          route
        );
      }
      if (
        path.includes('/transitions/') &&
        extension === '.mp4' &&
        (await stat(path)).size > config.budgets.transitionVideoBytes
      ) {
        report(
          `${path}: transition delivery exceeds ${config.budgets.transitionVideoBytes} bytes`,
          route
        );
      }
    }
  }
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

if (warnings.length > 0) {
  console.warn('Cinematic loading audit prototype warnings:');
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (failures.length > 0) {
  console.error(`Cinematic loading audit failed (${profile} profile):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `Cinematic loading audit passed for ${config.routes.length} immersive routes (${profile} profile).`
  );
}
