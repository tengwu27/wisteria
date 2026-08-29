import assert from 'node:assert/strict';
import test from 'node:test';
import {
  approvedBaseIsCurrent,
  constructionMetadata,
  isForceReleased,
  reservationCandidates,
  statusAfterClose
} from './wisteria-reservation-core.mjs';

const repository = 'owner/wisteria';
const metadata = (scope = 'room:library/library-grand-hall') => `<!-- wisteria-construction
${JSON.stringify({
  schemaVersion: 1,
  sessionId: 'session-1',
  lockScope: scope,
  entityIds: ['library-grand-hall'],
  baseCommit: 'abc123',
  approvedAt: '2026-08-27T00:00:00.000Z'
})}
-->`;
const pull = (number, options = {}) => ({
  number,
  body: metadata(options.scope),
  merged: options.merged ?? false,
  labels: options.labels ?? [],
  base: { sha: options.base ?? 'abc123' },
  head: {
    sha: `head-${number}`,
    ref: `branch-${number}`,
    repo: { full_name: options.repository ?? repository }
  }
});

test('requires complete approved construction metadata', () => {
  assert.equal(constructionMetadata(pull(1)).sessionId, 'session-1');
  assert.equal(
    constructionMetadata({ ...pull(1), body: '<!-- wisteria-construction {"schemaVersion":1} -->' }),
    undefined
  );
});

test('the oldest eligible same-repository PR owns a room lock', () => {
  const candidates = reservationCandidates(
    [pull(42), pull(40), pull(41, { repository: 'fork/wisteria' })],
    'room:library/library-grand-hall',
    repository
  );
  assert.deepEqual(candidates.map((candidate) => candidate.pull.number), [40, 42]);
});

test('an explicit force release removes an open PR from lock ownership', () => {
  const released = pull(40, { labels: [{ name: 'wisteria-force-released' }] });
  assert.equal(isForceReleased(released), true);
  assert.deepEqual(
    reservationCandidates(
      [released, pull(42)],
      'room:library/library-grand-hall',
      repository
    ).map((candidate) => candidate.pull.number),
    [42]
  );
  assert.equal(
    isForceReleased(pull(40), {
      action: 'unlabeled',
      label: { name: 'wisteria-force-released' }
    }),
    true
  );
});

test('stale approval bases fail closed', () => {
  const candidate = pull(42, { base: 'new-main' });
  assert.equal(approvedBaseIsCurrent(constructionMetadata(candidate), candidate), false);
});

test('merged and unmerged closures map to Landed and Ready', () => {
  assert.equal(statusAfterClose(pull(42, { merged: true })), 'Landed');
  assert.equal(statusAfterClose(pull(42)), 'Ready');
});
