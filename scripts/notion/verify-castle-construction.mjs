import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  CONSTRUCTION_LEDGER_PATH,
  LOCATION_REGISTRY_PATH,
  PROTECTED_ASSETS_PATH,
  isProtectedAssetChangeAllowed,
  readJson,
  validateLockedRecord
} from './castle-framework.mjs';

const [registry, ledger, protectedAssets] = await Promise.all([
  readJson(LOCATION_REGISTRY_PATH),
  readJson(CONSTRUCTION_LEDGER_PATH),
  readJson(PROTECTED_ASSETS_PATH)
]);
const errors = [];
const byId = new Map();
const slotIds = new Set();
const hotspotIds = new Set();

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
    if (!record.apertureBounds || !record.apertureMaskId) {
      errors.push(`${record.wisteriaId}: framed art requires an aperture and mask.`);
    }
    if (!record.sourceArtwork?.sha256 || !record.wallProxy?.sha256) {
      errors.push(`${record.wisteriaId}: framed art source/proxy identity is incomplete.`);
    }
  }
}

for (const room of registry.rooms) {
  if (!byId.has(room.id)) errors.push(`Room ${room.id} lacks a ledger record.`);
}
for (const scene of registry.scenes) {
  if (!byId.has(scene.id)) errors.push(`Scene ${scene.id} lacks a ledger record.`);
  for (const slot of scene.slots) {
    if (slot.occupiedBy && !byId.has(slot.occupiedBy)) {
      errors.push(`${slot.id}: occupied item ${slot.occupiedBy} lacks a ledger record.`);
    }
  }
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

