import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const NOTION_VERSION = '2026-03-11';
export const LIBRARY_ROOT = 'world/structures/library';
export const LOCATION_REGISTRY_PATH = `${LIBRARY_ROOT}/locations.json`;
export const CONSTRUCTION_LEDGER_PATH = `${LIBRARY_ROOT}/construction-ledger.json`;
export const NOTION_CONFIG_PATH = `${LIBRARY_ROOT}/notion.json`;
export const SNAPSHOT_PATH = '.wisteria-cache/library-notion.json';
export const IMPACT_MANIFEST_PATH = '.wisteria-cache/library-impact.json';
export const MEDIA_ROOT = 'public/media/notion/library';

const ENTITY_PROPERTIES = {
  room: { title: 'Room Name', prompt: 'Room Prompt' },
  scene: { title: 'Scene Name', prompt: 'Scene Prompt' },
  item: { title: 'Title', prompt: 'Appearance Prompt' }
};

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

export async function writeJsonAtomic(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporary, filePath);
}

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function slugify(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
}

export function textProperty(property) {
  const values = property?.title ?? property?.rich_text ?? [];
  return values.map((item) => item.plain_text ?? item.text?.content ?? '').join('');
}

export function selectProperty(property) {
  return property?.select?.name ?? property?.status?.name ?? '';
}

export function visibleGalleryProperties(schema = {}, current = [], wrap = true) {
  const currentById = new Map(
    current.map((property) => [String(property.property_id), property])
  );
  return Object.entries(schema).map(([name, property]) => {
    const propertyId = String(property?.id ?? name);
    return {
      ...(currentById.get(propertyId) ?? {}),
      property_id: propertyId,
      visible: true,
      wrap
    };
  });
}

export function galleryShowsAllProperties(view, schema = {}, wrap = true) {
  if (view?.type !== 'gallery') return false;
  const configured = new Map(
    (view.configuration?.properties ?? []).map((property) => [
      String(property.property_id),
      { visible: property.visible, wrap: property.wrap }
    ])
  );
  return Object.entries(schema).every(([name, property]) => {
    const propertyId = String(property?.id ?? name);
    const propertyConfig = configured.get(propertyId);
    return propertyConfig?.visible === true && propertyConfig.wrap === wrap;
  });
}

export function richTextToMarkdown(items = []) {
  return items
    .map((item) => {
      let text = item.plain_text ?? item.text?.content ?? '';
      if (!text) return '';
      const annotations = item.annotations ?? {};
      if (annotations.code) text = `\`${text}\``;
      if (annotations.bold) text = `**${text}**`;
      if (annotations.italic) text = `*${text}*`;
      if (annotations.strikethrough) text = `~~${text}~~`;
      const href = item.href ?? item.text?.link?.url;
      if (href) text = `[${text}](${href})`;
      return text;
    })
    .join('');
}

export function propertyModel(page, entityKind = 'item', parentId = '') {
  const definition = ENTITY_PROPERTIES[entityKind];
  if (!definition) throw new Error(`Unsupported Wisteria entity kind: ${entityKind}`);
  const properties = page.properties ?? {};
  return {
    notionPageId: page.id,
    entityKind,
    parentId,
    title: textProperty(properties[definition.title]),
    prompt: textProperty(properties[definition.prompt]),
    status: selectProperty(properties['Wisteria Status']) || 'Draft',
    lastEditedTime: page.last_edited_time ?? ''
  };
}

export function findEntityRecord(entity, ledger) {
  if (entity.notionPageId) {
    return ledger.records.find(
      (record) => record.notionPageId === entity.notionPageId
    );
  }
  return ledger.records.find(
    (record) => entity.wisteriaId && record.wisteriaId === entity.wisteriaId
  );
}

export function findFreeSlot(scene, ledger) {
  if (!scene) return undefined;
  const occupied = new Set(
    ledger.records
      .filter((record) => record.entityKind === 'item' && record.sceneId === scene.id)
      .map((record) => record.slotId)
  );
  return scene.slots.find((slot) => !slot.occupiedBy && !occupied.has(slot.id));
}

export function computeSourceHash(entry, bodyMarkdown, media = []) {
  return sha256(
    stableStringify({
      title: entry.title,
      bodyMarkdown,
      media: media.map((item) => ({
        sha256: item.sha256,
        publicPath: item.publicPath,
        alt: item.alt,
        caption: item.caption
      }))
    })
  );
}

export function computePromptHash(entity) {
  return sha256(
    stableStringify({
      entityKind: entity.entityKind,
      prompt: entity.prompt ?? ''
    })
  );
}

export function computeConstructionHash(entity, placement, version) {
  return sha256(
    stableStringify({
      entityKind: entity.entityKind,
      parentId: entity.parentId,
      promptHash: computePromptHash(entity),
      placement,
      constructionVersion: version
    })
  );
}

export function resolveConstructionRequest(entity, registry, ledger) {
  const existingRecord = findEntityRecord(entity, ledger);
  if (existingRecord) {
    const promptChanged = computePromptHash(entity) !== existingRecord.promptHash;
    return {
      intent: promptChanged ? 'reconstruct-registered-entity' : 'content-only',
      entityKind: entity.entityKind,
      parentId: existingRecord.parentId ?? entity.parentId,
      roomId:
        existingRecord.entityKind === 'room'
          ? existingRecord.wisteriaId
          : existingRecord.roomId,
      sceneId:
        existingRecord.entityKind === 'scene'
          ? existingRecord.wisteriaId
          : existingRecord.sceneId,
      existingRecord,
      reason: promptChanged
        ? 'The registered construction prompt changed and requires an approved reconstruction.'
        : 'The registered construction is unchanged; page-body edits are content-only.',
      executable: true
    };
  }

  if (entity.entityKind === 'room') {
    return {
      intent: 'create-location',
      entityKind: 'room',
      parentId: entity.parentId,
      reason: 'A new Library room requires map placement and navigation approval.',
      executable: entity.parentId === registry.structureId
    };
  }

  if (entity.entityKind === 'scene') {
    const room = registry.rooms.find((candidate) => candidate.id === entity.parentId);
    return {
      intent: 'create-location',
      entityKind: 'scene',
      parentId: entity.parentId,
      roomId: room?.id,
      reason: room
        ? 'A new scene requires a protected parent anchor and interaction route.'
        : 'The parent room is not registered.',
      executable: Boolean(room)
    };
  }

  const scene = registry.scenes.find((candidate) => candidate.id === entity.parentId);
  if (!scene) {
    return {
      intent: 'create-location',
      entityKind: 'item',
      parentId: entity.parentId,
      reason: 'The parent scene is not registered.',
      executable: false
    };
  }
  const compatibleSlot = findFreeSlot(scene, ledger);
  return {
    intent: compatibleSlot ? 'bind-existing-object' : 'additive-construction',
    entityKind: 'item',
    parentId: scene.id,
    roomId: scene.roomId,
    sceneId: scene.id,
    compatibleSlot,
    reason: compatibleSlot
      ? `An unoccupied ${compatibleSlot.representation} slot is available.`
      : 'No registered visible slot is available; additive artwork is required.',
    executable: true
  };
}

function promptRequestsDescendantChange(prompt, descendants, registry) {
  if (!prompt || !descendants.length) return false;
  const normalized = prompt.toLowerCase();
  const destructive = /\b(remove|delete|eliminate|replace|erase|without|clear out|tear down)\b/.test(
    normalized
  );
  if (!destructive) return false;
  const labels = descendants.flatMap((id) => {
    const scene = registry.scenes.find((item) => item.id === id);
    return [id, scene?.label ?? ''];
  });
  return labels.some((label) => label && normalized.includes(label.toLowerCase())) || destructive;
}

export function hasCascadingUnlock(ledger, rootEntityId, descendantIds) {
  return ledger.activeUnlocks.some(
    (unlock) =>
      unlock.rootEntityId === rootEntityId &&
      descendantIds.every((id) => unlock.affectedEntityIds.includes(id))
  );
}

export function buildImpactManifest(entity, resolution, registry, ledger, options = {}) {
  const rootRecord = resolution.existingRecord;
  const protectedDescendantIds = rootRecord?.dependencyLock?.protectedDescendantIds ?? [];
  const destructive = promptRequestsDescendantChange(
    entity.prompt,
    protectedDescendantIds,
    registry
  );
  const unlocked = hasCascadingUnlock(
    ledger,
    rootRecord?.wisteriaId ?? '',
    protectedDescendantIds
  );
  const requiresCascadingUnlock = destructive && !unlocked;
  const roomId =
    resolution.roomId ??
    (entity.entityKind === 'room' ? rootRecord?.wisteriaId : undefined) ??
    registry.rooms[0]?.id;
  const requiresArtwork =
    resolution.intent === 'additive-construction' ||
    resolution.intent === 'reconstruct-registered-entity' ||
    resolution.intent === 'create-location';

  return {
    schemaVersion: 1,
    sessionId: options.sessionId ?? randomUUID(),
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    lockScope: `room:${registry.structureId}/${roomId}`,
    baseCommit: options.baseCommit ?? null,
    intent: resolution.intent,
    rootEntityId: rootRecord?.wisteriaId ?? slugify(entity.title),
    requestedEntityIds: [rootRecord?.wisteriaId ?? slugify(entity.title)],
    affectedEntityIds: [
      rootRecord?.wisteriaId ?? slugify(entity.title),
      ...(requiresCascadingUnlock ? protectedDescendantIds : [])
    ],
    protectedDescendantIds,
    affectedLayers: requiresArtwork
      ? rootRecord?.dependencyLock?.preserves ?? ['interaction-manifest']
      : [],
    affectedMasks:
      entity.entityKind === 'item' && resolution.compatibleSlot
        ? [resolution.compatibleSlot.id]
        : [],
    affectedAnchors:
      entity.entityKind === 'scene' || entity.entityKind === 'room'
        ? [entity.parentId]
        : [],
    navigationChanges: entity.entityKind === 'room' ? ['map-node', 'directional-edges'] : [],
    requiresArtwork,
    requiresCascadingUnlock,
    blockingReasons: [
      ...(!resolution.executable ? [resolution.reason] : []),
      ...(requiresCascadingUnlock
        ? [
            `The prompt would alter protected descendants: ${protectedDescendantIds.join(', ')}. Confirm these exact IDs in Codex before proceeding.`
          ]
        : [])
    ]
  };
}

export function validateLockedRecord(record, options = {}) {
  const requireRelease = options.requireRelease ?? true;
  const errors = [];
  if (!record) return ['Missing construction record.'];
  if (record.state !== 'locked') errors.push('Construction is not locked.');
  if (requireRelease && !record.releaseId) errors.push('Release ID is missing.');
  if (!record.lockedConstructionHash || record.lockedConstructionHash !== record.constructionHash) {
    errors.push('Locked construction hash does not match construction.');
  }
  if (record.entityKind === 'item') {
    if (!record.hotspotId) errors.push('Hotspot ID is missing.');
    if (!record.roomId || !record.sceneId || !record.slotId) {
      errors.push('Production placement is incomplete.');
    }
  }
  return errors;
}

export function validateRuntimeEntry(entry, record, options = {}) {
  const errors = validateLockedRecord(record, options);
  if (record?.entityKind !== 'item') errors.push('Runtime entry is not registered as an item.');
  if (entry.wisteriaId !== record?.wisteriaId) errors.push('Wisteria ID does not match the ledger.');
  if (!entry.title.trim()) errors.push('Title is required.');
  return errors;
}

export function evaluateWebhookAction(entity, record) {
  if (!record || record.entityKind !== 'item' || record.source !== 'notion') {
    return { build: false, reason: 'Page is not a registered Notion item.' };
  }
  if (record.state === 'retired') {
    return { build: true, reason: 'A registered item was retired or unbound.' };
  }
  return {
    build: true,
    reason:
      entity.status === 'Ready'
        ? 'Content may rebuild; construction remains inert until manually processed.'
        : 'Registered editorial content may rebuild without construction.'
  };
}

export function isSystemAuthoredWebhook(payload) {
  return (
    Array.isArray(payload?.authors) &&
    payload.authors.length > 0 &&
    payload.authors.every((author) => author?.type === 'bot')
  );
}

export function isProtectedAssetChangeAllowed(asset, ledger) {
  return ledger.activeUnlocks.some((unlock) => {
    if (unlock.scope === 'room' && unlock.rootEntityId === asset.roomId) return true;
    if (!asset.sceneId) return false;
    return (
      (unlock.scope === 'scene' || unlock.scope === 'cinematic-media') &&
      unlock.affectedEntityIds.includes(asset.sceneId)
    );
  });
}

export async function notionRequest(token, endpoint, options = {}) {
  const response = await fetch(`https://api.notion.com/v1${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
      ...(options.headers ?? {})
    }
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Notion API ${response.status} ${response.statusText}: ${detail}`);
  }
  if (response.status === 204) return undefined;
  return response.json();
}

export async function queryDataSource(token, dataSourceId, statuses, statusProperty = 'Wisteria Status') {
  const results = [];
  let startCursor;
  do {
    const body = { page_size: 100 };
    if (startCursor) body.start_cursor = startCursor;
    if (statuses?.length) {
      body.filter = {
        or: statuses.map((status) => ({
          property: statusProperty,
          select: { equals: status }
        }))
      };
    }
    const response = await notionRequest(token, `/data_sources/${dataSourceId}/query`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    results.push(...response.results.filter((item) => item.object === 'page'));
    startCursor = response.has_more ? response.next_cursor : undefined;
  } while (startCursor);
  return results;
}

export async function retrievePage(token, pageId) {
  return notionRequest(token, `/pages/${pageId}`);
}

export async function retrieveBlockChildren(token, blockId) {
  const blocks = [];
  let startCursor;
  do {
    const query = new URLSearchParams({ page_size: '100' });
    if (startCursor) query.set('start_cursor', startCursor);
    const response = await notionRequest(token, `/blocks/${blockId}/children?${query}`, {
      headers: { 'Content-Type': 'application/json' }
    });
    for (const block of response.results) {
      if (block.has_children && block.type !== 'child_database' && block.type !== 'child_page') {
        block.children = await retrieveBlockChildren(token, block.id);
      }
      blocks.push(block);
    }
    startCursor = response.has_more ? response.next_cursor : undefined;
  } while (startCursor);
  return blocks;
}

export async function updatePageProperties(token, pageId, properties) {
  return notionRequest(token, `/pages/${pageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ properties })
  });
}

export async function createPageComment(token, pageId, markdown) {
  return notionRequest(token, '/comments', {
    method: 'POST',
    body: JSON.stringify({
      parent: { page_id: pageId },
      rich_text: [{ type: 'text', text: { content: String(markdown).slice(0, 2000) } }]
    })
  });
}

export function richTextValue(value) {
  return {
    rich_text: value
      ? [{ type: 'text', text: { content: String(value).slice(0, 2000) } }]
      : []
  };
}

export function selectValue(value) {
  return { select: value ? { name: value } : null };
}

export function statusValue(value) {
  return selectValue(value);
}
