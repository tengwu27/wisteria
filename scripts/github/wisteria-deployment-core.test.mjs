import assert from 'node:assert/strict';
import test from 'node:test';
import {
  constructionReleaseGroups,
  deploymentLifecycleTarget
} from './wisteria-deployment-core.mjs';

test('main pushes reconcile merged construction as Landed', () => {
  assert.deepEqual(
    deploymentLifecycleTarget('push', { ref: 'refs/heads/main', after: 'abc' }),
    { status: 'Landed', commit: 'abc', deploymentUrl: '' }
  );
  assert.equal(
    deploymentLifecycleTarget('push', { ref: 'refs/heads/feature', after: 'abc' }),
    undefined
  );
});

test('successful production deployments reconcile construction as Alive', () => {
  assert.deepEqual(deploymentLifecycleTarget('deployment_status', {
    deployment: { environment: 'production', sha: 'abc' },
    deployment_status: { state: 'success', environment_url: 'https://wisteria.example' }
  }), {
    status: 'Alive',
    commit: 'abc',
    deploymentUrl: 'https://wisteria.example'
  });
  assert.equal(deploymentLifecycleTarget('deployment_status', {
    deployment: { environment: 'deploy-preview', sha: 'abc' },
    deployment_status: { state: 'success' }
  }), undefined);
});

test('manual reconciliation supports Landed and requires a URL for Alive', () => {
  assert.equal(deploymentLifecycleTarget('workflow_dispatch', {
    inputs: { status: 'Landed', commit: 'abc' }
  }).status, 'Landed');
  assert.throws(() => deploymentLifecycleTarget('workflow_dispatch', {
    inputs: { status: 'Alive', commit: 'abc', production_url: '' }
  }), /production URL/);
});

test('groups merged construction metadata by structure', () => {
  const marker = /<!--\s*wisteria-construction\s*([\s\S]*?)-->/i;
  const body = (value) => `<!-- wisteria-construction\n${JSON.stringify(value)}\n-->`;
  const groups = constructionReleaseGroups([
    {
      merged_at: '2026-09-07T00:00:00Z',
      body: body({ structureId: 'castle', entityIds: ['painting-1'] })
    },
    {
      merged_at: '2026-09-07T00:00:00Z',
      body: body({ lockScope: 'room:library/grand-hall', entityIds: ['book-1'] })
    },
    { merged_at: null, body: body({ structureId: 'castle', entityIds: ['ignored'] }) }
  ], marker);
  assert.deepEqual([...groups.get('castle')], ['painting-1']);
  assert.deepEqual([...groups.get('library')], ['book-1']);
});
