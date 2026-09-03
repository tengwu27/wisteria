import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildImpactManifest,
  canonicalArtworkProperties,
  computeCompositionHash,
  computePromptHash,
  computeSourceHash,
  evaluateWebhookAction,
  findFreeSlot,
  galleryShowsAllProperties,
  isProtectedAssetChangeAllowed,
  isSystemAuthoredWebhook,
  propertyModel,
  resolveCodexCurationRequest,
  resolveConstructionRequest,
  upsertCanonicalArtworkPage,
  validateCuratedComposition,
  validateCurationPublicationGate,
  validateRuntimeEntry,
  visibleGalleryProperties
} from './library-framework.mjs';
import { mediaPublicPath } from './notion-content.mjs';

const registry = {
  schemaVersion: 3,
  structureId: 'library',
  map: {
    discoveryStorageKey: 'test',
    nodes: [
      {
        roomId: 'library-grand-hall',
        label: 'Grand Hall',
        route: '/library',
        x: 0.5,
        y: 0.5,
        initiallyDiscovered: true
      }
    ],
    edges: []
  },
  rooms: [
    {
      id: 'library-grand-hall',
      label: 'Grand Hall',
      route: '/library',
      protectedSceneIds: ['reading-table', 'west-shelf']
    }
  ],
  scenes: [
    {
      id: 'west-shelf',
      label: 'West Shelf',
      roomId: 'library-grand-hall',
      slots: [
        {
          id: 'west-shelf-open-book',
          representation: 'book',
          bounds: { x: 0.5, y: 0.4, width: 0.1, height: 0.3 },
          occupiedBy: null
        }
      ]
    }
  ]
};

const roomRecord = {
  wisteriaId: 'library-grand-hall',
  entityKind: 'room',
  parentId: 'library',
  notionPageId: 'scene-page',
  promptHash: computePromptHash({
    entityKind: 'room',
    title: 'Grand Hall',
    prompt: 'Preserve its shelves and table.'
  }),
  dependencyLock: {
    preserves: ['camera', 'architecture', 'apertures'],
    protectedDescendantIds: ['reading-table', 'west-shelf'],
    allowParentRelighting: true
  }
};

const emptyLedger = { records: [roomRecord], activeUnlocks: [] };

test('reads only the minimal entity-facing Notion properties', () => {
  const entity = propertyModel(
    {
      id: 'page',
      properties: {
        Title: { title: [{ plain_text: 'A Book' }] },
        'Appearance Prompt': { rich_text: [{ plain_text: 'A blue volume.' }] },
        'Wisteria Status': { select: { name: 'Ready' } },
        'Construction Hash': { rich_text: [{ plain_text: 'legacy' }] }
      }
    },
    'item',
    'west-shelf'
  );
  assert.deepEqual(entity, {
    notionPageId: 'page',
    entityKind: 'item',
    parentId: 'west-shelf',
    title: 'A Book',
    prompt: 'A blue volume.',
    status: 'Ready',
    lastEditedTime: ''
  });
});

test('reads the author-facing Room properties for a room entity', () => {
  const entity = propertyModel(
    {
      id: 'room-page',
      properties: {
        'Room Name': { title: [{ plain_text: 'Grand Hall' }] },
        'Room Prompt': { rich_text: [{ plain_text: 'Preserve its shelves and table.' }] },
        'Wisteria Status': { select: { name: 'Ready' } }
      }
    },
    'room',
    'library'
  );
  assert.equal(entity.title, 'Grand Hall');
  assert.equal(entity.prompt, 'Preserve its shelves and table.');
});

test('gallery defaults expose every database property', () => {
  const schema = {
    Title: { id: 'title' },
    'Appearance Prompt': { id: 'prompt-id' },
    'Wisteria Status': { id: 'status-id' }
  };
  const properties = visibleGalleryProperties(schema, [
    { property_id: 'prompt-id', visible: false, card_property_width_mode: 'full_line' }
  ]);
  assert.deepEqual(properties, [
    { property_id: 'title', visible: true, wrap: true },
    {
      property_id: 'prompt-id',
      visible: true,
      wrap: true,
      card_property_width_mode: 'full_line'
    },
    { property_id: 'status-id', visible: true, wrap: true }
  ]);
  assert.equal(
    galleryShowsAllProperties(
      { type: 'gallery', configuration: { properties } },
      schema
    ),
    true
  );
});

test('separates content hashes from construction prompt hashes', () => {
  const entity = { entityKind: 'item', title: 'Sample', prompt: 'Blue cloth.' };
  assert.notEqual(
    computeSourceHash(entity, 'Short body', []),
    computeSourceHash(entity, `Short body ${'x'.repeat(1000)}`, [])
  );
  assert.equal(
    computePromptHash({ ...entity, bodyMarkdown: 'changed' }),
    computePromptHash(entity)
  );
  assert.notEqual(
    computePromptHash(entity),
    computePromptHash({ ...entity, prompt: 'Red leather.' })
  );
});

test('registered entities remain content-only until their prompt changes', () => {
  const unchanged = {
    notionPageId: 'scene-page',
    entityKind: 'room',
    parentId: 'library',
    title: 'Grand Hall',
    prompt: 'Preserve its shelves and table.'
  };
  assert.equal(
    resolveConstructionRequest(unchanged, registry, emptyLedger).intent,
    'content-only'
  );
  assert.equal(
    resolveConstructionRequest(
      { ...unchanged, prompt: 'Relight the room at dusk.' },
      registry,
      emptyLedger
    ).intent,
    'reconstruct-registered-entity'
  );
});

test('a different Notion page cannot take over an existing Wisteria ID', () => {
  const proposal = {
    notionPageId: 'different-page',
    wisteriaId: 'library-grand-hall',
    entityKind: 'room',
    parentId: 'library',
    title: 'Grand Hall',
    prompt: 'A different proposal.'
  };
  assert.equal(
    resolveConstructionRequest(proposal, registry, emptyLedger).existingRecord,
    undefined
  );
});

test('new items bind to visible slots before additive construction', () => {
  const entity = {
    notionPageId: 'new-page',
    entityKind: 'item',
    parentId: 'west-shelf',
    title: 'New Book',
    prompt: ''
  };
  const binding = resolveConstructionRequest(entity, registry, emptyLedger);
  assert.equal(binding.intent, 'bind-existing-object');
  assert.equal(binding.compatibleSlot.id, 'west-shelf-open-book');

  const occupied = {
    ...emptyLedger,
    records: [
      ...emptyLedger.records,
      {
        wisteriaId: 'occupied',
        entityKind: 'item',
        sceneId: 'west-shelf',
        slotId: 'west-shelf-open-book'
      }
    ]
  };
  assert.equal(
    resolveConstructionRequest(entity, registry, occupied).intent,
    'additive-construction'
  );
  assert.equal(findFreeSlot(registry.scenes[0], occupied), undefined);
});

test('new items bind only to representation-compatible slots', () => {
  const framedScene = {
    id: 'gallery-wall',
    roomId: 'castle-gallery-room',
    slots: [
      {
        id: 'book-slot',
        representation: 'book',
        bounds: { x: 0.1, y: 0.1, width: 0.1, height: 0.1 },
        occupiedBy: null
      },
      {
        id: 'frame-slot',
        representation: 'framed-art',
        bounds: { x: 0.3, y: 0.2, width: 0.2, height: 0.3 },
        apertureBounds: { x: 0.32, y: 0.22, width: 0.16, height: 0.26 },
        apertureMaskId: 'frame-mask',
        aspectPolicy: 'contain-with-mat',
        occupiedBy: null
      }
    ]
  };
  assert.equal(findFreeSlot(framedScene, emptyLedger, 'framed-art')?.id, 'frame-slot');
  assert.equal(findFreeSlot(framedScene, emptyLedger, 'book')?.id, 'book-slot');
});

test('self-revealing Notion items never bind free slots or trigger construction', () => {
  const curatedRegistry = {
    ...registry,
    structureId: 'castle',
    scenes: [{
      id: 'gallery-wall',
      roomId: 'gallery-room',
      slots: [{
        id: 'legacy-frame',
        representation: 'framed-art',
        bounds: { x: 0.2, y: 0.2, width: 0.2, height: 0.2 },
        occupiedBy: null
      }],
      composition: {
        mode: 'curated-exhibit',
        compositionVersion: 1,
        compositionHash: 'hash',
        exhibitRegion: { x: 0.14, y: 0.14, width: 0.75, height: 0.56 },
        placements: []
      }
    }]
  };
  const result = resolveConstructionRequest({
    notionPageId: 'new-art',
    entityKind: 'item',
    parentId: 'gallery-wall',
    title: 'New Painting',
    artKind: 'painting',
    revelationMode: 'self-revealing',
    representation: 'framed-art'
  }, curatedRegistry, emptyLedger);
  assert.equal(result.intent, 'content-only');
  assert.equal(result.executable, false);
  assert.equal(result.compatibleSlot, undefined);
  assert.equal(
    findFreeSlot(curatedRegistry.scenes[0], emptyLedger, 'framed-art', 'self-revealing'),
    undefined
  );
  assert.match(result.reason, /explicit Codex curation request/);
});

test('registered self-revealing prompt changes remain catalog-only', () => {
  const artRecord = {
    notionPageId: 'art-page',
    wisteriaId: 'painting-one',
    entityKind: 'item',
    parentId: 'gallery-wall',
    roomId: 'gallery-room',
    sceneId: 'gallery-wall',
    revelationMode: 'self-revealing',
    promptHash: 'different'
  };
  const result = resolveConstructionRequest({
    notionPageId: 'art-page',
    entityKind: 'item',
    parentId: 'gallery-wall',
    prompt: 'Change everything.'
  }, { ...registry, scenes: [] }, { records: [artRecord] });
  assert.equal(result.intent, 'content-only');
  assert.equal(result.executable, true);
  assert.match(result.reason, /Only an explicit Codex curation request/);
});

test('Codex curation detects stale compositions, hash drift, and room-lock conflicts', () => {
  const composition = {
    mode: 'curated-exhibit',
    compositionVersion: 3,
    exhibitRegion: { x: 0.14, y: 0.14, width: 0.75, height: 0.56 },
    placements: [{
      id: 'placement-one',
      artworkId: 'painting-one',
      canonicalSha256: 'canonical-hash'
    }]
  };
  composition.compositionHash = computeCompositionHash(composition);
  const curatedRegistry = {
    ...registry,
    structureId: 'castle',
    scenes: [{ id: 'gallery-wall', roomId: 'gallery-room', composition }]
  };
  const curatedLedger = {
    records: [{
      wisteriaId: 'painting-one',
      entityKind: 'item',
      sourceArtwork: { sha256: 'canonical-hash' }
    }],
    activeReservation: { lockScope: 'room:castle/gallery-room' }
  };
  const current = resolveCodexCurationRequest({
    sceneId: 'gallery-wall',
    artKind: 'painting',
    expectedCompositionVersion: 3,
    expectedCompositionHash: composition.compositionHash
  }, curatedRegistry, curatedLedger);
  assert.equal(current.executable, true);
  assert.equal(current.nextCompositionVersion, 4);

  const stale = resolveCodexCurationRequest({
    sceneId: 'gallery-wall',
    expectedCompositionVersion: 2,
    expectedCompositionHash: 'old'
  }, curatedRegistry, {
    ...curatedLedger,
    records: [{
      wisteriaId: 'painting-one',
      entityKind: 'item',
      sourceArtwork: { sha256: 'drifted' }
    }],
    activeReservation: { lockScope: 'room:castle/another-room' }
  });
  assert.equal(stale.executable, false);
  assert.match(stale.blockingReasons.join(' '), /Stale composition/);
  assert.match(stale.blockingReasons.join(' '), /composition hash is stale/);
  assert.match(stale.blockingReasons.join(' '), /Another room lock/);
  assert.match(stale.blockingReasons.join(' '), /canonical hash mismatch/);
});

test('curated composition validation rejects duplicate identities and hotspots', () => {
  const composition = {
    mode: 'curated-exhibit',
    compositionVersion: 1,
    exhibitRegion: { x: 0.1, y: 0.1, width: 0.8, height: 0.7 },
    placements: [
      {
        id: 'placement',
        artworkId: 'painting',
        hotspotId: 'hotspot',
        frameBounds: { x: 0.2, y: 0.2, width: 0.2, height: 0.2 },
        apertureBounds: { x: 0.22, y: 0.22, width: 0.16, height: 0.16 }
      },
      {
        id: 'placement',
        artworkId: 'painting',
        hotspotId: 'hotspot',
        frameBounds: { x: 0.8, y: 0.2, width: 0.2, height: 0.2 },
        apertureBounds: { x: 0.82, y: 0.22, width: 0.16, height: 0.16 }
      }
    ]
  };
  composition.compositionHash = computeCompositionHash(composition);
  const errors = validateCuratedComposition(composition);
  assert.match(errors.join(' '), /Duplicate placement ID/);
  assert.match(errors.join(' '), /Duplicate artwork ID/);
  assert.match(errors.join(' '), /Duplicate hotspot ID/);
  assert.match(errors.join(' '), /frame leaves the exhibit region/);
});

test('temporary candidates and incomplete catalog publication fail closed', () => {
  const errors = validateCurationPublicationGate({
    candidateState: 'temporary',
    visualApprovalId: null,
    approvedBaseCommit: 'a',
    currentBaseCommit: 'b',
    approvedCompositionVersion: 1,
    currentCompositionVersion: 2,
    approvedCompositionHash: 'old',
    currentCompositionHash: 'new',
    approvedLockScope: 'room:castle/gallery',
    currentLockScope: 'room:castle/other',
    canonicalHashesValid: false,
    notionCatalogReady: false
  });
  assert.match(errors.join(' '), /Temporary candidates/);
  assert.match(errors.join(' '), /base commit is stale/);
  assert.match(errors.join(' '), /scene composition is stale/);
  assert.match(errors.join(' '), /room lock is not active/);
  assert.match(errors.join(' '), /canonical artwork hashes are invalid/);
  assert.match(errors.join(' '), /not catalogued in Notion/);
});

test('canonical artwork Notion upserts are stable updates when identity is known', async () => {
  const artwork = {
    notionPageId: 'known-page',
    title: 'Still Life',
    prompt: 'Quiet ceramics.',
    status: 'Processing',
    artKind: 'painting',
    wisteriaId: 'still-life',
    canonicalSha256: 'a'.repeat(64),
    compositionVersion: 1,
    previewOrPrUrl: 'https://example.com/pr/9'
  };
  assert.deepEqual(canonicalArtworkProperties(artwork), canonicalArtworkProperties(artwork));

  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, method: options.method, body: options.body });
    return new Response(JSON.stringify({ object: 'page', id: 'known-page' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };
  try {
    const first = await upsertCanonicalArtworkPage('token', 'source', artwork);
    const second = await upsertCanonicalArtworkPage('token', 'source', artwork);
    assert.equal(first.created, false);
    assert.equal(second.created, false);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, 'https://api.notion.com/v1/pages/known-page');
    assert.deepEqual(calls[0], calls[1]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('destructive parent prompts fail until every descendant is scoped', () => {
  const entity = {
    notionPageId: 'scene-page',
    entityKind: 'room',
    parentId: 'library',
    title: 'Grand Hall',
    prompt: 'Remove the Reading Table and West Shelf.'
  };
  const resolution = resolveConstructionRequest(entity, registry, emptyLedger);
  const blocked = buildImpactManifest(entity, resolution, registry, emptyLedger, {
    sessionId: 'blocked',
    generatedAt: '2026-01-01T00:00:00.000Z'
  });
  assert.equal(blocked.requiresCascadingUnlock, true);
  assert.match(blocked.blockingReasons.join(' '), /reading-table, west-shelf/);

  const unlockedLedger = {
    ...emptyLedger,
    activeUnlocks: [
      {
        rootEntityId: 'library-grand-hall',
        affectedEntityIds: ['reading-table', 'west-shelf'],
        scope: 'room'
      }
    ]
  };
  const allowed = buildImpactManifest(
    entity,
    resolveConstructionRequest(entity, registry, unlockedLedger),
    registry,
    unlockedLedger
  );
  assert.equal(allowed.requiresCascadingUnlock, false);
});

test('parent relighting does not unlock descendant geometry', () => {
  const entity = {
    notionPageId: 'scene-page',
    entityKind: 'room',
    parentId: 'library',
    title: 'Grand Hall',
    prompt: 'Shift the registered lighting toward a quiet amber dusk.'
  };
  const manifest = buildImpactManifest(
    entity,
    resolveConstructionRequest(entity, registry, emptyLedger),
    registry,
    emptyLedger
  );
  assert.equal(manifest.requiresCascadingUnlock, false);
  assert.deepEqual(manifest.protectedDescendantIds, [
    'reading-table',
    'west-shelf'
  ]);
});

test('runtime publication requires a locked matching release', () => {
  const record = {
    wisteriaId: 'sample',
    entityKind: 'item',
    state: 'locked',
    releaseId: 'release-1',
    hotspotId: 'hotspot-1',
    slotId: 'slot-1',
    roomId: 'library-grand-hall',
    sceneId: 'west-shelf',
    constructionHash: 'a',
    lockedConstructionHash: 'a'
  };
  assert.deepEqual(
    validateRuntimeEntry(
      { wisteriaId: 'sample', title: 'Sample' },
      record,
      { requireRelease: true }
    ),
    []
  );
  assert.ok(
    validateRuntimeEntry(
      { wisteriaId: 'sample', title: 'Sample' },
      { ...record, releaseId: null },
      { requireRelease: true }
    ).length > 0
  );
});

test('registered webhook edits rebuild content but never invoke construction', () => {
  const record = {
    source: 'notion',
    entityKind: 'item',
    state: 'locked'
  };
  assert.equal(evaluateWebhookAction({ status: 'Ready' }, record).build, true);
  assert.match(
    evaluateWebhookAction({ status: 'Ready' }, record).reason,
    /construction remains inert/
  );
  assert.equal(evaluateWebhookAction({ status: 'Alive' }, undefined).build, false);
});

test('integration-authored status writes do not recursively trigger builds', () => {
  assert.equal(
    isSystemAuthoredWebhook({ authors: [{ id: 'bot-id', type: 'bot' }] }),
    true
  );
  assert.equal(
    isSystemAuthoredWebhook({ authors: [{ id: 'person-id', type: 'person' }] }),
    false
  );
});

test('cinematic unlocks are exact and scoped', () => {
  const ledger = {
    activeUnlocks: [
      {
        rootEntityId: 'reading-table',
        affectedEntityIds: ['reading-table'],
        scope: 'scene'
      }
    ]
  };
  assert.equal(
    isProtectedAssetChangeAllowed(
      { roomId: 'library-grand-hall', sceneId: 'reading-table' },
      ledger
    ),
    true
  );
  assert.equal(
    isProtectedAssetChangeAllowed(
      { roomId: 'library-grand-hall', sceneId: 'west-shelf' },
      ledger
    ),
    false
  );
});

test('mirrored Notion media uses stable hashed paths', () => {
  const digest = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  assert.equal(
    mediaPublicPath('Sample Entry', digest, 'image/webp'),
    '/media/notion/library/sample-entry/1234567890abcdef1234.webp'
  );
});

test('mirrored media paths are namespaced by structure', () => {
  assert.equal(
    mediaPublicPath('Still Life', 'abcdef1234567890abcdef', 'image/png', 'castle'),
    '/media/notion/castle/still-life/abcdef1234567890abcd.png'
  );
});
