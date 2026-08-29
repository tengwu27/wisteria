import { readFile } from 'node:fs/promises';
import {
  CONSTRUCTION_LEDGER_PATH,
  createPageComment,
  readJson,
  statusValue,
  updatePageProperties
} from '../notion/library-framework.mjs';

const repository = process.env.GITHUB_REPOSITORY;
const githubToken = process.env.GITHUB_TOKEN;
const notionToken = process.env.NOTION_TOKEN ?? process.env.NOTION_API_TOKEN;
const eventPath = process.env.GITHUB_EVENT_PATH;
if (!repository || !githubToken || !notionToken || !eventPath) {
  throw new Error('GitHub event context and NOTION_TOKEN are required.');
}

const [owner, repo] = repository.split('/');
const event = JSON.parse(await readFile(eventPath, 'utf8'));
const status = event.deployment_status;
const manual = event.inputs;
if (!manual && (status?.state !== 'success' || !/production/i.test(event.deployment?.environment ?? ''))) {
  console.log('Ignoring non-production or unsuccessful deployment status.');
  process.exit(0);
}

const commit = manual?.commit ?? event.deployment?.sha;
const deploymentUrl = manual?.production_url ?? status?.environment_url ?? status?.target_url ?? '';
if (!commit) throw new Error('A deployed commit SHA is required.');

const response = await fetch(
  `https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(commit)}/pulls`,
  {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${githubToken}`,
      'X-GitHub-Api-Version': '2022-11-28'
    }
  }
);
if (!response.ok) throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
const pulls = await response.json();
const marker = /<!--\s*wisteria-construction\s*([\s\S]*?)-->/i;
const entityIds = new Set();
for (const pull of pulls) {
  if (!pull.merged_at) continue;
  const match = String(pull.body ?? '').match(marker);
  if (!match) continue;
  try {
    const metadata = JSON.parse(match[1]);
    for (const id of metadata.entityIds ?? []) entityIds.add(id);
  } catch {
    // Invalid metadata cannot authorize Alive.
  }
}
if (!entityIds.size) {
  console.log('The deployed commit has no merged Wisteria construction metadata.');
  process.exit(0);
}

const ledger = await readJson(CONSTRUCTION_LEDGER_PATH);
let alive = 0;
for (const entityId of entityIds) {
  const record = ledger.records.find((item) => item.wisteriaId === entityId);
  if (!record?.notionPageId || !record.releaseId) continue;
  await updatePageProperties(notionToken, record.notionPageId, {
    'Wisteria Status': statusValue('Alive')
  });
  await createPageComment(
    notionToken,
    record.notionPageId,
    `Alive: release ${record.releaseId} was verified in production at commit ${commit}${deploymentUrl ? ` (${deploymentUrl})` : ''}.`
  );
  alive += 1;
}
console.log(`Marked ${alive} Wisteria construction entit${alive === 1 ? 'y' : 'ies'} Alive.`);
