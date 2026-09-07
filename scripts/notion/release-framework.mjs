export function constructionReleaseId(structureId, record) {
  if (!structureId || !record?.wisteriaId || !record?.constructionVersion || !record?.constructionHash) {
    throw new Error('A structure ID and complete construction record are required.');
  }
  return `${structureId}-${record.wisteriaId}-v${record.constructionVersion}-${record.constructionHash.slice(0, 10)}`;
}

function requireSha(value, label) {
  if (!/^[a-f0-9]{40}$/i.test(String(value ?? ''))) {
    throw new Error(`${label} must be an exact 40-character Git commit SHA.`);
  }
}

export function prepareConstructionRelease({
  ledger,
  structureId,
  entityIds,
  pullRequest,
  baseCommit,
  previewCommit,
  currentCommit,
  previewUrl
}) {
  requireSha(baseCommit, 'Base commit');
  requireSha(previewCommit, 'Preview commit');
  requireSha(currentCommit, 'Current commit');
  if (!Number.isInteger(pullRequest) || pullRequest < 1) {
    throw new Error('A valid pull request number is required.');
  }
  if (!/^https:\/\//.test(String(previewUrl ?? ''))) {
    throw new Error('An HTTPS preview URL is required.');
  }
  if (!Array.isArray(entityIds) || !entityIds.length || new Set(entityIds).size !== entityIds.length) {
    throw new Error('One or more unique construction entity IDs are required.');
  }

  const next = structuredClone(ledger);
  const records = entityIds.map((entityId) => {
    const record = next.records.find((candidate) => candidate.wisteriaId === entityId);
    if (!record) throw new Error(`Unknown construction entity: ${entityId}`);
    return record;
  });
  const releases = records.map((record) => ({
    entityId: record.wisteriaId,
    releaseId: constructionReleaseId(structureId, record)
  }));
  const alreadyPrepared = records.every((record, index) =>
    record.state === 'locked' &&
    record.lockedConstructionHash === record.constructionHash &&
    record.releaseId === releases[index].releaseId &&
    record.pendingVersion === null &&
    record.history?.some((version) =>
      version.releaseId === releases[index].releaseId &&
      version.commit === previewCommit &&
      version.previewUrl === previewUrl &&
      version.state === 'approved'
    )
  );
  if (alreadyPrepared && next.activeReservation === null) {
    return { ledger: next, releases, changed: false };
  }

  if (previewCommit !== currentCommit) {
    throw new Error('The approved preview commit does not match the current checkout.');
  }

  const reservation = next.activeReservation;
  if (!reservation) throw new Error('No active construction reservation exists.');
  if (reservation.pullRequest !== pullRequest) {
    throw new Error(`Construction is reserved by PR #${reservation.pullRequest}, not PR #${pullRequest}.`);
  }
  if (reservation.baseCommit !== baseCommit) {
    throw new Error('The approved construction base commit is stale.');
  }
  for (const entityId of entityIds) {
    if (!reservation.entityIds.includes(entityId)) {
      throw new Error(`${entityId} is outside the active construction reservation.`);
    }
  }

  records.forEach((record, index) => {
    const pending = record.pendingVersion;
    if (record.state !== 'pending' || !pending) {
      throw new Error(`${record.wisteriaId} is not an active pending construction.`);
    }
    if (!['previewing', 'approved'].includes(pending.state)) {
      throw new Error(`${record.wisteriaId} does not have an approvable preview.`);
    }
    if (pending.pullRequest !== pullRequest) {
      throw new Error(`${record.wisteriaId} preview belongs to a different pull request.`);
    }
    if (pending.constructionHash !== record.constructionHash) {
      throw new Error(`${record.wisteriaId} preview hash does not match construction.`);
    }
    const approvedVersion = {
      ...pending,
      commit: previewCommit,
      previewUrl,
      releaseId: releases[index].releaseId,
      state: 'approved'
    };
    record.state = 'locked';
    record.lockedConstructionHash = record.constructionHash;
    record.releaseId = releases[index].releaseId;
    record.history = [...(record.history ?? []), approvedVersion];
    record.pendingVersion = null;
  });
  next.activeReservation = null;
  return { ledger: next, releases, changed: true };
}
