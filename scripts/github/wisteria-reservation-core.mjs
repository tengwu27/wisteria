export const CONSTRUCTION_MARKER = /<!--\s*wisteria-construction\s*([\s\S]*?)-->/i;

export function constructionMetadata(pull) {
  const match = String(pull.body ?? '').match(CONSTRUCTION_MARKER);
  if (!match) return undefined;
  try {
    const value = JSON.parse(match[1]);
    if (
      value?.schemaVersion !== 1 ||
      !value.lockScope ||
      !value.sessionId ||
      !value.baseCommit ||
      !value.approvedAt ||
      !Array.isArray(value.entityIds) ||
      !value.entityIds.length
    ) {
      return undefined;
    }
    return value;
  } catch {
    return undefined;
  }
}

export function isForceReleased(pull, event = {}) {
  return (
    pull.labels?.some((label) => label.name === 'wisteria-force-released') ||
    (event.action === 'unlabeled' && event.label?.name === 'wisteria-force-released')
  );
}

export function approvedBaseIsCurrent(metadata, pull) {
  return metadata.baseCommit === pull.base.sha;
}

export function reservationCandidates(pulls, lockScope, repository) {
  return pulls
    .map((pull) => ({ pull, metadata: constructionMetadata(pull) }))
    .filter(
      (candidate) =>
        candidate.pull.head.repo.full_name === repository &&
        candidate.metadata?.lockScope === lockScope &&
        !isForceReleased(candidate.pull)
    )
    .sort((left, right) => left.pull.number - right.pull.number);
}

export function statusAfterClose(pull) {
  return pull.merged ? 'Landed' : 'Ready';
}
