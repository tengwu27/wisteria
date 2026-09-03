import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import {
  MATCHED_FRAME_ASPECT_TOLERANCE,
  MATCHED_FRAME_MIN_SHORT_SIDE,
  containsBounds,
  validateCuratedPlacementGeometry
} from '../assets/frame-geometry.mjs';
import {
  CONSTRUCTION_LEDGER_PATH,
  LOCATION_REGISTRY_PATH,
  NOTION_CONFIG_PATH,
  PROTECTED_ASSETS_PATH,
  computeCompositionHash,
  isProtectedAssetChangeAllowed,
  readJson,
  validateLockedRecord
} from './castle-framework.mjs';

const GALLERY_MANIFEST_PATH = 'assets/cinematic/scenes/castle-gallery-room/delivery/gallery-layer-manifest.json';
const GALLERY_CANVAS = { width: 1672, height: 941 };
const EXPECTED_NOTION_ART_PROPERTIES = [
  'Title',
  'Appearance Prompt',
  'Wisteria Status',
  'Art Type',
  'Wisteria ID',
  'Canonical SHA-256',
  'Composition Version',
  'Preview/PR URL'
];

const [registry, ledger, protectedAssets, galleryManifest, notionConfig] = await Promise.all([
  readJson(LOCATION_REGISTRY_PATH),
  readJson(CONSTRUCTION_LEDGER_PATH),
  readJson(PROTECTED_ASSETS_PATH),
  readJson(GALLERY_MANIFEST_PATH),
  readJson(NOTION_CONFIG_PATH)
]);
const errors = [];
const byId = new Map();

function pixelBounds(bounds) {
  return {
    x: bounds.x * GALLERY_CANVAS.width,
    y: bounds.y * GALLERY_CANVAS.height,
    width: bounds.width * GALLERY_CANVAS.width,
    height: bounds.height * GALLERY_CANVAS.height
  };
}

function sameBounds(left, right, epsilon = 1e-6) {
  return left && right && ['x', 'y', 'width', 'height'].every(
    (key) => Math.abs(left[key] - right[key]) <= epsilon
  );
}

if (registry.schemaVersion !== 4 || registry.structureId !== 'castle') {
  errors.push('Castle location registry must use curated-exhibit schema version 4.');
}
if (ledger.schemaVersion !== 4) errors.push('Castle construction ledger must use schema version 4.');
if (!ledger.activeReservation || ledger.activeReservation.lockScope !== 'room:castle/castle-gallery-room') {
  errors.push('The Castle Gallery construction reservation is missing.');
}

for (const record of ledger.records) {
  if (byId.has(record.wisteriaId)) errors.push(`Duplicate Wisteria ID: ${record.wisteriaId}`);
  byId.set(record.wisteriaId, record);
  if (record.state === 'locked') {
    errors.push(...validateLockedRecord(record, { requireRelease: false }).map(
      (error) => `${record.wisteriaId}: ${error}`
    ));
  } else if (record.state === 'pending') {
    if (record.pendingVersion?.state !== 'previewing') {
      errors.push(`${record.wisteriaId}: pending construction must be previewing.`);
    }
    if (record.pendingVersion?.constructionHash !== record.constructionHash) {
      errors.push(`${record.wisteriaId}: pending construction hash does not match.`);
    }
    if (record.pendingVersion?.pullRequest !== ledger.activeReservation.pullRequest) {
      errors.push(`${record.wisteriaId}: pending construction is not bound to the active reservation PR.`);
    }
  } else {
    errors.push(`${record.wisteriaId}: unsupported construction state ${record.state}.`);
  }
}

for (const record of ledger.records) {
  if (record.parentId && !byId.has(record.parentId)) {
    errors.push(`${record.wisteriaId}: parent ${record.parentId} is not registered.`);
  }
  for (const descendantId of record.dependencyLock?.protectedDescendantIds ?? []) {
    const descendant = byId.get(descendantId);
    if (!descendant || descendant.parentId !== record.wisteriaId) {
      errors.push(`${record.wisteriaId}: protected descendant ${descendantId} is not a direct child.`);
    }
  }
}

for (const room of registry.rooms) {
  if (!byId.has(room.id)) errors.push(`Room ${room.id} lacks a ledger record.`);
}

const scene = registry.scenes.find((candidate) => candidate.id === 'castle-gallery-wall');
const sceneRecord = byId.get('castle-gallery-wall');
const composition = scene?.composition;
if (!scene || !sceneRecord || composition?.mode !== 'curated-exhibit') {
  errors.push('Castle Gallery curated exhibit registration is incomplete.');
} else {
  if ((scene.slots?.length ?? 0) !== 0) {
    errors.push('Curated exhibits cannot expose reusable framed-art slots.');
  }
  if (!sameBounds(scene.protectedRegion, composition.exhibitRegion)) {
    errors.push('The Gallery exhibit region must equal its protected scene region.');
  }
  if (computeCompositionHash(composition) !== composition.compositionHash) {
    errors.push('The Gallery composition hash does not match its registry payload.');
  }
  if (
    sceneRecord.sceneMode !== composition.mode ||
    sceneRecord.compositionVersion !== composition.compositionVersion ||
    sceneRecord.compositionHash !== composition.compositionHash ||
    !sameBounds(sceneRecord.exhibitRegion, composition.exhibitRegion)
  ) {
    errors.push('The Gallery scene ledger and composition registry differ.');
  }

  const placementIds = new Set();
  const artworkIds = new Set();
  const hotspotIds = new Set();
  for (const placement of composition.placements) {
    if (placementIds.has(placement.id)) errors.push(`Duplicate placement ID: ${placement.id}`);
    if (artworkIds.has(placement.artworkId)) errors.push(`Duplicate artwork placement: ${placement.artworkId}`);
    if (hotspotIds.has(placement.hotspotId)) errors.push(`Duplicate hotspot: ${placement.hotspotId}`);
    placementIds.add(placement.id);
    artworkIds.add(placement.artworkId);
    hotspotIds.add(placement.hotspotId);

    if (!containsBounds(composition.exhibitRegion, placement.frameBounds)) {
      errors.push(`${placement.id}: frame leaves the exhibit region.`);
    }
    const record = byId.get(placement.artworkId);
    if (
      !record ||
      record.entityKind !== 'item' ||
      record.revelationMode !== 'self-revealing' ||
      record.constructionTrigger !== 'codex-request' ||
      record.placementId !== placement.id ||
      record.compositionVersion !== composition.compositionVersion ||
      record.hotspotId !== placement.hotspotId ||
      record.artKind !== placement.artKind ||
      !sameBounds(record.bounds, placement.frameBounds) ||
      !sameBounds(record.apertureBounds, placement.apertureBounds)
    ) {
      errors.push(`${placement.artworkId}: ledger placement does not match the composition.`);
      continue;
    }
    if (placement.artKind !== 'painting') {
      errors.push(`${placement.artworkId}: v1 can execute paintings only.`);
    }
    if (
      record.sourceArtwork?.sha256 !== placement.canonicalSha256 ||
      record.wallProxy?.sha256 !== placement.proxySha256 ||
      record.wallProxy?.assetPath !== placement.proxyAssetPath
    ) {
      errors.push(`${placement.artworkId}: canonical or proxy identity differs.`);
    }
    const validation = validateCuratedPlacementGeometry({
      source: record.sourceArtwork,
      aperture: pixelBounds(placement.apertureBounds),
      frame: pixelBounds(placement.frameBounds),
      exhibitRegion: pixelBounds(composition.exhibitRegion),
      aspectTolerance: MATCHED_FRAME_ASPECT_TOLERANCE,
      minShortSide: MATCHED_FRAME_MIN_SHORT_SIDE
    });
    errors.push(...validation.errors.map((error) => `${placement.artworkId}: ${error}`));
  }

  const curatedRecords = ledger.records.filter(
    (record) => record.entityKind === 'item' && record.revelationMode === 'self-revealing'
  );
  if (curatedRecords.length !== composition.placements.length) {
    errors.push('Every curated artwork must map to exactly one composition placement.');
  }
}

if (
  galleryManifest.schemaVersion !== 3 ||
  galleryManifest.mode !== 'curated-exhibit' ||
  galleryManifest.composition?.version !== composition?.compositionVersion ||
  galleryManifest.composition?.hash !== composition?.compositionHash ||
  !sameBounds(galleryManifest.composition?.normalizedExhibitRegion, composition?.exhibitRegion)
) {
  errors.push('The Gallery delivery manifest does not match composition v1.');
}

for (const placement of composition?.placements ?? []) {
  const delivered = galleryManifest.composition?.placements?.find(
    (candidate) => candidate.id === placement.id
  );
  if (!delivered) {
    errors.push(`${placement.id}: missing from the delivery manifest.`);
    continue;
  }
  if (
    delivered.artworkId !== placement.artworkId ||
    delivered.hotspotId !== placement.hotspotId ||
    delivered.canonicalArtwork?.sha256 !== placement.canonicalSha256 ||
    delivered.proxy?.sha256 !== placement.proxySha256 ||
    !sameBounds(delivered.normalizedFrameBounds, placement.frameBounds) ||
    !sameBounds(delivered.normalizedApertureBounds, placement.apertureBounds)
  ) {
    errors.push(`${placement.id}: delivery geometry or identity differs from the registry.`);
  }
  if (
    delivered.aspectRatioError > MATCHED_FRAME_ASPECT_TOLERANCE ||
    delivered.proxy?.transparentPixelsInsideAperture !== 0
  ) {
    errors.push(`${placement.id}: delivered proxy violates aperture coverage or ratio tolerance.`);
  }
}

if (
  galleryManifest.protectedPixels?.shellTransparencyMismatchPixels !== 0 ||
  galleryManifest.protectedPixels?.outsideApertureDifferencePixels !== 0 ||
  galleryManifest.protectedPixels?.outsideRepairDifferencePixels !== 0 ||
  galleryManifest.protectedPixels?.repairMaskPixelsOutsideExhibitRegion !== 0
) {
  errors.push('Castle Gallery construction changed pixels outside an approved ownership mask.');
}

const notionSchema = notionConfig.artCatalog?.schema ?? {};
if (
  notionConfig.artCatalog?.constructionTrigger !== 'codex-request-only' ||
  EXPECTED_NOTION_ART_PROPERTIES.some((name) => !notionSchema[name])
) {
  errors.push('Castle Notion art catalog schema or Codex-only trigger is incomplete.');
}

for (const [filePath, protection] of Object.entries(protectedAssets.assets)) {
  const actualHash = createHash('sha256').update(await readFile(filePath)).digest('hex');
  if (actualHash !== protection.sha256 && !isProtectedAssetChangeAllowed(protection, ledger)) {
    errors.push(`Protected cinematic asset changed without unlock: ${filePath}`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    `Verified Castle curated composition v${composition.compositionVersion}, ${composition.placements.length} canonical painting, and ${Object.keys(protectedAssets.assets).length} protected assets under the active Gallery reservation.`
  );
}
