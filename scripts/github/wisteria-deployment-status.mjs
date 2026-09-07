import { readFile } from 'node:fs/promises';
import {
  createPageComment,
  propertyModel,
  readJson,
  retrievePage,
  statusValue,
  structurePaths,
  updatePageProperties
} from '../notion/library-framework.mjs';
import {
  constructionReleaseGroups,
  deploymentLifecycleTarget
} from './wisteria-deployment-core.mjs';

const repository = process.env.GITHUB_REPOSITORY;
const githubToken = process.env.GITHUB_TOKEN;
const notionToken = process.env.NOTION_TOKEN ?? process.env.NOTION_API_TOKEN;
const eventPath = process.env.GITHUB_EVENT_PATH;
const eventName = process.env.GITHUB_EVENT_NAME;
if (!repository || !githubToken || !notionToken || !eventPath || !eventName) {
  throw new Error('GitHub event context and NOTION_TOKEN are required.');
}

const [owner, repo] = repository.split('/');
const event = JSON.parse(await readFile(eventPath, 'utf8'));
const target = deploymentLifecycleTarget(eventName, event);
if (!target) {
  console.log('Ignoring an event that does not advance Wisteria deployment lifecycle.');
  process.exit(0);
}

const { commit, deploymentUrl, status: targetStatus } = target;
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
const releaseGroups = constructionReleaseGroups(pulls, marker);
if (![...releaseGroups.values()].some((ids) => ids.size)) {
  console.log('The deployed commit has no merged Wisteria construction metadata.');
  process.exit(0);
}

let updated = 0;
for (const [structureId, entityIds] of releaseGroups) {
  const ledger = await readJson(structurePaths(structureId).constructionLedgerPath);
  for (const entityId of entityIds) {
    const record = ledger.records.find((item) => item.wisteriaId === entityId);
    if (!record?.notionPageId || !record.releaseId) continue;
    const page = await retrievePage(notionToken, record.notionPageId);
    const current = propertyModel(
      page,
      record.entityKind === 'structure' ? 'room' : record.entityKind,
      record.parentId ?? ''
    );
    if (current.status === targetStatus) continue;
    await updatePageProperties(notionToken, record.notionPageId, {
      'Wisteria Status': statusValue(targetStatus)
    });
    await createPageComment(
      notionToken,
      record.notionPageId,
      targetStatus === 'Alive'
        ? `Alive: release ${record.releaseId} was verified in production at commit ${commit}${deploymentUrl ? ` (${deploymentUrl})` : ''}.`
        : `Landed: release ${record.releaseId} merged at commit ${commit}. Production verification is still required before Alive.`
    );
    updated += 1;
  }
}
console.log(`Marked ${updated} Wisteria construction entit${updated === 1 ? 'y' : 'ies'} ${targetStatus}.`);
