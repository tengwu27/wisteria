---
name: curate-self-revealing-art
description: Curate paintings and other self-revealing art into a versioned Wisteria scene when the user explicitly asks Codex to create, hang, add, replace, or rearrange art. Use for temporary art-and-scene candidates and approved curated-exhibit publication; never trigger it from a Notion Ready status.
---

# Curate Self-Revealing Art

Treat the artwork as canonical collection identity and the room view as a
versioned composition. Paintings are executable in v1; sculpture and
installation remain schema-only until their construction rules are approved.

Before acting, read `references/curation-session.md`. Also read the applicable
scene-art, localized-repair, aperture-layering, and frontend-integration skills.

## Candidate phase

1. Require an explicit conversational curation request. Never infer one from a
   Notion status, webhook, or catalog edit.
2. Load the room character, latest composition manifest, scene authority, and
   every Notion artwork record assigned to the scene. Verify each referenced Git
   canonical asset against its recorded SHA-256.
3. Generate the new canonical painting first. Then generate one updated scene
   candidate using the approved scene master as architecture/camera authority,
   all existing canonical works as identity-locked references, and only the
   registered exhibit region as recomposable space.
4. Existing works may move but may not be repainted. Register canonical images
   or identity-preserving proxies into generated supports with deterministic
   masks or perspective transforms.
5. Present the standalone painting and updated room together. Keep all candidate
   files temporary. Do not change Git, Notion, a PR, status, or the active
   composition before explicit visual approval.

## Approved construction phase

After approval, revalidate the room lock, base commit, composition version/hash,
and every canonical hash. Reuse or create only the correctly scoped draft
construction PR. Persist the canonical painting and composition assets, advance
the composition version, rebuild masks/proxies/hotspots/fallbacks/inspectors,
and idempotently upsert the Notion catalog record as `Processing`.

Require unique artwork, placement, and hotspot IDs; complete exhibit-region
containment; at most 0.5% aperture/source ratio error; a 96px minimum aperture
short side at the scene master; no crop, stretch, or mat; and zero changed
pixels outside the approved repair mask. The inspector always renders the
unchanged canonical source.

Stop publication on missing assets, hash mismatch, stale composition, a
conflicting room lock, unreadable placement, or failed Notion catalog upsert.
`Landed` follows merge; `Alive` follows verified deployment. Closing without
merge returns the catalog item to `Ready` and never starts construction.
