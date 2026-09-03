import {
  CONSTRUCTION_LEDGER_PATH,
  NOTION_CONFIG_PATH,
  canonicalArtworkIdentityProperties,
  notionRequest,
  readJson,
  updatePageProperties,
  upsertCanonicalArtworkPage
} from './castle-framework.mjs';

const token = process.env.NOTION_TOKEN ?? process.env.NOTION_API_TOKEN;
const required = process.env.WISTERIA_NOTION_REQUIRED === '1';
const upsertApproved = process.argv.includes('--upsert-approved');

const PROPERTY_DEFINITIONS = {
  'Art Type': {
    select: {
      options: [
        { name: 'Painting', color: 'purple' },
        { name: 'Sculpture', color: 'orange' },
        { name: 'Installation', color: 'blue' }
      ]
    }
  },
  'Wisteria ID': { rich_text: {} },
  'Canonical SHA-256': { rich_text: {} },
  'Composition Version': { number: { format: 'number' } },
  'Preview/PR URL': { url: {} }
};

const EXPECTED_PROPERTY_TYPES = {
  Title: 'title',
  'Appearance Prompt': 'rich_text',
  'Wisteria Status': 'select',
  'Art Type': 'select',
  'Wisteria ID': 'rich_text',
  'Canonical SHA-256': 'rich_text',
  'Composition Version': 'number',
  'Preview/PR URL': 'url'
};

async function main() {
  if (!token) {
    if (required) throw new Error('NOTION_TOKEN is required to enforce the Castle art catalog.');
    console.log('Castle art catalog enforcement skipped: NOTION_TOKEN is not configured.');
    return;
  }

  const [config, ledger] = await Promise.all([
    readJson(NOTION_CONFIG_PATH),
    readJson(CONSTRUCTION_LEDGER_PATH)
  ]);
  let alteredSources = 0;
  for (const [sceneId, reference] of Object.entries(config.dataSources?.items ?? {})) {
    const source = await notionRequest(token, `/data_sources/${reference.dataSourceId}`);
    const missing = {};
    for (const [name, type] of Object.entries(EXPECTED_PROPERTY_TYPES)) {
      const property = source.properties?.[name];
      if (!property && PROPERTY_DEFINITIONS[name]) {
        missing[name] = PROPERTY_DEFINITIONS[name];
      } else if (!property) {
        throw new Error(`${sceneId}: required existing Notion property ${name} is missing.`);
      } else if (property.type !== type) {
        throw new Error(`${sceneId}: ${name} must remain a ${type} property.`);
      }
    }
    if (Object.keys(missing).length) {
      await notionRequest(token, `/data_sources/${reference.dataSourceId}`, {
        method: 'PATCH',
        body: JSON.stringify({ properties: missing })
      });
      alteredSources += 1;
    }
  }

  let upserts = 0;
  for (const record of ledger.records.filter(
    (candidate) => candidate.entityKind === 'item' && candidate.revelationMode === 'self-revealing'
  )) {
    const reference = config.dataSources?.items?.[record.sceneId];
    const seed = config.artCatalog?.seed?.[record.wisteriaId];
    if (!reference || !seed) {
      throw new Error(`${record.wisteriaId}: missing Notion data source or catalog seed.`);
    }
    const artwork = {
      ...seed,
      wisteriaId: record.wisteriaId,
      notionPageId: record.notionPageId,
      canonicalSha256: record.sourceArtwork.sha256,
      compositionVersion: record.compositionVersion
    };
    if (upsertApproved) {
      await upsertCanonicalArtworkPage(token, reference.dataSourceId, {
        ...artwork,
        status: 'Processing'
      });
      upserts += 1;
    } else if (record.notionPageId) {
      await updatePageProperties(
        token,
        record.notionPageId,
        canonicalArtworkIdentityProperties(artwork)
      );
    }
  }

  console.log(
    `Verified ${Object.keys(config.dataSources?.items ?? {}).length} Castle art catalogs; ${alteredSources} schemas extended and ${upserts} approved records upserted.`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
