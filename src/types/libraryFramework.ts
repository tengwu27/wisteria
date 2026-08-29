import type { NormalizedBounds } from './immersive';

export type EntityKind = 'structure' | 'room' | 'scene' | 'item';

export type WisteriaStatus =
  | 'Draft'
  | 'Ready'
  | 'Processing'
  | 'Landed'
  | 'Alive';

export type ConstructionIntent =
  | 'content-only'
  | 'bind-existing-object'
  | 'additive-construction'
  | 'reconstruct-registered-entity'
  | 'create-location'
  | 'remove-or-unbind';

export type ConstructionRecordState =
  | 'locked'
  | 'pending'
  | 'unlocked'
  | 'retired';

export type WisteriaItemRepresentation =
  | 'book'
  | 'letter'
  | 'object'
  | 'framed-art';

/** @deprecated Prefer the structure-neutral WisteriaItemRepresentation. */
export type LibraryRepresentation = WisteriaItemRepresentation;

export interface LibrarySpatialNode {
  roomId: string;
  label: string;
  route: string;
  x: number;
  y: number;
  initiallyDiscovered: boolean;
}

export interface LibrarySpatialEdge {
  from: string;
  to: string;
  direction: 'left' | 'right' | 'forward' | 'back';
}

export interface LibraryRoomRef {
  id: string;
  label: string;
  route: string;
  characterVersion: number;
  description: string;
  protectedSceneIds: string[];
}

export interface LibraryHotspotSlot {
  id: string;
  representation: WisteriaItemRepresentation;
  frameEnvelopeBounds?: NormalizedBounds;
  bounds: NormalizedBounds;
  apertureBounds?: NormalizedBounds;
  apertureMaskId?: string;
  aspectPolicy?: 'cover' | 'contain-with-mat' | 'match-source-frame';
  occupiedBy: string | null;
}

export interface LibrarySceneRef {
  id: string;
  label: string;
  roomId: string;
  characterVersion: number;
  description: string;
  protectedRegion: NormalizedBounds;
  slots: LibraryHotspotSlot[];
}

export interface WisteriaLocationRegistry {
  schemaVersion: 3;
  structureId: string;
  map: {
    discoveryStorageKey: string;
    nodes: LibrarySpatialNode[];
    edges: LibrarySpatialEdge[];
  };
  rooms: LibraryRoomRef[];
  scenes: LibrarySceneRef[];
}

export interface LibraryLocationRegistry extends WisteriaLocationRegistry {
  structureId: 'library';
}

export interface DependencyLock {
  preserves: string[];
  protectedDescendantIds: string[];
  allowParentRelighting: boolean;
}

export interface ConstructionVersionReference {
  version: number;
  constructionHash: string;
  commit: string | null;
  pullRequest: number | null;
  previewUrl: string | null;
  releaseId: string | null;
  state: 'previewing' | 'approved' | 'landed' | 'alive' | 'superseded';
}

export interface GitHubConstructionReservation {
  sessionId: string;
  lockScope: string;
  branch: string;
  pullRequest: number;
  baseCommit: string;
  entityIds: string[];
  approvedAt: string;
}

export interface LibraryConstructionUnlock {
  id: string;
  rootEntityId: string;
  affectedEntityIds: string[];
  scope: 'item' | 'scene' | 'room' | 'cinematic-media';
  reason: string;
  approvedAt: string;
  approvedBy: string;
}

export interface RegisteredWisteriaEntity {
  wisteriaId: string;
  entityKind: EntityKind;
  parentId: string | null;
  source: 'repository' | 'local-fixture' | 'notion';
  notionPageId: string | null;
  state: ConstructionRecordState;
  constructionVersion: number;
  promptHash: string;
  constructionHash: string;
  lockedConstructionHash: string;
  releaseId: string | null;
  dependencyLock: DependencyLock;
  pendingVersion: ConstructionVersionReference | null;
  history: ConstructionVersionReference[];
}

export interface LibraryConstructionRecord extends RegisteredWisteriaEntity {
  entityKind: 'item';
  roomId: string;
  sceneId: string;
  slotId: string;
  hotspotId: string;
  representation: WisteriaItemRepresentation;
  frameEnvelopeBounds?: NormalizedBounds;
  bounds: NormalizedBounds;
  apertureBounds?: NormalizedBounds;
  apertureMaskId?: string;
  sourceArtwork?: {
    notionBlockId: string | null;
    sha256: string;
    width: number;
    height: number;
    contentType: string;
    publicPath: string | null;
  };
  wallProxy?: {
    assetPath: string;
    sha256: string;
    promptPath: string;
  };
}

export interface LibraryEditorialMediaAttachment {
  notionBlockId: string;
  kind: 'image' | 'file';
  sourceUrl: string;
  filename: string;
  contentType?: string;
  alt?: string;
  caption?: string;
}

export interface LibraryRuntimeMediaReference {
  sha256: string;
  publicPath: string;
  contentType: string;
  byteLength: number;
  alt?: string;
  caption?: string;
}

export interface LibraryNotionEntity {
  notionPageId: string;
  entityKind: EntityKind;
  parentId: string;
  title: string;
  prompt: string;
  status: WisteriaStatus;
  lastEditedTime: string;
}

export interface LibraryNotionEntry extends LibraryNotionEntity {
  entityKind: 'item';
  wisteriaId: string;
  sourceHash: string;
  constructionHash: string;
  lockedConstructionHash: string;
  constructionVersion: number;
  roomId: string;
  sceneId: string;
  hotspotId: string;
  representation: WisteriaItemRepresentation;
  releaseId: string | null;
  bodyMarkdown: string;
  media: LibraryRuntimeMediaReference[];
}

export interface ConstructionImpactManifest {
  schemaVersion: 1;
  sessionId: string;
  generatedAt: string;
  lockScope: string;
  baseCommit: string | null;
  intent: ConstructionIntent;
  rootEntityId: string;
  requestedEntityIds: string[];
  affectedEntityIds: string[];
  protectedDescendantIds: string[];
  affectedLayers: string[];
  affectedMasks: string[];
  affectedAnchors: string[];
  navigationChanges: string[];
  requiresArtwork: boolean;
  requiresCascadingUnlock: boolean;
  blockingReasons: string[];
}

export interface ResolvedConstructionRequest {
  intent: ConstructionIntent;
  entityKind: EntityKind;
  parentId: string;
  roomId?: string;
  sceneId?: string;
  existingRecord?: RegisteredWisteriaEntity;
  compatibleSlot?: LibraryHotspotSlot;
  reason: string;
  executable: boolean;
}
