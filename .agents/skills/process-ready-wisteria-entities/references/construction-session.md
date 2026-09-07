# Construction Session Contract

## Pull request metadata

Place this machine-readable block in the draft PR body after recording explicit approval:

```html
<!-- wisteria-construction
{
  "schemaVersion": 1,
  "sessionId": "<impact manifest session ID>",
  "lockScope": "room:<structure>/<room>",
  "entityIds": ["<exact Wisteria IDs>"],
  "baseCommit": "<approved base commit>",
  "approvedAt": "<ISO-8601 timestamp>"
}
-->
```

Do not invent entity IDs. Copy them from the impact manifest and repository ledger.

## Reuse rules

Reuse an existing PR only when its session ID matches, it owns the same lock, its base is current, and the new work stays within the approved impact. Otherwise create a new construction session after the current reservation is released.

Compatible Ready entities in the same registered room impact may share one PR.
Content-only entries never join a construction PR.

## Scoped cascading unlock

Record the root entity, every affected descendant ID, reason, approving user, and approval timestamp. An unlock covers only those IDs and the declared room/scene/item/media scope. Reject geometry or asset diffs outside the approved masks and anchors.

Parent relighting may remain coherent across registered child regions. Child geometry, materials, identity, masks, anchors, hotspots, and existence remain fixed unless explicitly listed in the unlock.

## Failure behavior

- GitHub unavailable: fail closed.
- Conflicting open reservation: leave the request Ready and identify the owning PR.
- Base or prompt changed after approval: discard the approval and present a new impact plan.
- Preview rejected: keep production active and revise only inside the same approved scope.
- PR closed without merge: do not preserve pending construction as canonical history.
