import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareConstructionRelease } from './release-framework.mjs';

const baseCommit = 'a'.repeat(40);
const previewCommit = 'b'.repeat(40);
const previewUrl = 'https://deploy-preview-8--wwisteria.netlify.app';

function fixture() {
  return {
    activeReservation: {
      pullRequest: 8,
      baseCommit,
      entityIds: ['room', 'scene', 'painting']
    },
    records: ['room', 'scene', 'painting'].map((wisteriaId) => ({
      wisteriaId,
      state: 'pending',
      constructionVersion: 1,
      constructionHash: `${wisteriaId}-construction-hash`,
      lockedConstructionHash: '',
      releaseId: null,
      pendingVersion: {
        version: 1,
        constructionHash: `${wisteriaId}-construction-hash`,
        commit: null,
        pullRequest: 8,
        previewUrl: null,
        releaseId: null,
        state: 'previewing'
      },
      history: []
    }))
  };
}

function prepare(ledger = fixture(), overrides = {}) {
  return prepareConstructionRelease({
    ledger,
    structureId: 'castle',
    entityIds: ['room', 'scene', 'painting'],
    pullRequest: 8,
    baseCommit,
    previewCommit,
    currentCommit: previewCommit,
    previewUrl,
    ...overrides
  });
}

test('prepares stable releases and clears the active reservation', () => {
  const result = prepare();
  assert.equal(result.changed, true);
  assert.equal(result.ledger.activeReservation, null);
  for (const record of result.ledger.records) {
    assert.equal(record.state, 'locked');
    assert.equal(record.lockedConstructionHash, record.constructionHash);
    assert.match(record.releaseId, new RegExp(`^castle-${record.wisteriaId}-v1-`));
    assert.equal(record.pendingVersion, null);
    assert.deepEqual(record.history.at(-1), {
      version: 1,
      constructionHash: record.constructionHash,
      commit: previewCommit,
      pullRequest: 8,
      previewUrl,
      releaseId: record.releaseId,
      state: 'approved'
    });
  }
});

test('release preparation is idempotent for the same approved preview', () => {
  const first = prepare();
  const second = prepare(first.ledger, { currentCommit: 'c'.repeat(40) });
  assert.equal(second.changed, false);
  assert.deepEqual(second.ledger, first.ledger);
});

test('rejects stale bases, wrong PRs, hash drift, and missing reservations', () => {
  assert.throws(() => prepare(fixture(), { baseCommit: 'c'.repeat(40) }), /base commit is stale/);
  assert.throws(() => prepare(fixture(), { pullRequest: 9 }), /reserved by PR #8/);
  const drifted = fixture();
  drifted.records[0].pendingVersion.constructionHash = 'drifted';
  assert.throws(() => prepare(drifted), /preview hash does not match/);
  const unreserved = fixture();
  unreserved.activeReservation = null;
  assert.throws(() => prepare(unreserved), /No active construction reservation/);
  assert.throws(
    () => prepare(fixture(), { currentCommit: 'c'.repeat(40) }),
    /does not match the current checkout/
  );
});
