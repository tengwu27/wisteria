import {
  createPageComment,
  readJson,
  structurePaths,
  writeJsonAtomic
} from './library-framework.mjs';
import { prepareConstructionRelease } from './release-framework.mjs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const structureId = argument('structure');
const entityIds = (argument('ids') ?? '').split(',').map((value) => value.trim()).filter(Boolean);
const pullRequest = Number(argument('pr'));
const baseCommit = argument('base-commit');
const previewCommit = argument('preview-commit');
const previewUrl = argument('preview-url');
const confirmed = process.argv.includes('--confirm-approved-preview');
if (!structureId || !confirmed) {
  throw new Error(
    'Usage: npm run notion:release -- --structure <id> --ids <id,id> --pr <number> --base-commit <sha> --preview-commit <sha> --preview-url <url> --confirm-approved-preview'
  );
}

const ledgerPath = structurePaths(structureId).constructionLedgerPath;
const current = await readJson(ledgerPath);
const { stdout: currentCommitOutput } = await execFileAsync('git', ['rev-parse', 'HEAD']);
const prepared = prepareConstructionRelease({
  ledger: current,
  structureId,
  entityIds,
  pullRequest,
  baseCommit,
  previewCommit,
  currentCommit: currentCommitOutput.trim(),
  previewUrl
});
if (prepared.changed) await writeJsonAtomic(ledgerPath, prepared.ledger);

const token = process.env.NOTION_TOKEN ?? process.env.NOTION_API_TOKEN;
if (token && prepared.changed) {
  for (const release of prepared.releases) {
    const record = prepared.ledger.records.find((candidate) => candidate.wisteriaId === release.entityId);
    if (!record?.notionPageId) continue;
    await createPageComment(
      token,
      record.notionPageId,
      `Approved preview for PR #${pullRequest} prepared as ${release.releaseId}. It remains Processing until merge and is not Alive until production verification.`
    );
  }
}
console.log(
  `${prepared.changed ? 'Prepared' : 'Already prepared'} ${prepared.releases.length} ${structureId} construction release(s).`
);
