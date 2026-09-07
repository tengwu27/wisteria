export function castleArtworkPublicationDecision({ context, record, placement, entry }) {
  if (!record || !placement) throw new Error('Castle artwork publication registration is incomplete.');
  if (entry && entry.canonicalSha256 !== placement.canonicalSha256) {
    throw new Error('Castle Gallery Notion canonical hash differs from the registered composition.');
  }
  if (context === 'production') {
    if (record.state !== 'locked' || !record.releaseId) return { visible: false };
    if (!entry) throw new Error('Released Castle artwork is missing from the production Notion snapshot.');
    if (entry.releaseId !== record.releaseId) {
      throw new Error('Castle artwork snapshot release differs from the construction ledger.');
    }
    return { visible: true };
  }
  if (!['pending', 'locked'].includes(record.state)) return { visible: false };
  if (!entry) throw new Error('Registered Castle artwork is missing from the preview Notion snapshot.');
  return { visible: true };
}
