import {
  CONSTRUCTION_LEDGER_PATH,
  NOTION_CONFIG_PATH,
  galleryShowsAllProperties,
  notionRequest,
  queryDataSource,
  readJson,
  retrievePage
} from './library-framework.mjs';

const token = process.env.NOTION_TOKEN ?? process.env.NOTION_API_TOKEN;
const required = process.env.WISTERIA_NOTION_REQUIRED === '1';
if (!token) {
  if (required) throw new Error('NOTION_TOKEN is required to verify the Library hierarchy.');
  console.log('Library Notion verification skipped: NOTION_TOKEN is not configured.');
  process.exit(0);
}

const [config, ledger] = await Promise.all([
  readJson(NOTION_CONFIG_PATH),
  readJson(CONSTRUCTION_LEDGER_PATH)
]);
const errors = [];

async function listViews(databaseId) {
  const views = [];
  let startCursor;
  do {
    const query = new URLSearchParams({ database_id: databaseId, page_size: '100' });
    if (startCursor) query.set('start_cursor', startCursor);
    const response = await notionRequest(token, `/views?${query}`);
    views.push(...response.results);
    startCursor = response.has_more ? response.next_cursor : undefined;
  } while (startCursor);
  return views;
}

const registeredDatabases = [
  config.dataSources.rooms,
  ...Object.values(config.dataSources.scenes),
  ...Object.values(config.dataSources.items)
];

for (const source of registeredDatabases) {
  const database = await notionRequest(token, `/databases/${source.databaseId}`);
  if (!database.is_inline) {
    errors.push(`${source.databaseId}: registered Library database is not inline.`);
  }
}

const expectedSchemas = [
  {
    dataSourceId: config.dataSources.rooms.dataSourceId,
    properties: ['Room Name', 'Room Prompt', 'Wisteria Status']
  },
  ...Object.values(config.dataSources.scenes).map((source) => ({
    dataSourceId: source.dataSourceId,
    properties: ['Scene Name', 'Scene Prompt', 'Wisteria Status']
  })),
  ...Object.values(config.dataSources.items).map((source) => ({
    dataSourceId: source.dataSourceId,
    properties: ['Appearance Prompt', 'Title', 'Wisteria Status']
  }))
];

for (const expected of expectedSchemas) {
  const source = await notionRequest(token, `/data_sources/${expected.dataSourceId}`);
  const actual = Object.keys(source.properties ?? {}).sort();
  const wanted = [...expected.properties].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    errors.push(
      `${expected.dataSourceId}: expected only ${wanted.join(', ')}, found ${actual.join(', ')}.`
    );
  }
}

for (const sourceRef of registeredDatabases) {
  const source = await notionRequest(token, `/data_sources/${sourceRef.dataSourceId}`);
  const viewRefs = await listViews(sourceRef.databaseId);
  const views = await Promise.all(
    viewRefs.map((view) => notionRequest(token, `/views/${view.id}`))
  );
  const tiles = views.find((view) => view.name === 'Tiles' && view.type === 'gallery');
  if (!tiles || !galleryShowsAllProperties(tiles, source.properties, true)) {
    errors.push(`${sourceRef.databaseId}: primary Tiles gallery must show and wrap every property.`);
  }
}

for (const record of ledger.records.filter((item) => item.notionPageId)) {
  const page = await retrievePage(token, record.notionPageId);
  if (page.archived || page.in_trash) {
    errors.push(`${record.wisteriaId}: registered Notion page is archived.`);
  }
  const actualParent = String(
    page.parent?.data_source_id ?? page.parent?.database_id ?? ''
  ).replaceAll('-', '');
  const expectedParent =
    record.entityKind === 'room'
      ? config.dataSources.rooms.dataSourceId
      : record.entityKind === 'scene'
        ? config.dataSources.scenes[record.parentId]?.dataSourceId
        : record.entityKind === 'item'
          ? config.dataSources.items[record.parentId]?.dataSourceId
          : undefined;
  if (
    expectedParent &&
    actualParent !== String(expectedParent).replaceAll('-', '')
  ) {
    errors.push(`${record.wisteriaId}: Notion containment conflicts with the repository parent.`);
  }
  if (record.entityKind !== 'item') continue;
  const expectedSource = config.dataSources.items[record.parentId]?.dataSourceId;
  const actualSource = page.parent?.data_source_id ?? page.parent?.database_id;
  if (
    !expectedSource ||
    String(expectedSource).replaceAll('-', '') !== String(actualSource).replaceAll('-', '')
  ) {
    errors.push(`${record.wisteriaId}: item is outside its intrinsic scene database.`);
  }
}

for (const [sceneId, source] of Object.entries(config.dataSources.items)) {
  const pages = await queryDataSource(token, source.dataSourceId);
  for (const page of pages) {
    const record = ledger.records.find((item) => item.notionPageId === page.id);
    if (record && record.parentId !== sceneId) {
      errors.push(`${record.wisteriaId}: ledger parent conflicts with Notion containment.`);
    }
  }
}

if (!config.legacy?.archived) errors.push('The legacy Library Collection is not marked archived.');
const legacy = await notionRequest(token, `/databases/${config.legacy.databaseId}`);
if (!legacy.archived && !legacy.in_trash) {
  errors.push('The legacy giant Library Collection still appears active in Notion.');
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    `Verified ${expectedSchemas.length} inline minimal nested data sources and ${ledger.records.filter((item) => item.notionPageId).length} registered Notion identities.`
  );
}
