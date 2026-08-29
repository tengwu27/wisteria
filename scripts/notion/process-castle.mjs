import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  CONSTRUCTION_LEDGER_PATH,
  IMPACT_MANIFEST_PATH,
  LOCATION_REGISTRY_PATH,
  NOTION_CONFIG_PATH,
  buildImpactManifest,
  propertyModel,
  queryDataSource,
  readJson,
  resolveConstructionRequest,
  slugify,
  writeJsonAtomic
} from './castle-framework.mjs';

const token = process.env.NOTION_TOKEN ?? process.env.NOTION_API_TOKEN;
if (!token) throw new Error('NOTION_TOKEN is required to inspect Ready Castle entities.');

const [config, registry, ledger] = await Promise.all([
  readJson(NOTION_CONFIG_PATH),
  readJson(LOCATION_REGISTRY_PATH),
  readJson(CONSTRUCTION_LEDGER_PATH)
]);
const baseCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const sources = [
  ...(config.dataSources?.rooms?.dataSourceId
    ? [{ entityKind: 'room', parentId: 'castle', dataSourceId: config.dataSources.rooms.dataSourceId }]
    : []),
  ...Object.entries(config.dataSources?.scenes ?? {}).flatMap(([roomId, source]) =>
    source?.dataSourceId
      ? [{ entityKind: 'scene', parentId: roomId, dataSourceId: source.dataSourceId }]
      : []
  ),
  ...Object.entries(config.dataSources?.items ?? {}).flatMap(([sceneId, source]) =>
    source?.dataSourceId
      ? [{ entityKind: 'item', parentId: sceneId, dataSourceId: source.dataSourceId }]
      : []
  )
];

const requested = [];
for (const source of sources) {
  const pages = await queryDataSource(token, source.dataSourceId, ['Ready']);
  for (const page of pages) {
    const entity = propertyModel(page, source.entityKind, source.parentId);
    const existing = ledger.records.find((record) => record.notionPageId === entity.notionPageId);
    entity.wisteriaId = existing?.wisteriaId ?? slugify(entity.title);
    if (source.entityKind === 'item') entity.representation = 'framed-art';
    const identityConflict = !existing
      ? ledger.records.find((record) => record.wisteriaId === entity.wisteriaId)
      : undefined;
    const resolution = !entity.title.trim()
      ? {
          intent: 'create-location',
          entityKind: source.entityKind,
          parentId: source.parentId,
          reason: 'A title is required before Wisteria can assign an identity.',
          executable: false
        }
      : identityConflict
        ? {
            intent: 'create-location',
            entityKind: entity.entityKind,
            parentId: entity.parentId,
            reason: `Wisteria ID ${entity.wisteriaId} already belongs to another entity.`,
            executable: false
          }
        : resolveConstructionRequest(entity, registry, ledger);
    requested.push({ entity, resolution });
  }
}

const grouped = new Map();
for (const request of requested) {
  const manifest = buildImpactManifest(request.entity, request.resolution, registry, ledger, { baseCommit });
  const group = grouped.get(manifest.lockScope) ?? {
    schemaVersion: 1,
    sessionId: randomUUID(),
    generatedAt: new Date().toISOString(),
    lockScope: manifest.lockScope,
    baseCommit,
    requestedEntityIds: [],
    affectedEntityIds: [],
    protectedDescendantIds: [],
    manifests: [],
    blockingReasons: []
  };
  for (const key of ['requestedEntityIds', 'affectedEntityIds', 'protectedDescendantIds', 'blockingReasons']) {
    group[key].push(...manifest[key]);
  }
  group.manifests.push(manifest);
  grouped.set(manifest.lockScope, group);
}
for (const group of grouped.values()) {
  for (const key of ['requestedEntityIds', 'affectedEntityIds', 'protectedDescendantIds', 'blockingReasons']) {
    group[key] = [...new Set(group[key])];
  }
}

const result = {
  schemaVersion: 1,
  structureId: 'castle',
  generatedAt: new Date().toISOString(),
  baseCommit,
  sessions: [...grouped.values()]
};
await writeJsonAtomic(IMPACT_MANIFEST_PATH, result);
console.log(result.sessions.length ? JSON.stringify(result, null, 2) : 'No Ready Castle entities require processing.');
console.log('No branch, PR, artwork, ledger, or Notion status was changed.');

