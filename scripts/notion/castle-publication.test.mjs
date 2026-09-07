import assert from 'node:assert/strict';
import test from 'node:test';
import { castleArtworkPublicationDecision } from './castle-publication.mjs';

const placement = { canonicalSha256: 'canonical' };
const pending = { state: 'pending', releaseId: null };
const released = { state: 'locked', releaseId: 'release-1' };
const entry = { canonicalSha256: 'canonical', releaseId: 'release-1' };

test('preview exposes registered pending artwork while production hides it', () => {
  assert.equal(castleArtworkPublicationDecision({
    context: 'deploy-preview', record: pending, placement, entry
  }).visible, true);
  assert.equal(castleArtworkPublicationDecision({
    context: 'production', record: pending, placement, entry: undefined
  }).visible, false);
});

test('production requires a matching locked release and Notion snapshot entry', () => {
  assert.equal(castleArtworkPublicationDecision({
    context: 'production', record: released, placement, entry
  }).visible, true);
  assert.throws(() => castleArtworkPublicationDecision({
    context: 'production', record: released, placement, entry: undefined
  }), /missing from the production/);
  assert.throws(() => castleArtworkPublicationDecision({
    context: 'production', record: released, placement,
    entry: { ...entry, releaseId: 'other-release' }
  }), /snapshot release differs/);
});

test('canonical hash drift fails closed in every build context', () => {
  assert.throws(() => castleArtworkPublicationDecision({
    context: 'deploy-preview', record: pending, placement,
    entry: { canonicalSha256: 'drifted', releaseId: null }
  }), /canonical hash differs/);
});
