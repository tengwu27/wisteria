import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  CONSTRUCTION_LEDGER_PATH,
  LOCATION_REGISTRY_PATH,
  isProtectedAssetChangeAllowed,
  readJson,
  validateLockedRecord
} from './library-framework.mjs';

const [registry, ledger, protectedAssets] = await Promise.all([
  readJson(LOCATION_REGISTRY_PATH),
  readJson(CONSTRUCTION_LEDGER_PATH),
  readJson('world/structures/library/protected-assets.json')
]);
const errors = [];
const byId = new Map();
const notionPageIds = new Set();
const slotIds = new Set();
const hotspotIds = new Set();

if (registry.schemaVersion !== 3) errors.push('Library location schema must be version 3.');
if ('templates' in registry || 'templateId' in registry) {
  errors.push('Library location templates are forbidden.');
}
if (!Array.isArray(registry.map?.nodes) || !Array.isArray(registry.map?.edges)) {
  errors.push('Library spatial graph is missing.');
}

for (const record of ledger.records) {
  if (byId.has(record.wisteriaId)) {
    errors.push(`Duplicate Wisteria ID: ${record.wisteriaId}`);
  }
  byId.set(record.wisteriaId, record);
  if (record.notionPageId) {
    if (notionPageIds.has(record.notionPageId)) {
      errors.push(`Duplicate Notion page identity: ${record.notionPageId}`);
    }
    notionPageIds.add(record.notionPageId);
  }
  errors.push(
    ...validateLockedRecord(record, { requireRelease: false }).map(
      (error) => `${record.wisteriaId}: ${error}`
    )
  );
}

for (const record of ledger.records) {
  if (record.parentId && !byId.has(record.parentId)) {
    errors.push(`${record.wisteriaId}: parent ${record.parentId} is not registered.`);
  }

  if (record.entityKind !== 'item') continue;
  if (slotIds.has(record.slotId)) errors.push(`Multiple artifacts occupy slot: ${record.slotId}`);
  if (hotspotIds.has(record.hotspotId)) errors.push(`Duplicate hotspot ID: ${record.hotspotId}`);
  slotIds.add(record.slotId);
  hotspotIds.add(record.hotspotId);
  const room = registry.rooms.find((item) => item.id === record.roomId);
  const scene = registry.scenes.find((item) => item.id === record.sceneId);
  const slot = scene?.slots.find((item) => item.id === record.slotId);
  if (!room || !scene || scene.roomId !== room.id || !slot) {
    errors.push(`Invalid placement identity for ${record.wisteriaId}.`);
  }
  if (slot && slot.occupiedBy !== record.wisteriaId) {
    errors.push(
      `${record.wisteriaId}: slot ${record.slotId} is occupied by ${slot.occupiedBy ?? 'nothing'}.`
    );
  }
  if (slot?.occupiedBy !== record.wisteriaId) {
    errors.push(`${record.wisteriaId}: registry slot occupancy is not authoritative.`);
  }
}

for (const record of ledger.records) {
  if (record.parentId && !byId.has(record.parentId)) {
    errors.push(`${record.wisteriaId}: parent ${record.parentId} is not registered.`);
  }
  for (const descendantId of record.dependencyLock?.protectedDescendantIds ?? []) {
    const descendant = byId.get(descendantId);
    if (!descendant) {
      errors.push(`${record.wisteriaId}: protected descendant ${descendantId} is missing.`);
    } else if (descendant.parentId !== record.wisteriaId) {
      errors.push(`${record.wisteriaId}: ${descendantId} is not a direct registered child.`);
    }
  }
}

for (const room of registry.rooms) {
  if (!byId.has(room.id)) errors.push(`Room ${room.id} lacks a ledger record.`);
  if (!registry.map.nodes.some((node) => node.roomId === room.id)) {
    errors.push(`Room ${room.id} lacks a spatial-map node.`);
  }
}
for (const scene of registry.scenes) {
  if (!byId.has(scene.id)) errors.push(`Scene ${scene.id} lacks a ledger record.`);
  for (const slot of scene.slots) {
    if (slot.occupiedBy && !byId.has(slot.occupiedBy)) {
      errors.push(`${slot.id}: occupied item ${slot.occupiedBy} lacks a ledger record.`);
    }
  }
}
for (const edge of registry.map.edges) {
  if (
    !registry.map.nodes.some((node) => node.roomId === edge.from) ||
    !registry.map.nodes.some((node) => node.roomId === edge.to)
  ) {
    errors.push(`Spatial edge ${edge.from} -> ${edge.to} references an unknown room.`);
  }
}

for (const unlock of ledger.activeUnlocks) {
  const root = byId.get(unlock.rootEntityId);
  if (!root) errors.push(`Unlock ${unlock.id} has an unknown root entity.`);
  for (const id of unlock.affectedEntityIds) {
    if (!byId.has(id)) errors.push(`Unlock ${unlock.id} includes unknown entity ${id}.`);
  }
}

for (const [filePath, protection] of Object.entries(protectedAssets.assets)) {
  const actualHash = createHash('sha256')
    .update(await readFile(filePath))
    .digest('hex');
  if (
    actualHash !== protection.sha256 &&
    !isProtectedAssetChangeAllowed(protection, ledger)
  ) {
    errors.push(`Protected cinematic asset changed without unlock: ${filePath}`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    `Verified ${ledger.records.length} registered Library entities, ${registry.map.nodes.length} spatial nodes, and ${Object.keys(protectedAssets.assets).length} protected assets.`
  );
}
