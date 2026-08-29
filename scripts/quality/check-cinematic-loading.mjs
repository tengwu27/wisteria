import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
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

function attribute(tag, name) {
  return tag.match(new RegExp(`\\s${name}=["']([^"']*)["']`))?.[1];
}

function unique(values) {
  return new Set(values).size === values.length;
}

function isNormalizedBounds(bounds) {
  return Boolean(
    bounds &&
    Number.isFinite(bounds.x) &&
    Number.isFinite(bounds.y) &&
    Number.isFinite(bounds.width) &&
    Number.isFinite(bounds.height) &&
    bounds.x >= 0 &&
    bounds.y >= 0 &&
    bounds.width > 0 &&
    bounds.height > 0 &&
    bounds.x + bounds.width <= 1.000001 &&
    bounds.y + bounds.height <= 1.000001
  );
}

function validateNormalizedBounds(tag, label, route) {
  const style = attribute(tag, 'style') ?? '';
  const values = Object.fromEntries(
    [...style.matchAll(/(left|top|width|height):([\d.]+)%/g)].map(
      (match) => [match[1], Number(match[2]) / 100]
    )
  );
  const complete = ['left', 'top', 'width', 'height'].every(
    (key) => Number.isFinite(values[key])
  );
  const inRange =
    complete &&
    values.left >= 0 &&
    values.top >= 0 &&
    values.width > 0 &&
    values.height > 0 &&
    values.left + values.width <= 1.000001 &&
    values.top + values.height <= 1.000001;

  if (!inRange) {
    report(`${route.label}: ${label} has invalid normalized bounds`, route, false);
  }
}

async function readWebpDimensions(path) {
  const bytes = await readFile(path);
  if (
    bytes.toString('ascii', 0, 4) !== 'RIFF' ||
    bytes.toString('ascii', 8, 12) !== 'WEBP'
  ) {
    throw new Error('not a WebP file');
  }

  const chunk = bytes.toString('ascii', 12, 16);
  if (chunk === 'VP8X') {
    return {
      width: 1 + bytes.readUIntLE(24, 3),
      height: 1 + bytes.readUIntLE(27, 3)
    };
  }
  if (chunk === 'VP8 ') {
    return {
      width: bytes.readUInt16LE(26) & 0x3fff,
      height: bytes.readUInt16LE(28) & 0x3fff
    };
  }
  if (chunk === 'VP8L') {
    const b1 = bytes[21];
    const b2 = bytes[22];
    const b3 = bytes[23];
    const b4 = bytes[24];
    return {
      width: 1 + b1 + ((b2 & 0x3f) << 8),
      height: 1 + (b2 >> 6) + (b3 << 2) + ((b4 & 0x0f) << 10)
    };
  }

  throw new Error(`unsupported WebP chunk ${chunk}`);
}

async function readPngDimensions(path) {
  const bytes = await readFile(path);
  if (
    bytes.length < 24 ||
    bytes[0] !== 0x89 ||
    bytes.toString('ascii', 1, 4) !== 'PNG' ||
    bytes.toString('ascii', 12, 16) !== 'IHDR'
  ) {
    throw new Error('not a PNG file');
  }
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    sha256: createHash('sha256').update(bytes).digest('hex')
  };
}

async function validateLibraryManifest(route) {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(resolve(route.manifest), 'utf8'));
  } catch (error) {
    report(
      `${route.label}: focus manifest cannot be read (${error.message})`,
      route,
      false
    );
    return;
  }

  if (
    manifest.schemaVersion !== 2 ||
    manifest.geometryMaster?.width !== 4096 ||
    manifest.geometryMaster?.height !== 1536
  ) {
    report(`${route.label}: immutable 4096x1536 geometry master contract is missing`, route, false);
  }

  if (
    manifest.geometryMaster?.path !== 'source/library-grand-hall-full-tile-v3.png' ||
    manifest.geometryMaster?.version !== 3 ||
    typeof manifest.geometryMaster?.authoringManifest !== 'string'
  ) {
    report(`${route.label}: refined v2 geometry master contract is missing`, route, false);
  } else {
    try {
      const authoringPath = resolve(
        dirname(route.manifest),
        manifest.geometryMaster.authoringManifest
      );
      const authoring = JSON.parse(await readFile(authoringPath, 'utf8'));
      if (
        authoring.version !== 3 ||
        authoring.canvas?.width !== 4096 ||
        authoring.canvas?.height !== 1536 ||
        (authoring.composite?.changedPixelsOutsideDeclaredRegions ??
          authoring.composite?.changedPixelsOutsideCombinedMask) !== 0 ||
        authoring.regions?.length !== 3
      ) {
        report(`${route.label}: exterior-refinement authoring contract is invalid`, route, false);
      }
    } catch (error) {
      report(`${route.label}: exterior-refinement manifest cannot be read (${error.message})`, route, false);
    }
  }

  const plates = manifest.focusPlates ?? [];
  const plateIds = plates.map((plate) => plate.id);
  if (plates.length !== 2 || !unique(plateIds)) {
    report(`${route.label}: focus plate IDs must be two unique values`, route, false);
  }

  for (const plate of plates) {
    const registration = plate.registration ?? {};
    if (registration.kind === 'registered-crop') {
      const crop = registration.masterCrop ?? {};
      if (
        crop.left < 0 ||
        crop.top < 0 ||
        crop.width <= 0 ||
        crop.height <= 0 ||
        crop.left + crop.width > 4096 ||
        crop.top + crop.height > 1536
      ) {
        report(`${route.label}: ${plate.id} crop leaves the geometry master`, route, false);
      }
      if (
        !Array.isArray(registration.protectedAnchors) ||
        registration.protectedAnchors.length < 2
      ) {
        report(`${route.label}: ${plate.id} needs registered transition anchors`, route, false);
      }
    } else if (registration.kind === 'independent-viewpoint') {
      if (!isNormalizedBounds(registration.sourceZone)) {
        report(`${route.label}: ${plate.id} has an invalid source hall zone`, route, false);
      }
      if (
        typeof registration.cameraDescription !== 'string' ||
        registration.cameraDescription.trim().length < 24
      ) {
        report(`${route.label}: ${plate.id} needs an independent camera description`, route, false);
      }
      if (
        !Array.isArray(registration.continuityAnchors) ||
        registration.continuityAnchors.length < 3
      ) {
        report(`${route.label}: ${plate.id} needs at least three continuity anchors`, route, false);
      }
    } else {
      report(`${route.label}: ${plate.id} has an unknown registration kind`, route, false);
    }

    try {
      await stat(resolve('assets/cinematic/scenes/library-grand-hall', plate.source));
    } catch {
      report(`${route.label}: missing focus source ${plate.source}`, route, false);
    }

    for (const delivery of plate.delivery ?? []) {
      const path = resolve(
        'assets/cinematic/scenes/library-grand-hall',
        delivery.path
      );
      try {
        const dimensions = await readWebpDimensions(path);
        if (
          dimensions.width !== delivery.width ||
          dimensions.height !== delivery.height
        ) {
          report(
            `${route.label}: ${delivery.path} is ${dimensions.width}x${dimensions.height}, expected ${delivery.width}x${delivery.height}`,
            route,
            false
          );
        }
      } catch (error) {
        report(
          `${route.label}: invalid focus delivery ${delivery.path} (${error.message})`,
          route,
          false
        );
      }
    }
  }
}

async function validateCastleGallery(route, html, routeCss) {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(resolve(route.manifest), 'utf8'));
  } catch (error) {
    report(`${route.label}: layer manifest cannot be read (${error.message})`, route, false);
    return;
  }

  if (
    manifest.schemaVersion !== 2 ||
    manifest.sceneId !== 'castle-gallery-wall' ||
    manifest.registration?.kind !== 'independent-viewpoint' ||
    manifest.registration?.canvas?.width !== 1672 ||
    manifest.registration?.canvas?.height !== 941
  ) {
    report(`${route.label}: independent 1672x941 Gallery registration is invalid`, route, false);
  }
  const apertureIds = Object.keys(manifest.apertures ?? {});
  if (
    apertureIds.length !== 3 ||
    !unique(apertureIds) ||
    apertureIds.some((id) =>
      !isNormalizedBounds(manifest.apertures[id]?.normalizedBounds) ||
      !isNormalizedBounds(manifest.apertures[id]?.normalizedFrameEnvelopeBounds) ||
      !isNormalizedBounds(manifest.apertures[id]?.normalizedFrameBounds) ||
      manifest.apertures[id]?.aspectPolicy !== 'match-source-frame'
    )
  ) {
    report(`${route.label}: three unique source-matched frames, envelopes, and apertures are required`, route, false);
  }
  if (
    manifest.layerOrder?.join(',') !== 'base,framed-art-proxy,foreground-frame-shell' ||
    manifest.protectedPixels?.outsideApertures !== true ||
    manifest.protectedPixels?.shellTransparencyMismatchPixels !== 0 ||
    manifest.protectedPixels?.outsideDifferencePixels !== 0 ||
    manifest.protectedPixels?.outsideRepairDifferencePixels !== 0
  ) {
    report(`${route.label}: registered layer order or protected-pixel proof is invalid`, route, false);
  }
  if (
    manifest.occupied?.['gallery-center-frame']?.wisteriaId !== route.artworkId ||
    manifest.occupied?.['gallery-center-frame']?.sourceSha256 !== route.sourceArtwork.sha256 ||
    manifest.occupied?.['gallery-center-frame']?.aspectRatioError > 0.005 ||
    manifest.occupied?.['gallery-center-frame']?.transparentProxyPixels !== 0
  ) {
    report(`${route.label}: center-frame source identity or exact-fit proof is not authoritative`, route, false);
  }

  try {
    const source = await readPngDimensions(resolve(route.sourceArtwork.path));
    if (
      source.width !== route.sourceArtwork.width ||
      source.height !== route.sourceArtwork.height ||
      source.sha256 !== route.sourceArtwork.sha256
    ) {
      report(`${route.label}: canonical HD source dimensions or digest changed`, route, false);
    }
  } catch (error) {
    report(`${route.label}: canonical HD source is invalid (${error.message})`, route, false);
  }

  for (const media of route.galleryMedia ?? []) {
    try {
      const dimensions = await readWebpDimensions(resolve(media.path));
      const bytes = (await stat(resolve(media.path))).size;
      if (dimensions.width !== media.width || dimensions.height !== media.height) {
        report(`${route.label}: ${media.path} has unexpected dimensions`, route, false);
      }
      if (bytes > config.budgets.deliveryImageBytes) {
        report(`${route.label}: ${media.path} exceeds the individual image budget`, route);
      }
    } catch (error) {
      report(`${route.label}: invalid Gallery delivery ${media.path} (${error.message})`, route, false);
    }
  }

  const layerTags = html.match(/<img\b[^>]*data-gallery-layer=[^>]*>/g) ?? [];
  const hotspot = html.match(/<a\b[^>]*data-gallery-artwork=[^>]*>/)?.[0] ?? '';
  if (
    !html.includes('data-castle-gallery') ||
    !html.includes('data-gallery-stack') ||
    !html.includes('data-gallery-fallback') ||
    layerTags.length !== 3
  ) {
    report(`${route.label}: base/proxy/shell stack and flattened fallback are required`, route, false);
  }
  if (
    attribute(hotspot, 'data-gallery-artwork') !== route.artworkId ||
    attribute(hotspot, 'href') !== `/castle/gallery/art/${route.artworkId}` ||
    !hotspot.includes('data-immersive-route')
  ) {
    report(`${route.label}: semantic artwork hotspot or direct route is invalid`, route, false);
  } else {
    validateNormalizedBounds(hotspot, `artwork ${route.artworkId}`, route);
  }
  if (
    !transitionSources.castleGallery.includes('readyLayers') ||
    !transitionSources.castleGallery.includes('revealFallback') ||
    !routeCss.includes('prefers-reduced-motion')
  ) {
    report(`${route.label}: bounded layered/fallback runtime contract is incomplete`, route, false);
  }

  let artworkHtml;
  try {
    artworkHtml = await readFile(resolve(route.artworkHtml), 'utf8');
  } catch {
    report(`${route.label}: artwork inspector route is missing`, route, false);
    return;
  }
  const artworkStyles = [
    artworkHtml,
    ...await Promise.all(
      [...artworkHtml.matchAll(/href=["']([^"']+\.css)["']/g)].map((match) =>
        readFile(resolve('dist', match[1].replace(/^\//, '')), 'utf8')
      )
    )
  ].join('\n');
  const artworkScripts = [
    artworkHtml,
    ...await Promise.all(
      [...artworkHtml.matchAll(/src=["']([^"']+\.js)["']/g)].map((match) =>
        readFile(resolve('dist', match[1].replace(/^\//, '')), 'utf8')
      )
    )
  ].join('\n');
  const sourceTag = artworkHtml.match(/<img\b[^>]*data-artwork-source[^>]*>/)?.[0] ?? '';
  if (
    !artworkHtml.includes(`data-artwork-id="${route.artworkId}"`) ||
    attribute(sourceTag, 'width') !== String(route.sourceArtwork.width) ||
    attribute(sourceTag, 'height') !== String(route.sourceArtwork.height) ||
    !(attribute(sourceTag, 'alt') ?? '').trim()
  ) {
    report(`${route.label}: inspector does not expose the exact HD source identity`, route, false);
  }
  if (
    !artworkHtml.includes('data-zoom-in') ||
    !artworkHtml.includes('data-zoom-out') ||
    !artworkHtml.includes('data-zoom-reset') ||
    !artworkHtml.includes('data-inspection-stage') ||
    !artworkScripts.includes('pointerdown') ||
    !artworkScripts.includes('wheel') ||
    !artworkScripts.includes('ArrowLeft') ||
    !artworkStyles.includes('object-fit:contain') ||
    !artworkStyles.includes('touch-action:none') ||
    !artworkStyles.includes('prefers-reduced-motion')
  ) {
    report(`${route.label}: accessible zoom, pan, pinch, and no-crop inspector contract is incomplete`, route, false);
  }
  if (
    (artworkHtml.match(/<[a-z][^>]*\bdata-immersive-route-curtain\b[^>]*>/gi) ?? []).length !== 1 ||
    (artworkHtml.match(/<[a-z][^>]*\bdata-immersive-loading\b[^>]*>/gi) ?? []).length !== 1
  ) {
    report(`${route.label}: artwork inspector transition/loading ownership is invalid`, route, false);
  }
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

const transitionSourcePaths = {
  layout: 'src/layouts/ImmersiveLayout.astro',
  navigation: 'src/utils/immersiveNavigation.ts',
  mediaLoader: 'src/utils/cinematicMediaLoader.ts',
  village: 'src/components/sections/GamifiedCoastalVillage.astro',
  villageParallax: 'src/utils/prototypeLayeredScene.ts',
  castle: 'src/components/sections/CastleVista.astro',
  castleGallery: 'src/components/sections/CastleGallery.astro',
  castleArtwork: 'src/components/sections/CastleArtworkInspector.astro',
  restaurant: 'src/components/sections/RestaurantVista.astro',
  library: 'src/components/sections/LibraryExperience.astro',
  libraryScene: 'src/data/libraryScene.ts',
  libraryPage: 'src/pages/library.astro'
};
const transitionSources = Object.fromEntries(
  await Promise.all(
    Object.entries(transitionSourcePaths).map(async ([name, path]) => [
      name,
      await readFile(resolve(path), 'utf8')
    ])
  )
);
const transitionSourceBundle = Object.values(transitionSources).join('\n');

if ((transitionSources.layout.match(/data-immersive-route-curtain/g) ?? []).length !== 1) {
  failures.push('immersive transition: layout must own exactly one shared route curtain');
}
if (transitionSources.layout.includes('data-immersive-crossfade-overlay')) {
  failures.push('immersive transition: debug baseline must not include a cloned-scene crossfade overlay');
}
if (
  !transitionSources.navigation.includes('astro:before-preparation') ||
  !transitionSources.navigation.includes('DESTINATION_PRELOAD_TIMEOUT_MS = 8_000') ||
  !transitionSources.navigation.includes('preloadDestinationAssets(') ||
  !transitionSources.navigation.includes('awaitImmersiveArrival') ||
  !transitionSources.navigation.includes('ARRIVAL_READY_EVENT, releaseCurtain') ||
  !transitionSources.layout.includes('transition:persist="immersive-route-curtain"')
) {
  failures.push('immersive transition: simplified preload/curtain navigation coordinator is incomplete');
}
if (
  !transitionSources.mediaLoader.includes('PRIMARY_SCENE_TIMEOUT_MS = 8_000') ||
  !transitionSources.mediaLoader.includes('OPTIONAL_DETAIL_TIMEOUT_MS = 4_000') ||
  !transitionSources.mediaLoader.includes("'timed-out'") ||
  !transitionSources.mediaLoader.includes('onLateReady')
) {
  failures.push('immersive loading: bounded primary/optional readiness and late recovery are required');
}
if (
  !transitionSources.village.includes('window.setInterval') ||
  !transitionSources.village.includes('window.clearInterval(clockTimer)') ||
  !transitionSources.village.includes('deferFallbackArrival') ||
  !transitionSources.village.includes('Promise.all([layerStates, fallbackState])') ||
  transitionSources.village.includes('requestAnimationFrame(tick)') ||
  transitionSources.village.includes('#0d4d52')
) {
  failures.push('village: shell continuity and teardown-safe clock contract are incomplete');
}
if (
  !transitionSources.village.includes('zoom: 1.03') ||
  !transitionSources.village.includes('data-camera-focal-y') ||
  !transitionSources.village.includes('min-width:103%') ||
  !transitionSources.village.includes('min-height:103%') ||
  !transitionSources.village.includes('overflow:auto') ||
  !transitionSources.village.includes('touch-action:pan-x pan-y') ||
  !transitionSources.villageParallax.includes("data-overflow-y") ||
  !transitionSources.villageParallax.includes('viewport.scrollTop') ||
  !transitionSources.villageParallax.includes("event.key === 'ArrowUp'") ||
  !transitionSources.villageParallax.includes("event.key === 'ArrowDown'") ||
  transitionSources.village.includes('data-vertical-pan="document"') ||
  transitionSources.village.includes('document.scrollingElement') ||
  transitionSources.village.includes('scene-scroll-surface') ||
  transitionSources.layout.includes('data-immersive-scroll-runway')
) {
  failures.push('village: native 1.03x four-direction camera contract is incomplete');
}
if (
  transitionSources.village.includes('data-immersive-document-route') ||
  transitionSources.library.includes('data-immersive-document-route') ||
  transitionSources.libraryPage.includes('clientRouter={false}')
) {
  failures.push('library: debug baseline must use the shared client navigation path');
}
if (
  !transitionSources.libraryScene.includes('MAIN_GATE_AXIS_X = 2199') ||
  !transitionSources.libraryScene.includes(
    'initialFocalRatio: MAIN_GATE_AXIS_X / LIBRARY_CANVAS_WIDTH'
  ) ||
  transitionSources.library.includes('data-zone-focal-ratio') ||
  transitionSources.library.includes('trigger.dataset.zoneFocalRatio')
) {
  failures.push('library: overview must start on the central gate and remain stationary while close-ups open');
}
for (const name of ['village', 'castle', 'castleGallery', 'castleArtwork', 'restaurant', 'library']) {
  const source = transitionSources[name];
  if (
    !source.includes('waitForCinematicImage') ||
    !source.includes('settleImmersiveArrival') ||
    !source.includes('data-immersive-loading') ||
    source.includes('data-route-curtain')
  ) {
    failures.push(`${name}: shared bounded loading and transition ownership are incomplete`);
  }
}
if (
  transitionSourceBundle.includes('CinematicSceneExitOverlay') ||
  transitionSourceBundle.includes('cinematicExitSequence') ||
  transitionSourceBundle.includes('is-returning-to-village') ||
  transitionSourceBundle.includes('is-village-intro-pending')
) {
  failures.push('immersive transition: obsolete video handoff state remains referenced');
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

  const deferredImages = html.match(/<img\b[^>]*\sdata-src=[^>]*>/g) ?? [];
  const stylesheetPaths = [
    ...html.matchAll(/href=["']([^"']+\.css)["']/g)
  ].map((match) => match[1]);
  const scriptPaths = [
    ...html.matchAll(/src=["']([^"']+\.js)["']/g)
  ].map((match) => match[1]);
  const stylesheets = await Promise.all(
    stylesheetPaths.map((href) =>
      readFile(resolve('dist', href.replace(/^\//, '')), 'utf8')
    )
  );
  const scripts = await Promise.all(
    scriptPaths.map((src) =>
      readFile(resolve('dist', src.replace(/^\//, '')), 'utf8')
    )
  );
  const routeCss = [html, ...stylesheets].join('\n');
  const routeRuntime = [html, ...scripts].join('\n');
  const initialCodeBytes = await measureInitialRouteCode(html, route.html);
  const routeCurtains = html.match(/\bdata-immersive-route-curtain\b/g) ?? [];
  const routeLoaders = html.match(
    /<[a-z][^>]*\bdata-immersive-loading\b[^>]*>/gi
  ) ?? [];

  if (routeCurtains.length !== 1) {
    report(
      `${route.label}: expected one layout-owned route curtain, found ${routeCurtains.length}`,
      route,
      false
    );
  }
  if (routeLoaders.length !== 1) {
    report(
      `${route.label}: expected one handoff-aware loader, found ${routeLoaders.length}`,
      route,
      false
    );
  }
  if (
    !routeCss.includes('#183d38') ||
    (!routeCss.includes('180ms') && !routeCss.includes('.18s')) ||
    !routeCss.includes('immersive-route-curtain') ||
    !routeCss.includes('data-skip-arrival-reveal') ||
    routeCss.includes('immersive-crossfade-overlay')
  ) {
    report(`${route.label}: simplified curtain transition contract is missing`, route, false);
  }

  if (route.id === 'village') {
    const registeredPlanes = html.match(/data-plane="[^"]+"/g) ?? [];
    const expectedPlanes = ['village', 'clouds'];
    const missingPlanes = expectedPlanes.filter((plane) =>
      !registeredPlanes.includes(`data-plane="${plane}"`)
    );
    if (registeredPlanes.length !== expectedPlanes.length || missingPlanes.length > 0) {
      report(
        `${route.label}: expected ${expectedPlanes.length} semantic registered planes (${expectedPlanes.join(', ')}), found ${registeredPlanes.length}${missingPlanes.length ? `; missing ${missingPlanes.join(', ')}` : ''}`,
        route,
        false
      );
    }
    if (!html.includes('data-layer-stack') || !html.includes('data-fallback')) {
      report(`${route.label}: registered stack and flattened fallback are required`, route, false);
    }
    if (!html.includes('class="factory-steam"')) {
      report(`${route.label}: factory steam must remain a layer-owned browser effect`, route, false);
    }
    if (
      !html.includes('data-landmark="castle"') ||
      !html.includes('data-route="/castle"')
    ) {
      report(`${route.label}: castle landmark must route to /castle`, route, false);
    }
    if (
      !html.includes('data-landmark="harbor"') ||
      !html.includes('data-route="/harbor"')
    ) {
      report(`${route.label}: harbor landmark must route to /harbor`, route, false);
    }
    const landmarkLinks = html.match(/<a\b[^>]*data-landmark=[^>]*>/g) ?? [];
    if (
      landmarkLinks.length === 0 ||
      !landmarkLinks.every((link) => /\shref=/.test(link)) ||
      !landmarkLinks.every((link) => link.includes('data-immersive-route'))
    ) {
      report(`${route.label}: landmarks must be semantic links on the shared client route`, route, false);
    }
  }

  if (route.id === 'library' && !html.includes('data-immersive-route')) {
    report(`${route.label}: village exit must use the shared client route`, route, false);
  }

  if (
    route.sceneKind === 'static-artwork' &&
    !html.includes('href="/"')
  ) {
    report(`${route.label}: village return link is missing`, route, false);
  }

  if (route.sceneKind === 'static-artwork') {
    const staticArtwork = html.match(/<img\b[^>]*data-scene-art[^>]*>/g) ?? [];
    const registeredPlanes = html.match(/data-plane="[^"]+"/g) ?? [];
    if (staticArtwork.length !== 1) {
      report(
        `${route.label}: expected one approved static artwork, found ${staticArtwork.length}`,
        route,
        false
      );
    }
    if (registeredPlanes.length > 0) {
      report(
        `${route.label}: static artwork route must not ship parallax planes`,
        route,
        false
      );
    }
  }

  if (route.sceneKind === 'interactive-artifact-scene') {
    await validateLibraryManifest(route);

    const hallArtwork = html.match(
      /<img\b[^>]*data-library-hall-art[^>]*>/g
    ) ?? [];
    const focusArtwork = html.match(
      /<img\b[^>]*data-focus-image[^>]*>/g
    ) ?? [];
    const zoneTags = html.match(
      /<button\b[^>]*data-zone-trigger=[^>]*>/g
    ) ?? [];
    const artifactTags = html.match(
      /<button\b[^>]*data-artifact-trigger=[^>]*>/g
    ) ?? [];
    const bookTags = html.match(
      /<article\b[^>]*data-book=[^>]*>/g
    ) ?? [];
    const pageImageTags = html.match(
      /<img\b[^>]*data-page-image[^>]*>/g
    ) ?? [];
    const expectedArtifactIds = route.artifactRoutes.map((artifact) => artifact.id);
    const placedArtifactIds = artifactTags.map((tag) =>
      attribute(tag, 'data-artifact-trigger')
    );
    const inspectedArtifactIds = bookTags.map((tag) =>
      attribute(tag, 'data-book')
    );
    const zoneIds = zoneTags.map((tag) => attribute(tag, 'data-zone-trigger'));

    if (hallArtwork.length !== 1 || !attribute(hallArtwork[0] ?? '', 'src')) {
      report(`${route.label}: exactly one eager panorama master is required`, route, false);
    }
    if (focusArtwork.length !== 2) {
      report(`${route.label}: expected two focus plates, found ${focusArtwork.length}`, route, false);
    }
    if (
      zoneIds.length !== 2 ||
      !unique(zoneIds) ||
      !zoneIds.includes('reading-table') ||
      !zoneIds.includes('west-shelf')
    ) {
      report(`${route.label}: reading-table and west-shelf zones must be unique`, route, false);
    }
    if (
      !unique(placedArtifactIds) ||
      !unique(inspectedArtifactIds) ||
      expectedArtifactIds.some((id) => !placedArtifactIds.includes(id)) ||
      expectedArtifactIds.some((id) => !inspectedArtifactIds.includes(id)) ||
      placedArtifactIds.length !== inspectedArtifactIds.length ||
      placedArtifactIds.some((id) => !inspectedArtifactIds.includes(id))
    ) {
      report(`${route.label}: scene placements and book inspectors are out of sync`, route, false);
    }

    for (const tag of zoneTags) {
      validateNormalizedBounds(
        tag,
        `zone ${attribute(tag, 'data-zone-trigger')}`,
        route
      );
    }
    for (const tag of artifactTags) {
      validateNormalizedBounds(
        tag,
        `artifact ${attribute(tag, 'data-artifact-trigger')}`,
        route
      );
    }
    for (const tag of [...focusArtwork, ...pageImageTags]) {
      if (!(attribute(tag, 'alt') ?? '').trim()) {
        report(`${route.label}: focus and book media require non-empty alt text`, route, false);
      }
    }
    for (const tag of focusArtwork) {
      if (!attribute(tag, 'data-src') || attribute(tag, 'src')) {
        report(`${route.label}: focus plates must defer requests until zone intent`, route, false);
      }
    }
    for (const tag of pageImageTags) {
      if (!attribute(tag, 'data-src') || attribute(tag, 'src')) {
        report(`${route.label}: closed book images must remain deferred`, route, false);
      }
    }
    if (
      !html.includes('data-reveal-control') ||
      !html.includes('data-book-layer') ||
      !routeRuntime.includes('sessionStorage') ||
      !routeRuntime.includes('popstate') ||
      !routeCss.includes('prefers-reduced-motion') ||
      /<audio\b/i.test(html)
    ) {
      report(`${route.label}: immersive accessibility and history contract is incomplete`, route, false);
    }
    if (
      !/html\.immersive-document[^{}]{0,220}\{[^}]*overflow\s*:\s*hidden/.test(
        routeCss
      )
    ) {
      report(`${route.label}: body-level overflow containment is missing`, route, false);
    }

    for (const artifactId of inspectedArtifactIds) {
      const configuredArtifact = route.artifactRoutes.find(
        (artifact) => artifact.id === artifactId
      );
      const bookTag = bookTags.find(
        (tag) => attribute(tag, 'data-book') === artifactId
      );
      const declaredPages = Number(attribute(bookTag ?? '', 'data-page-count'));
      if (
        declaredPages < 1 ||
        declaredPages > 64 ||
        (configuredArtifact && declaredPages !== configuredArtifact.pages)
      ) {
        report(`${route.label}: ${artifactId} page count is invalid`, route, false);
      }

      let artifactHtml;
      const artifactPath =
        configuredArtifact?.html ??
        `dist/collection/${artifactId}/index.html`;
      try {
        artifactHtml = await readFile(resolve(artifactPath), 'utf8');
      } catch {
        report(`${route.label}: direct artifact route is missing at ${artifactPath}`, route, false);
        continue;
      }
      const semanticPages = artifactHtml.match(/<section\b[^>]*data-book-page=/g) ?? [];
      const ownBook = artifactHtml.match(
        new RegExp(`<article\\b[^>]*data-book=["']${artifactId}["'][^>]*>`)
      )?.[0];
      if (
        !artifactHtml.includes(`data-initial-artifact="${artifactId}"`) ||
        !ownBook ||
        attribute(ownBook, 'aria-hidden') !== 'false' ||
        semanticPages.length < declaredPages ||
        !/<meta\b[^>]*name="robots"[^>]*noindex/i.test(artifactHtml)
      ) {
        report(`${route.label}: ${artifactId} direct/no-JavaScript route contract failed`, route, false);
      }
    }

    for (const media of route.bookMedia) {
      const path = resolve(media.path);
      try {
        const dimensions = await readWebpDimensions(path);
        const bytes = (await stat(path)).size;
        const stem = path.split('/').at(-1).replace(/\.webp$/, '');
        if (
          dimensions.width !== media.width ||
          dimensions.height !== media.height
        ) {
          report(
            `${route.label}: ${media.path} is ${dimensions.width}x${dimensions.height}, expected ${media.width}x${media.height}`,
            route,
            false
          );
        }
        if (bytes > config.budgets.deliveryImageBytes) {
          report(`${route.label}: ${media.path} exceeds the individual image budget`, route);
        }
        if (!html.includes(stem)) {
          report(`${route.label}: orphaned responsive book media ${stem}`, route, false);
        }
      } catch (error) {
        report(`${route.label}: invalid responsive book media ${media.path} (${error.message})`, route, false);
      }
    }

    const deliveryFiles = (await walk(route.mediaRoots[0])).filter(
      (path) => extname(path).toLowerCase() === '.webp'
    );
    for (const deliveryPath of deliveryFiles) {
      const stem = deliveryPath.split('/').at(-1).replace(/\.webp$/, '');
      if (!html.includes(stem)) {
        report(`${route.label}: orphaned delivery media ${stem}`, route, false);
      }
    }
  }

  if (route.sceneKind === 'layered-art-gallery') {
    await validateCastleGallery(route, html, routeCss);
  }

  if (route.castleScene) {
    const castleViews = {
      gate: '/castle',
      courtyard: '/castle/courtyard',
      arcade: '/castle/arcade'
    };
    const sceneAttribute = `data-castle-scene="${route.castleScene}"`;
    if (!html.includes('data-castle-vista') || !html.includes(sceneAttribute)) {
      report(`${route.label}: castle scene identity is missing`, route, false);
    }
    if (!html.includes('data-castle-navigator')) {
      report(`${route.label}: three-view castle navigator is missing`, route, false);
    }
    for (const [view, href] of Object.entries(castleViews)) {
      if (
        !html.includes(`data-castle-view="${view}"`) ||
        !html.includes(`href="${href}"`)
      ) {
        report(`${route.label}: castle navigator is missing ${view}`, route, false);
      }
    }
    const activeView = new RegExp(
      `<a[^>]*data-castle-view="${route.castleScene}"[^>]*aria-current="page"`
    );
    const currentPages = html.match(/aria-current="page"/g) ?? [];
    if (!activeView.test(html) || currentPages.length !== 1) {
      report(`${route.label}: castle navigator active view is incorrect`, route, false);
    }
    const activeArtwork = `castle-${route.castleScene}-`;
    const inactiveArtwork = Object.keys(castleViews)
      .filter((view) => view !== route.castleScene)
      .some((view) => html.includes(`castle-${view}-`));
    if (!html.includes(activeArtwork) || inactiveArtwork) {
      report(`${route.label}: only the active castle artwork may be requested`, route, false);
    }
  }

  const viewportMeta = html.match(
    /<meta\b[^>]*name=["']viewport["'][^>]*>/i
  )?.[0];
  if (!viewportMeta?.includes('viewport-fit=cover')) {
    report(
      `${route.label}: immersive viewport must opt into edge-to-edge coverage`,
      route,
      false
    );
  }
  if (
    !routeCss.includes('--immersive-viewport-width') ||
    !routeCss.includes('--immersive-viewport-height') ||
    !routeCss.includes('100dvw') ||
    !routeCss.includes('100dvh')
  ) {
    report(
      `${route.label}: dynamic immersive viewport contract is missing`,
      route,
      false
    );
  }
  if (routeCss.includes('100svh')) {
    report(
      `${route.label}: small viewport units can leave exposed Safari edges`,
      route,
      false
    );
  }

  if (initialCodeBytes > config.budgets.initialRouteCodeBytes) {
    report(
      `${route.label}: initial HTML, CSS, and JavaScript total ${initialCodeBytes} bytes; budget is ${config.budgets.initialRouteCodeBytes}`,
      route
    );
  }

  if (!routeCss.includes('/fonts/wisteria-immersive-ui.woff2')) {
    report(`${route.label}: compact immersive font is not registered`, route);
  }
  const hasLibraryBookFont =
    routeCss.includes("font-family: 'LXGW WenKai Books'") &&
    routeCss.includes('lxgwwenkai-regular-subset') &&
    routeCss.includes('lxgwwenkai-bold-subset');
  if (route.id === 'library') {
    if (!hasLibraryBookFont) {
      report(`${route.label}: content-aware LXGW WenKai book font is missing`, route);
    }
  } else if (
    routeCss.includes('zcool-kuaile-chinese-simplified') ||
    routeCss.includes('lxgwwenkai-regular-subset') ||
    routeCss.includes('lxgwwenkai-bold-subset')
  ) {
    report(`${route.label}: editorial font bundle leaked into immersive route`, route);
  }

  for (const image of deferredImages) {
    if (/\ssrc=/.test(image)) {
      report(`${route.label}: deferred layer image has an eager src attribute`, route);
    }
  }

}

let sitemapXml = '';
try {
  const sitemapFiles = (await walk(resolve('dist'))).filter(
    (path) => /\/sitemap[^/]*\.xml$/.test(path)
  );
  sitemapXml = (
    await Promise.all(sitemapFiles.map((path) => readFile(path, 'utf8')))
  ).join('\n');
  if (sitemapFiles.length === 0) {
    failures.push('sitemap: no generated XML files found');
  }
} catch (error) {
  failures.push(`sitemap: unable to inspect generated XML (${error.message})`);
}
for (const fragment of config.sitemapExcludedFragments) {
  if (sitemapXml.includes(fragment)) {
    failures.push(`sitemap: excluded route remains published: ${fragment}`);
  }
}

for (const legacyPath of config.legacyRedirects) {
  const redirectPath = resolve('dist', legacyPath, 'index.html');
  try {
    const redirectHtml = await readFile(redirectPath, 'utf8');
    if (
      !/http-equiv=["']refresh["']/i.test(redirectHtml) ||
      !redirectHtml.includes('/library')
    ) {
      failures.push(`${legacyPath}: static redirect to /library is invalid`);
    }
  } catch {
    failures.push(`${legacyPath}: static redirect output is missing`);
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
