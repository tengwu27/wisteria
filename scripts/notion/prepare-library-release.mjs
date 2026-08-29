import {
  CONSTRUCTION_LEDGER_PATH,
  createPageComment,
  readJson,
  sha256,
  writeJsonAtomic
} from './library-framework.mjs';

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const entityIds = (argument('ids') ?? '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const confirmed = process.argv.includes('--confirm-approved-preview');
if (!entityIds.length || !confirmed) {
  throw new Error(
    'Usage: npm run notion:library:release -- --ids <id,id> --confirm-approved-preview'
  );
}

const ledger = await readJson(CONSTRUCTION_LEDGER_PATH);
const records = entityIds.map((id) => {
  const record = ledger.records.find((item) => item.wisteriaId === id);
  if (!record) throw new Error(`Unknown construction entity: ${id}`);
  if (record.state !== 'locked') throw new Error(`${id} is not construction-locked.`);
  if (!record.pendingVersion || record.pendingVersion.state !== 'approved') {
    throw new Error(
      `${id} has no explicitly approved pending preview. Record preview approval before preparing a release.`
    );
  }
  if (record.pendingVersion.constructionHash !== record.constructionHash) {
    throw new Error(`${id} pending preview does not match the current construction hash.`);
  }
  record.releaseId = `library-${id}-v${record.constructionVersion}-${sha256(record.lockedConstructionHash).slice(0, 10)}`;
  record.pendingVersion.releaseId = record.releaseId;
  return record;
});
await writeJsonAtomic(CONSTRUCTION_LEDGER_PATH, ledger);

const token = process.env.NOTION_TOKEN ?? process.env.NOTION_API_TOKEN;
if (token) {
  for (const record of records) {
    if (!record.notionPageId) continue;
    await createPageComment(
      token,
      record.notionPageId,
      `Approved preview prepared for landing as ${record.releaseId}. It is not Alive until the merged commit is verified in production.`
    );
  }
}
console.log(`Prepared ${records.length} construction release record(s) for landing.`);
