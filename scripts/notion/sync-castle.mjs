import {
  CONSTRUCTION_LEDGER_PATH,
  LOCATION_REGISTRY_PATH,
  MEDIA_ROOT,
  NOTION_CONFIG_PATH,
  SNAPSHOT_PATH,
  computeSourceHash,
  propertyModel,
  queryDataSource,
  readJson,
  retrieveBlockChildren,
  validateRuntimeEntry,
  writeJsonAtomic
} from './castle-framework.mjs';
import { blocksToMarkdown } from './notion-content.mjs';

const token = process.env.NOTION_TOKEN ?? process.env.NOTION_API_TOKEN;
const context = process.env.CONTEXT ?? process.env.WISTERIA_BUILD_CONTEXT ?? 'local';
const required = process.env.WISTERIA_NOTION_REQUIRED === '1';
const maxMediaBytes = Number(
  process.env.WISTERIA_NOTION_MAX_MEDIA_BYTES ?? 20 * 1024 * 1024
);

function itemSources(config) {
  return Object.entries(config.dataSources?.items ?? {}).flatMap(
    ([sceneId, source]) => source?.dataSourceId ? [{ sceneId, ...source }] : []
  );
}

async function offlineSnapshot(reason, config, ledger) {
  const entries = ledger.records
    .filter(
      (record) =>
        record.entityKind === 'item' &&
        record.sourceArtwork &&
        record.state !== 'retired'
    )
    .map((record) => ({
      notionPageId: record.notionPageId,
      entityKind: 'item',
      parentId: record.parentId,
      title: record.wisteriaId === 'still-life-with-wisteria'
        ? 'Still Life with Wisteria'
        : record.wisteriaId,
      prompt: '',
      status: record.state === 'locked' ? 'Alive' : 'Processing',
      lastEditedTime: '',
      wisteriaId: record.wisteriaId,
      sourceHash: record.sourceArtwork.sha256,
      constructionHash: record.constructionHash,
      lockedConstructionHash: record.lockedConstructionHash,
      constructionVersion: record.constructionVersion,
      roomId: record.roomId,
      sceneId: record.sceneId,
      hotspotId: record.hotspotId,
      representation: record.representation,
      releaseId: record.releaseId,
      bodyMarkdown: '',
      media: record.sourceArtwork.publicPath
        ? [{
            notionBlockId: record.sourceArtwork.notionBlockId,
            sha256: record.sourceArtwork.sha256,
            publicPath: record.sourceArtwork.publicPath,
            contentType: record.sourceArtwork.contentType,
            byteLength: 0
          }]
        : []
    }));
  await writeJsonAtomic(SNAPSHOT_PATH, {
    schemaVersion: 3,
    structureId: 'castle',
    generatedAt: new Date().toISOString(),
    context,
    dataSourceIds: itemSources(config).map((item) => item.dataSourceId),
    disabledReason: reason,
    entries
  });
}

async function main() {
  const [config, registry, ledger] = await Promise.all([
    readJson(NOTION_CONFIG_PATH),
    readJson(LOCATION_REGISTRY_PATH),
    readJson(CONSTRUCTION_LEDGER_PATH)
  ]);
  const sources = itemSources(config);

  if (!token || !sources.length) {
    const reason = !token
      ? 'NOTION_TOKEN is not configured.'
      : 'No Castle Items data sources are registered.';
    if (required) throw new Error(reason);
    await offlineSnapshot(reason, config, ledger);
    console.log(`Castle Notion sync offline: ${reason}`);
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
      if (context === 'production' && (!record.releaseId || record.state !== 'locked')) {
        continue;
      }
      seenPageIds.add(page.id);
      const errors = validateRuntimeEntry(
        { ...entity, wisteriaId: record.wisteriaId },
        record,
        { requireRelease: context === 'production' }
      );
      if (record.state === 'pending' && context !== 'production') {
        errors.splice(0, errors.length);
      }
      if (errors.length) throw new Error(`${record.wisteriaId}: ${errors.join(' ')}`);

      const scene = registry.scenes.find((candidate) => candidate.id === record.sceneId);
      if (!scene || scene.roomId !== record.roomId) {
        throw new Error(`${record.wisteriaId}: ledger location is not registered.`);
      }

      const blocks = await retrieveBlockChildren(token, page.id);
      const media = [];
      const bodyMarkdown = await blocksToMarkdown(blocks, {
        title: entity.title,
        wisteriaId: record.wisteriaId,
        structureId: 'castle',
        mediaRoot: MEDIA_ROOT,
        maxMediaBytes,
        media
      });
      if (record.sourceArtwork?.sha256 && media[0]?.sha256 !== record.sourceArtwork.sha256) {
        throw new Error(
          `${record.wisteriaId}: the first Notion image no longer matches the registered source artwork.`
        );
      }
      entries.push({
        ...entity,
        wisteriaId: record.wisteriaId,
        sourceHash: computeSourceHash(entity, bodyMarkdown, media),
        constructionHash: record.constructionHash,
        lockedConstructionHash: record.lockedConstructionHash,
        constructionVersion: record.constructionVersion,
        roomId: record.roomId,
        sceneId: record.sceneId,
        hotspotId: record.hotspotId,
        representation: record.representation,
        releaseId: record.releaseId,
        bodyMarkdown,
        media
      });
    }
  }

  const expected = ledger.records.filter(
    (record) =>
      record.entityKind === 'item' &&
      record.source === 'notion' &&
      record.notionPageId &&
      record.state !== 'retired' &&
      (context !== 'production' || (record.state === 'locked' && record.releaseId))
  );
  const missing = expected.filter((record) => !seenPageIds.has(record.notionPageId));
  if (missing.length) {
    throw new Error(
      `Registered Castle items left their intrinsic scene without an approved unbind: ${missing.map((record) => record.wisteriaId).join(', ')}`
    );
  }

  await writeJsonAtomic(SNAPSHOT_PATH, {
    schemaVersion: 3,
    structureId: 'castle',
    generatedAt: new Date().toISOString(),
    context,
    dataSourceIds: sources.map((item) => item.dataSourceId),
    entries
  });
  console.log(`Synced ${entries.length} nested Castle Notion entr${entries.length === 1 ? 'y' : 'ies'}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

