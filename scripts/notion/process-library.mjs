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
} from './library-framework.mjs';

const token = process.env.NOTION_TOKEN ?? process.env.NOTION_API_TOKEN;
if (!token) {
  throw new Error('NOTION_TOKEN is required to inspect Ready Library entities.');
}

const [config, registry, ledger] = await Promise.all([
  readJson(NOTION_CONFIG_PATH),
  readJson(LOCATION_REGISTRY_PATH),
  readJson(CONSTRUCTION_LEDGER_PATH)
]);

const baseCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
  encoding: 'utf8'
}).trim();

const sources = [
  {
    entityKind: 'room',
    parentId: 'library',
    dataSourceId: config.dataSources.rooms.dataSourceId
  },
  ...Object.entries(config.dataSources.scenes).map(([roomId, source]) => ({
    entityKind: 'scene',
    parentId: roomId,
    dataSourceId: source.dataSourceId
  })),
  ...Object.entries(config.dataSources.items).map(([sceneId, source]) => ({
    entityKind: 'item',
    parentId: sceneId,
    dataSourceId: source.dataSourceId
  }))
];

const requested = [];
for (const source of sources) {
  const pages = await queryDataSource(token, source.dataSourceId, ['Ready']);
  for (const page of pages) {
    const entity = propertyModel(page, source.entityKind, source.parentId);
    if (!entity.title.trim()) {
      requested.push({
        entity,
        resolution: {
          intent: 'create-location',
          entityKind: source.entityKind,
          parentId: source.parentId,
          reason: 'A title is required before Wisteria can assign an identity.',
          executable: false
        }
      });
      continue;
    }
    const existing = ledger.records.find(
      (record) => record.notionPageId === entity.notionPageId
    );
    entity.wisteriaId = existing?.wisteriaId ?? slugify(entity.title);
    const identityConflict = !existing
      ? ledger.records.find((record) => record.wisteriaId === entity.wisteriaId)
      : undefined;
    requested.push({
      entity,
      resolution: identityConflict
        ? {
            intent: 'create-location',
            entityKind: entity.entityKind,
            parentId: entity.parentId,
            reason: `Wisteria ID ${entity.wisteriaId} already belongs to Notion page ${identityConflict.notionPageId ?? 'a repository entity'}. Rename this proposal before processing.`,
            executable: false
          }
        : resolveConstructionRequest(entity, registry, ledger)
    });
  }
}

const grouped = new Map();
for (const request of requested) {
  const manifest = buildImpactManifest(request.entity, request.resolution, registry, ledger, {
    baseCommit
  });
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
  group.requestedEntityIds.push(...manifest.requestedEntityIds);
  group.affectedEntityIds.push(...manifest.affectedEntityIds);
  group.protectedDescendantIds.push(...manifest.protectedDescendantIds);
  group.blockingReasons.push(...manifest.blockingReasons);
  group.manifests.push(manifest);
  grouped.set(manifest.lockScope, group);
}

for (const group of grouped.values()) {
  for (const key of [
    'requestedEntityIds',
    'affectedEntityIds',
    'protectedDescendantIds',
    'blockingReasons'
  ]) {
    group[key] = [...new Set(group[key])];
  }
}

const result = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  baseCommit,
  sessions: [...grouped.values()]
};
await writeJsonAtomic(IMPACT_MANIFEST_PATH, result);

if (!result.sessions.length) {
  console.log('No Ready Library entities require processing.');
} else {
  console.log(JSON.stringify(result, null, 2));
  console.log(`\nImpact manifest written to ${IMPACT_MANIFEST_PATH}.`);
  console.log('No branch, PR, artwork, ledger, or Notion status was changed.');
}
