import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  MATCHED_FRAME_ASPECT_TOLERANCE,
  MATCHED_FRAME_MIN_SHORT_SIDE,
  validateMatchedFrameGeometry
} from '../assets/frame-geometry.mjs';
import {
  CONSTRUCTION_LEDGER_PATH,
  LOCATION_REGISTRY_PATH,
  PROTECTED_ASSETS_PATH,
  isProtectedAssetChangeAllowed,
  readJson,
  validateLockedRecord
} from './castle-framework.mjs';

const GALLERY_MANIFEST_PATH = 'assets/cinematic/scenes/castle-gallery-room/delivery/gallery-layer-manifest.json';
const GALLERY_CANVAS = { width: 1672, height: 941 };

const [registry, ledger, protectedAssets, galleryManifest] = await Promise.all([
  readJson(LOCATION_REGISTRY_PATH),
  readJson(CONSTRUCTION_LEDGER_PATH),
  readJson(PROTECTED_ASSETS_PATH),
  readJson(GALLERY_MANIFEST_PATH)
]);
const errors = [];
const byId = new Map();
const slotIds = new Set();
const hotspotIds = new Set();

function pixelBounds(bounds) {
  return {
    x: bounds.x * GALLERY_CANVAS.width,
    y: bounds.y * GALLERY_CANVAS.height,
    width: bounds.width * GALLERY_CANVAS.width,
    height: bounds.height * GALLERY_CANVAS.height
  };
}

function sameBounds(left, right, epsilon = 1e-6) {
  return left && right && ['x', 'y', 'width', 'height'].every((key) => Math.abs(left[key] - right[key]) <= epsilon);
}

if (registry.schemaVersion !== 3 || registry.structureId !== 'castle') {
  errors.push('Castle location registry must use schema version 3 and structureId castle.');
}
if (!ledger.activeReservation || ledger.activeReservation.lockScope !== 'room:castle/castle-gallery-room') {
  errors.push('The Castle Gallery construction reservation is missing.');
}

for (const record of ledger.records) {
  if (byId.has(record.wisteriaId)) errors.push(`Duplicate Wisteria ID: ${record.wisteriaId}`);
  byId.set(record.wisteriaId, record);
  if (record.state === 'locked') {
    errors.push(...validateLockedRecord(record, { requireRelease: false }).map((error) => `${record.wisteriaId}: ${error}`));
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
      errors.push(`${record.wisteriaId}: protected descendant ${descendantId} is not a direct registered child.`);
    }
  }
  if (record.entityKind !== 'item') continue;
  if (slotIds.has(record.slotId)) errors.push(`Multiple artifacts occupy slot ${record.slotId}.`);
  if (hotspotIds.has(record.hotspotId)) errors.push(`Duplicate hotspot ${record.hotspotId}.`);
  slotIds.add(record.slotId);
  hotspotIds.add(record.hotspotId);
  const scene = registry.scenes.find((candidate) => candidate.id === record.sceneId);
  const slot = scene?.slots.find((candidate) => candidate.id === record.slotId);
  if (!scene || scene.roomId !== record.roomId || !slot) {
    errors.push(`${record.wisteriaId}: invalid registered placement.`);
  }
  if (slot?.occupiedBy !== record.wisteriaId || slot?.representation !== record.representation) {
    errors.push(`${record.wisteriaId}: slot occupancy or representation is inconsistent.`);
  }
  if (record.representation === 'framed-art') {
    if (!record.frameEnvelopeBounds || !record.apertureBounds || !record.apertureMaskId) {
      errors.push(`${record.wisteriaId}: framed art requires an envelope, aperture, and mask.`);
    }
    if (!record.sourceArtwork?.sha256 || !record.wallProxy?.sha256) {
      errors.push(`${record.wisteriaId}: framed art source/proxy identity is incomplete.`);
    }
    if (slot?.aspectPolicy !== 'match-source-frame' || !slot.frameEnvelopeBounds) {
      errors.push(`${record.wisteriaId}: framed-art slot must use match-source-frame with a fixed envelope.`);
    }
    if (slot && !sameBounds(record.frameEnvelopeBounds, slot.frameEnvelopeBounds)) {
      errors.push(`${record.wisteriaId}: item and slot frame envelopes differ.`);
    }
    if (slot && !sameBounds(record.bounds, slot.bounds)) {
      errors.push(`${record.wisteriaId}: item and slot active frame bounds differ.`);
    }
    if (slot && !sameBounds(record.apertureBounds, slot.apertureBounds)) {
      errors.push(`${record.wisteriaId}: item and slot aperture bounds differ.`);
    }
    if (record.sourceArtwork?.width && record.sourceArtwork?.height && record.frameEnvelopeBounds && record.apertureBounds) {
      const validation = validateMatchedFrameGeometry({
        source: record.sourceArtwork,
        envelope: pixelBounds(record.frameEnvelopeBounds),
        frame: pixelBounds(record.bounds),
        aperture: pixelBounds(record.apertureBounds),
        aspectTolerance: MATCHED_FRAME_ASPECT_TOLERANCE,
        minShortSide: MATCHED_FRAME_MIN_SHORT_SIDE
      });
      errors.push(...validation.errors.map((error) => `${record.wisteriaId}: ${error}`));
    }
  }
}

for (const room of registry.rooms) {
  if (!byId.has(room.id)) errors.push(`Room ${room.id} lacks a ledger record.`);
}
for (const scene of registry.scenes) {
  if (!byId.has(scene.id)) errors.push(`Scene ${scene.id} lacks a ledger record.`);
  for (const slot of scene.slots) {
    if (slot.representation === 'framed-art' && (!slot.frameEnvelopeBounds || slot.aspectPolicy !== 'match-source-frame')) {
      errors.push(`${slot.id}: framed-art slots require fixed frameEnvelopeBounds and match-source-frame.`);
    }
    if (slot.occupiedBy && !byId.has(slot.occupiedBy)) {
      errors.push(`${slot.id}: occupied item ${slot.occupiedBy} lacks a ledger record.`);
    }
  }
}

const centerSlot = registry.scenes
  .find((scene) => scene.id === 'castle-gallery-wall')
  ?.slots.find((slot) => slot.id === 'gallery-center-frame');
const centerManifest = galleryManifest.apertures?.['gallery-center-frame'];
const centerOccupied = galleryManifest.occupied?.['gallery-center-frame'];
if (!centerSlot || !centerManifest || !centerOccupied) {
  errors.push('Castle Gallery center matched-frame manifest registration is incomplete.');
} else {
  if (!sameBounds(pixelBounds(centerSlot.frameEnvelopeBounds), centerManifest.frameEnvelopeBounds)) {
    errors.push('Castle Gallery manifest frame envelope differs from the location registry.');
  }
  if (!sameBounds(pixelBounds(centerSlot.bounds), centerManifest.frameBounds)) {
    errors.push('Castle Gallery manifest active frame differs from the location registry.');
  }
  if (!sameBounds(pixelBounds(centerSlot.apertureBounds), centerManifest.bounds)) {
    errors.push('Castle Gallery manifest aperture differs from the location registry.');
  }
  if (centerOccupied.aspectRatioError > MATCHED_FRAME_ASPECT_TOLERANCE) {
    errors.push('Castle Gallery proxy/source ratio exceeds the matched-frame tolerance.');
  }
  if (centerOccupied.transparentProxyPixels !== 0) {
    errors.push('Castle Gallery proxy does not cover every aperture pixel.');
  }
}
if (
  galleryManifest.protectedPixels?.shellTransparencyMismatchPixels !== 0 ||
  galleryManifest.protectedPixels?.outsideDifferencePixels !== 0 ||
  galleryManifest.protectedPixels?.outsideRepairDifferencePixels !== 0
) {
  errors.push('Castle Gallery construction changed pixels outside an approved ownership mask.');
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
  console.log(`Verified ${ledger.records.length} Castle entities, ${registry.scenes.length} scene, and ${Object.keys(protectedAssets.assets).length} protected assets under the active Gallery reservation.`);
}
