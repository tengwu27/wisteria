export function deploymentLifecycleTarget(eventName, event) {
  if (eventName === 'push') {
    if (event.ref !== 'refs/heads/main' || !event.after) return undefined;
    return { status: 'Landed', commit: event.after, deploymentUrl: '' };
  }
  if (eventName === 'deployment_status') {
    const deployment = event.deployment;
    const status = event.deployment_status;
    if (status?.state !== 'success' || !/production/i.test(deployment?.environment ?? '')) {
      return undefined;
    }
    return {
      status: 'Alive',
      commit: deployment.sha,
      deploymentUrl: status.environment_url ?? status.target_url ?? ''
    };
  }
  if (eventName === 'workflow_dispatch' && event.inputs?.commit) {
    const status = event.inputs.status === 'Landed' ? 'Landed' : 'Alive';
    const deploymentUrl = event.inputs.production_url ?? '';
    if (status === 'Alive' && !/^https:\/\//.test(deploymentUrl)) {
      throw new Error('Manual Alive reconciliation requires a production URL.');
    }
    return { status, commit: event.inputs.commit, deploymentUrl };
  }
  return undefined;
}

export function constructionReleaseGroups(pulls, marker) {
  const groups = new Map();
  for (const pull of pulls) {
    if (!pull.merged_at) continue;
    const match = String(pull.body ?? '').match(marker);
    if (!match) continue;
    try {
      const metadata = JSON.parse(match[1]);
      const structureId = metadata.structureId ?? String(metadata.lockScope ?? '').match(/^room:([^/]+)\//)?.[1] ?? 'library';
      const ids = groups.get(structureId) ?? new Set();
      for (const id of metadata.entityIds ?? []) ids.add(id);
      groups.set(structureId, ids);
    } catch {
      // Invalid metadata cannot authorize a lifecycle transition.
    }
  }
  return groups;
}
