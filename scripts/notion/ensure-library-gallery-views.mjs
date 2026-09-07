import {
  NOTION_CONFIG_PATH,
  galleryShowsAllProperties,
  notionRequest,
  readJson,
  visibleGalleryProperties
} from './library-framework.mjs';

const token = process.env.NOTION_TOKEN ?? process.env.NOTION_API_TOKEN;
const required = process.env.WISTERIA_NOTION_REQUIRED === '1';

function registeredDatabases(config) {
  return [
    { label: 'Library Rooms', ...config.dataSources.rooms },
    ...Object.entries(config.dataSources.scenes ?? {}).map(
      ([parentId, source]) => ({ label: `${parentId} Scenes`, ...source })
    ),
    ...Object.entries(config.dataSources.items ?? {}).map(
      ([parentId, source]) => ({ label: `${parentId} Items`, ...source })
    )
  ];
}

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

async function main() {
  if (!token) {
    if (required) {
      throw new Error('NOTION_TOKEN is required to enforce Library gallery views.');
    }
    console.log('Library gallery view enforcement skipped: NOTION_TOKEN is not configured.');
    return;
  }

  const config = await readJson(NOTION_CONFIG_PATH);
  const viewDefaults = config.databaseDefaults?.primaryView ?? {
    name: 'Tiles',
    type: 'gallery'
  };
  const databases = registeredDatabases(config);
  let created = 0;
  let configured = 0;

  for (const databaseRef of databases) {
    const viewRefs = await listViews(databaseRef.databaseId);
    let views = await Promise.all(
      viewRefs.map((view) => notionRequest(token, `/views/${view.id}`))
    );
    if (!views.some((view) => view.type === viewDefaults.type && view.name === viewDefaults.name)) {
      const view = await notionRequest(token, '/views', {
        method: 'POST',
        body: JSON.stringify({
          database_id: databaseRef.databaseId,
          data_source_id: databaseRef.dataSourceId,
          name: viewDefaults.name,
          type: viewDefaults.type,
          position: { type: 'start' }
        })
      });
      views = [...views, view];
      created += 1;
      console.log(`Created primary ${viewDefaults.name} view for ${databaseRef.label}.`);
    }

    if (viewDefaults.showAllProperties === false) continue;
    const source = await notionRequest(token, `/data_sources/${databaseRef.dataSourceId}`);
    const wrapProperties = viewDefaults.wrapProperties !== false;
    for (const view of views.filter((candidate) => candidate.type === 'gallery')) {
      if (galleryShowsAllProperties(view, source.properties, wrapProperties)) continue;
      await notionRequest(token, `/views/${view.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          configuration: {
            type: 'gallery',
            properties: visibleGalleryProperties(
              source.properties,
              view.configuration?.properties,
              wrapProperties
            )
          }
        })
      });
      configured += 1;
      console.log(`Made every property visible in ${databaseRef.label} / ${view.name}.`);
    }
  }

  console.log(
    `Verified ${databases.length} registered Library databases; ${created} primary gallery views created and ${configured} gallery views configured.`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
