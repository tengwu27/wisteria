import {
  NOTION_CONFIG_PATH,
  notionRequest,
  readJson
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

async function main() {
  if (!token) {
    if (required) {
      throw new Error('NOTION_TOKEN is required to enforce inline Library databases.');
    }
    console.log('Library inline database enforcement skipped: NOTION_TOKEN is not configured.');
    return;
  }

  const config = await readJson(NOTION_CONFIG_PATH);
  if (config.databaseDefaults?.isInline === false) {
    console.log('Library inline database enforcement disabled by notion.json.');
    return;
  }

  let changed = 0;
  const databases = registeredDatabases(config);
  for (const databaseRef of databases) {
    const database = await notionRequest(
      token,
      `/databases/${databaseRef.databaseId}`
    );
    if (database.archived || database.in_trash) {
      throw new Error(`${databaseRef.label} is archived and cannot be enforced inline.`);
    }
    if (database.is_inline) continue;

    await notionRequest(token, `/databases/${databaseRef.databaseId}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_inline: true })
    });
    changed += 1;
    console.log(`Made ${databaseRef.label} inline.`);
  }

  console.log(
    `Verified ${databases.length} registered Library databases; ${changed} changed to inline.`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
