import {
  CONSTRUCTION_LEDGER_PATH,
  LOCATION_REGISTRY_PATH,
  NOTION_CONFIG_PATH,
  SNAPSHOT_PATH,
  computeSourceHash,
  propertyModel,
  queryDataSource,
  readJson,
  retrieveBlockChildren,
  validateRuntimeEntry,
  writeJsonAtomic
} from './library-framework.mjs';
import { blocksToMarkdown } from './notion-content.mjs';

const token = process.env.NOTION_TOKEN ?? process.env.NOTION_API_TOKEN;
const context = process.env.CONTEXT ?? process.env.WISTERIA_BUILD_CONTEXT ?? 'local';
const required = process.env.WISTERIA_NOTION_REQUIRED === '1';
const maxMediaBytes = Number(
  process.env.WISTERIA_NOTION_MAX_MEDIA_BYTES ?? 20 * 1024 * 1024
);

function itemSources(config) {
  return Object.entries(config.dataSources?.items ?? {}).map(
    ([sceneId, source]) => ({ sceneId, ...source })
  );
}

async function emptySnapshot(reason, config) {
  await writeJsonAtomic(SNAPSHOT_PATH, {
    schemaVersion: 3,
    generatedAt: new Date().toISOString(),
    context,
    dataSourceIds: itemSources(config ?? {}).map((item) => item.dataSourceId),
    disabledReason: reason,
    entries: []
  });
}

async function main() {
  const [config, registry, ledger] = await Promise.all([
    readJson(NOTION_CONFIG_PATH),
    readJson(LOCATION_REGISTRY_PATH),
    readJson(CONSTRUCTION_LEDGER_PATH)
  ]);
  const sources = itemSources(config);
  if (!sources.length) {
    throw new Error('No nested Library Items data sources are registered.');
  }

  if (!token) {
    if (required) throw new Error('NOTION_TOKEN is required for this build.');
    if (context !== 'production') {
      try {
        const cached = await readJson(SNAPSHOT_PATH);
        if (
          cached.schemaVersion === 3 &&
          Array.isArray(cached.entries) &&
          !cached.disabledReason
        ) {
          console.log(
            `Library Notion sync offline: reusing ${cached.entries.length} cached preview entr${cached.entries.length === 1 ? 'y' : 'ies'}.`
          );
          return;
        }
      } catch {
        // A missing or invalid cache falls through to a deterministic empty snapshot.
      }
    }
    await emptySnapshot('NOTION_TOKEN is not configured.', config);
    console.log('Library Notion sync disabled: NOTION_TOKEN is not configured.');
    return;
  }

  const entries = [];
  const seenPageIds = new Set();
  for (const source of sources) {
    const pages = await queryDataSource(token, source.dataSourceId);
    for (const page of pages) {
      const entity = propertyModel(page, 'item', source.sceneId);
      const record = ledger.records.find(
        (candidate) =>
          candidate.entityKind === 'item' &&
          candidate.source === 'notion' &&
          candidate.notionPageId === page.id
      );
      if (!record || record.state === 'retired') continue;
      if (context === 'production' && !record.releaseId) continue;
      seenPageIds.add(page.id);

      const errors = validateRuntimeEntry(
        { ...entity, wisteriaId: record.wisteriaId },
        record,
        { requireRelease: context === 'production' }
      );
      if (errors.length) {
        throw new Error(`${record.wisteriaId}: ${errors.join(' ')}`);
      }
      const scene = registry.scenes.find(
        (candidate) => candidate.id === record.sceneId
      );
      if (!scene || scene.roomId !== record.roomId) {
        throw new Error(`${record.wisteriaId}: ledger location is not registered.`);
      }

      const blocks = await retrieveBlockChildren(token, page.id);
      const media = [];
      const bodyMarkdown = await blocksToMarkdown(blocks, {
        title: entity.title,
        wisteriaId: record.wisteriaId,
        maxMediaBytes,
        media
      });
      const sourceHash = computeSourceHash(entity, bodyMarkdown, media);

      entries.push({
        ...entity,
        wisteriaId: record.wisteriaId,
        sourceHash,
        constructionHash: record.constructionHash,
        lockedConstructionHash: record.lockedConstructionHash,
        constructionVersion: record.constructionVersion,
        roomId: record.roomId,
        sceneId: record.sceneId,
        hotspotId: record.hotspotId,
        representation: record.representation,
        revelationMode: record.revelationMode ?? 'container-revealed',
        releaseId: record.releaseId,
        bodyMarkdown,
        media
      });
    }
  }

  const expectedRecords = ledger.records.filter(
    (record) =>
      record.entityKind === 'item' &&
      record.source === 'notion' &&
      record.state !== 'retired' &&
      (context !== 'production' || record.releaseId)
  );
  const missing = expectedRecords.filter(
    (record) => !seenPageIds.has(record.notionPageId)
  );
  if (missing.length) {
    throw new Error(
      `Registered Notion items left their intrinsic scene without an approved unbind: ${missing.map((record) => record.wisteriaId).join(', ')}`
    );
  }

  await writeJsonAtomic(SNAPSHOT_PATH, {
    schemaVersion: 3,
    generatedAt: new Date().toISOString(),
    context,
    dataSourceIds: sources.map((item) => item.dataSourceId),
    entries
  });
  console.log(
    `Synced ${entries.length} nested Library Notion entr${entries.length === 1 ? 'y' : 'ies'}.`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
