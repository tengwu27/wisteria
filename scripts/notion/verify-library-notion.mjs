import {
  CONSTRUCTION_LEDGER_PATH,
  NOTION_CONFIG_PATH,
  notionRequest,
  queryDataSource,
  readJson,
  retrievePage
} from './library-framework.mjs';

const token = process.env.NOTION_TOKEN ?? process.env.NOTION_API_TOKEN;
if (!token) throw new Error('NOTION_TOKEN is required to verify the Library hierarchy.');

const [config, ledger] = await Promise.all([
  readJson(NOTION_CONFIG_PATH),
  readJson(CONSTRUCTION_LEDGER_PATH)
]);
const errors = [];

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
