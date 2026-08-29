---
name: process-ready-wisteria-entities
description: Analyze and process Library rooms, scenes, and items marked Ready in Notion. Use when the user asks to process, construct, reconstruct, place, or register Ready Wisteria entities; do not use for ordinary content-only synchronization.
---

# Process Ready Wisteria Entities

Treat Notion as creative intent, Git as permanent construction, and the open GitHub PR as the temporary room reservation.

## Analyze first

1. Confirm the working tree does not contain unrelated user changes.
2. Run `npm run notion:library:process`. This writes `.wisteria-cache/library-impact.json` without changing construction.
3. Read the impact manifest and the applicable room `CHARACTER.md`.
4. Compare every requested change with the repository ledger, registered masks, anchors, protected descendants, and current spatial graph.
5. Present one concise impact plan per room. Name all affected entities and state whether artwork, geometry, hotspots, navigation, or cascading unlocks are required.

Stop here until the user explicitly approves that exact impact plan. Approval to analyze or process Ready entries is not approval to generate artwork, create a branch, open a PR, unlock descendants, or publish.

## After explicit approval

Read [references/construction-session.md](references/construction-session.md), then:

1. Re-run the analyzer and reject approval if the manifest or base commit changed.
2. Check GitHub for an open `wisteria-processing` PR with the same room lock.
3. Fetch current `origin/main` and create a fresh `codex/wisteria-<room>-<short-purpose>` branch unless the same approved construction session already owns a current PR.
4. Open a draft PR immediately. Put the approved metadata block from the reference in its body so GitHub can reserve the room.
5. Do not construct until the reservation check labels the PR `wisteria-processing`. A `wisteria-blocked` PR must stop.
6. Use the relevant cinematic artwork/integration skills for actual visual work. Preserve canonical Wisteria art direction and registered descendants.
7. Store pending construction in the branch ledger and keep production records active until merge and deployment verification.
8. Show the preview and obtain approval before making the PR ready for review.

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
- Every nested Notion database must be registered in `world/structures/library/notion.json`, displayed inline, and open with the primary `Tiles` gallery view. Run `npm run notion:library:ensure-inline` and `npm run notion:library:ensure-gallery` after registering a new database; the build enforces the same invariants.
- Never remove or materially alter a registered descendant unless the user confirms every affected Wisteria ID in Codex chat.

## Completion

- Merge means `Landed`, not `Alive`.
- Only verified deployment of the exact landed commit may set `Alive`.
- Closing without merge releases the PR reservation and returns affected entities to `Ready`.
- Never silently release an open stale reservation. Close it, or run the explicit
  **Wisteria Force Release** GitHub workflow with a reason and `RELEASE`
  confirmation; the open PR then loses construction authority.
