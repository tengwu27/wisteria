import { randomUUID } from 'node:crypto';
import {
  CONSTRUCTION_LEDGER_PATH,
  createPageComment,
  readJson,
  writeJsonAtomic
} from './library-framework.mjs';

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const rootEntityId = argument('root');
const affectedEntityIds = (argument('affected') ?? '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const scope = argument('scope');
const reason = argument('reason');
const approvedBy = argument('approved-by');
const allowedScopes = new Set(['item', 'scene', 'room', 'cinematic-media']);

if (
  !rootEntityId ||
  !affectedEntityIds.length ||
  !allowedScopes.has(scope) ||
  !reason ||
  !approvedBy
) {
  throw new Error(
    'Usage: npm run notion:library:unlock -- --root <id> --affected <id,id> --scope <item|scene|room|cinematic-media> --reason <reason> --approved-by <name>'
  );
}

const ledger = await readJson(CONSTRUCTION_LEDGER_PATH);
const root = ledger.records.find((item) => item.wisteriaId === rootEntityId);
if (!root) throw new Error(`Unknown root entity: ${rootEntityId}`);
for (const entityId of affectedEntityIds) {
  if (!ledger.records.some((item) => item.wisteriaId === entityId)) {
    throw new Error(`Unknown affected entity: ${entityId}`);
  }
}

const unlock = {
  id: randomUUID(),
  rootEntityId,
  affectedEntityIds: [...new Set(affectedEntityIds)],
  scope,
  reason,
  approvedAt: new Date().toISOString(),
  approvedBy
};
ledger.activeUnlocks.push(unlock);
await writeJsonAtomic(CONSTRUCTION_LEDGER_PATH, ledger);

const token = process.env.NOTION_TOKEN ?? process.env.NOTION_API_TOKEN;
if (token && root.notionPageId) {
  await createPageComment(
    token,
    root.notionPageId,
    `Scoped construction unlock ${unlock.id}: ${scope}; affected IDs: ${unlock.affectedEntityIds.join(', ')}; approved by ${approvedBy}. ${reason}`
  );
}
console.log(`Created scoped unlock ${unlock.id} for ${rootEntityId}.`);
