---
name: process-ready-wisteria-entities
description: Analyze and process rooms, scenes, and items marked Ready in any registered Wisteria structure. Use when the user asks to process, construct, reconstruct, place, or register Ready Wisteria entities; do not use for ordinary content-only synchronization.
---

# Process Ready Wisteria Entities

Treat Notion as creative intent, Git as permanent construction, and the open GitHub PR as the temporary room reservation.

## Analyze first

1. Confirm the working tree does not contain unrelated user changes.
2. Resolve the intrinsic structure from the Notion hierarchy or the repository
   registration in `world/structures/<structure>/notion.json`. Do not infer a
   structure from a similarly named page elsewhere.
3. Run `npm run notion:<structure>:process`. This writes
   `.wisteria-cache/<structure>-impact.json` without changing construction.
4. Read the impact manifest and the applicable structure `CHARACTER.md`.
5. Compare every requested change with the structure's repository ledger,
   registered masks, anchors, protected descendants, and current spatial graph.
6. For `framed-art`, inspect the canonical source dimensions before proposing a
   placement. A compatible slot must declare `aspectPolicy: match-source-frame`
   and fixed `frameEnvelopeBounds`. Fit a source-matched aperture and frame
   inside that envelope with at most 0.5% ratio error and a minimum 96px
   aperture short side on the scene master. Use
   `scripts/assets/frame-geometry.mjs`; never silently fall back to crop,
   stretch, or `contain-with-mat`. If the exact-ratio assembly cannot fit, leave
   the impact plan non-executable and request a different or larger placement.
7. Present one concise impact plan per room. Name all affected entities and state whether artwork, geometry, hotspots, navigation, or cascading unlocks are required.

Stop here until the user explicitly approves that exact impact plan. Approval to analyze or process Ready entries is not approval to generate artwork, create a branch, open a PR, unlock descendants, or publish.

## After explicit approval

Read [references/construction-session.md](references/construction-session.md), then:

1. Re-run the analyzer and reject approval if the manifest or base commit changed.
2. Check GitHub for an open `wisteria-processing` PR with the same room lock.
3. Fetch the repository's current configured base branch and create a fresh
   `codex/wisteria-<room>-<short-purpose>` branch unless the same approved
   construction session already owns a current PR. Approved stacked work may
   use the explicitly named parent branch as its base.
4. Open a draft PR immediately. Put the approved metadata block from the reference in its body so GitHub can reserve the room.
5. Do not construct until the reservation check labels the PR `wisteria-processing`. A `wisteria-blocked` PR must stop.
6. Use the relevant cinematic artwork/integration skills for actual visual work. Preserve canonical Wisteria art direction and registered descendants.
7. For approved framed art, rebuild the complete registered frame assembly and
   its exact aperture as part of the item's construction version. Preserve the
   room-owned wall envelope and anchor, restrict repair to the approved frame
   and newly exposed wall, retain the structure's frame treatment unless the
   item's Appearance Prompt explicitly changes it, and regenerate the shell,
   proxy, fallback, masks, manifest, responsive assets, and difference proofs.
   Content-only changes retain the existing frame. Replacing source artwork or
   requesting physical reconstruction requires a new approved construction
   version. This is a supervised construction step, not unattended image
   generation.
8. Store pending construction in the branch ledger and keep production records active until merge and deployment verification.
9. Show the preview and obtain approval before making the PR ready for review.

For a new room, register its spatial node and directional edges and create its
nested three-property Scenes database only after the construction is
approved. For a new scene, register its protected parent anchor and create
its nested three-property Items database. Never create reusable room or
scene templates.

## Non-construction cases

- Registered page-body and editorial-media edits are content-only and require no branch or PR.
- An unchanged construction prompt is content-only even when the page is Ready; explain the no-op and restore its canonical status only with user approval.
- Invalid, blocked, ambiguous, or destructive requests produce an explanation, not a branch.
- A new item must use a compatible unoccupied visible slot before additive artwork is proposed.
- Every nested Notion database must be registered in
  `world/structures/<structure>/notion.json`, remain intrinsic to its parent
  page, and expose all three authoring properties in a gallery view. Run any
  structure-specific Notion view/inline checks declared in `package.json`; the
  build must enforce the same invariants for production structures.
- Never remove or materially alter a registered descendant unless the user confirms every affected Wisteria ID in Codex chat.

## Completion

- Merge means `Landed`, not `Alive`.
- Only verified deployment of the exact landed commit may set `Alive`.
- Closing without merge releases the PR reservation and returns affected entities to `Ready`.
- Never silently release an open stale reservation. Close it, or run the explicit
  **Wisteria Force Release** GitHub workflow with a reason and `RELEASE`
  confirmation; the open PR then loses construction authority.
