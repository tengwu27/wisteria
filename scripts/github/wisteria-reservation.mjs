import { readFile } from 'node:fs/promises';
import {
  CONSTRUCTION_LEDGER_PATH,
  createPageComment,
  propertyModel,
  readJson,
  retrievePage,
  statusValue,
  updatePageProperties
} from '../notion/library-framework.mjs';
import {
  approvedBaseIsCurrent,
  constructionMetadata,
  isForceReleased,
  reservationCandidates,
  statusAfterClose
} from './wisteria-reservation-core.mjs';

const repository = process.env.GITHUB_REPOSITORY;
const githubToken = process.env.GITHUB_TOKEN;
const eventPath = process.env.GITHUB_EVENT_PATH;
const notionToken = process.env.NOTION_TOKEN ?? process.env.NOTION_API_TOKEN;

if (!repository || !githubToken || !eventPath) {
  throw new Error('GITHUB_REPOSITORY, GITHUB_TOKEN, and GITHUB_EVENT_PATH are required.');
}

const [owner, repo] = repository.split('/');
const event = JSON.parse(await readFile(eventPath, 'utf8'));
const currentPull = event.pull_request;
if (!currentPull) throw new Error('The reservation check requires a pull_request event.');

async function github(endpoint, options = {}) {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${githubToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'wisteria-construction-reservation',
      ...(options.headers ?? {})
    }
  });
  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`GitHub API ${response.status}: ${detail}`);
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return undefined;
  return response.json();
}

async function ensureLabel(name, color, description) {
  try {
    await github(`/repos/${owner}/${repo}/labels`, {
      method: 'POST',
      body: JSON.stringify({ name, color, description })
    });
  } catch (error) {
    if (error.status !== 422) throw error;
  }
}

async function setPullLabels(pullNumber, add, remove) {
  if (add.length) {
    await github(`/repos/${owner}/${repo}/issues/${pullNumber}/labels`, {
      method: 'POST',
      body: JSON.stringify({ labels: add })
    });
  }
  for (const label of remove) {
    try {
      await github(
        `/repos/${owner}/${repo}/issues/${pullNumber}/labels/${encodeURIComponent(label)}`,
        { method: 'DELETE' }
      );
    } catch (error) {
      if (error.status !== 404) throw error;
    }
  }
}

async function listOpenPulls() {
  const pulls = [];
  for (let page = 1; ; page += 1) {
    const batch = await github(
      `/repos/${owner}/${repo}/pulls?state=open&per_page=100&page=${page}&sort=created&direction=asc`
    );
    pulls.push(...batch);
    if (batch.length < 100) return pulls;
  }
}

async function ledgerAtPull(pull) {
  if (!pull?.head?.sha) return { records: [] };
  const file = await github(
    `/repos/${owner}/${repo}/contents/${CONSTRUCTION_LEDGER_PATH}?ref=${encodeURIComponent(pull.head.sha)}`
  );
  return JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
}

async function syncNotion(entityIds, status, message, pull) {
  if (!notionToken || !entityIds.length) return;
  const [trustedLedger, proposedLedger] = await Promise.all([
    readJson(CONSTRUCTION_LEDGER_PATH),
    ledgerAtPull(pull)
  ]);
  const records = [...trustedLedger.records, ...(proposedLedger.records ?? [])];
  for (const entityId of entityIds) {
    const record = records.find(
      (candidate) => candidate.wisteriaId === entityId && candidate.notionPageId
    );
    if (!record) continue;
    const page = await retrievePage(notionToken, record.notionPageId);
    const current = propertyModel(
      page,
      record.entityKind === 'structure' ? 'room' : record.entityKind,
      record.parentId ?? ''
    );
    if (current.status === status) continue;
    await updatePageProperties(notionToken, record.notionPageId, {
      'Wisteria Status': statusValue(status)
    });
    await createPageComment(notionToken, record.notionPageId, message);
  }
}

await Promise.all([
  ensureLabel('wisteria-construction', '6f42c1', 'Wisteria visual or interaction construction'),
  ensureLabel('wisteria-processing', 'd4a72c', 'Owns the declared Wisteria construction scope'),
  ensureLabel('wisteria-blocked', 'b60205', 'Blocked by another open Wisteria construction PR'),
  ensureLabel('wisteria-force-released', '8c8c8c', 'Explicitly releases an open stale Wisteria reservation')
]);

const currentMetadata = constructionMetadata(currentPull);
if (!currentMetadata) {
  console.log('No approved Wisteria construction metadata; no reservation required.');
  process.exit(0);
}

const currentForceReleased = isForceReleased(currentPull, event);
if (currentForceReleased) {
  await setPullLabels(
    currentPull.number,
    ['wisteria-construction', 'wisteria-force-released'],
    ['wisteria-processing', 'wisteria-blocked']
  );
  await syncNotion(
    currentMetadata.entityIds,
    'Ready',
    `Construction reservation for PR #${currentPull.number} was explicitly force-released. The pull request remains open but owns no Wisteria construction scope.`,
    currentPull
  );
}

if (
  event.action !== 'closed' &&
  !currentForceReleased &&
  !approvedBaseIsCurrent(currentMetadata, currentPull)
) {
  await setPullLabels(
    currentPull.number,
    ['wisteria-construction', 'wisteria-blocked'],
    ['wisteria-processing']
  );
  await syncNotion(
    currentMetadata.entityIds,
    'Ready',
    `Construction PR #${currentPull.number} is blocked because its approved base commit is no longer current. Re-analyze and obtain approval again.`,
    currentPull
  );
  throw new Error('Approved Wisteria base commit does not match the current PR base.');
}

if (event.action === 'closed') {
  const status = statusAfterClose(currentPull);
  await syncNotion(
    currentMetadata.entityIds,
    status,
    currentPull.merged
      ? `Construction merged in PR #${currentPull.number}. Deployment verification is still required before Alive.`
      : `Construction PR #${currentPull.number} closed without merging. The request returned to Ready.`,
    currentPull
  );
}

const openPulls = await listOpenPulls();
const candidates = reservationCandidates(
  openPulls,
  currentMetadata.lockScope,
  repository
);

const ownerCandidate = candidates[0];
for (const candidate of candidates) {
  const owns = candidate.pull.number === ownerCandidate.pull.number;
  await setPullLabels(
    candidate.pull.number,
    [
      'wisteria-construction',
      owns ? 'wisteria-processing' : 'wisteria-blocked'
    ],
    [owns ? 'wisteria-blocked' : 'wisteria-processing']
  );
  await syncNotion(
    candidate.metadata.entityIds,
    owns ? 'Processing' : 'Ready',
    owns
      ? `Construction is reserved by PR #${candidate.pull.number} (${candidate.pull.head.ref}).`
      : `Construction remains Ready but is blocked by PR #${ownerCandidate.pull.number} for ${candidate.metadata.lockScope}.`,
    candidate.pull
  );
}

if (
  event.action !== 'closed' &&
  !currentForceReleased &&
  ownerCandidate?.pull.number !== currentPull.number
) {
  throw new Error(
    `${currentMetadata.lockScope} is reserved by PR #${ownerCandidate.pull.number}. This PR cannot construct or merge.`
  );
}

console.log(
  ownerCandidate
    ? `${currentMetadata.lockScope} is reserved by PR #${ownerCandidate.pull.number}.`
    : `${currentMetadata.lockScope} has no active construction reservation.`
);
