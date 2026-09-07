import galleryBase1254 from '../../assets/cinematic/scenes/castle-gallery-room/delivery/castle-gallery-base-1254.webp';
import galleryBase1672 from '../../assets/cinematic/scenes/castle-gallery-room/delivery/castle-gallery-base-1672.webp';
import galleryFallback1254 from '../../assets/cinematic/scenes/castle-gallery-room/delivery/castle-gallery-fallback-1254.webp';
import galleryFallback1672 from '../../assets/cinematic/scenes/castle-gallery-room/delivery/castle-gallery-fallback-1672.webp';
import galleryProxy1254 from '../../assets/cinematic/scenes/castle-gallery-room/delivery/castle-gallery-proxy-1254.webp';
import galleryProxy1672 from '../../assets/cinematic/scenes/castle-gallery-room/delivery/castle-gallery-proxy-1672.webp';
import galleryShell1254 from '../../assets/cinematic/scenes/castle-gallery-room/delivery/castle-gallery-shell-1254.webp';
import galleryShell1672 from '../../assets/cinematic/scenes/castle-gallery-room/delivery/castle-gallery-shell-1672.webp';
import artworkSource from '../../assets/cinematic/art-pieces/still-life-with-wisteria/source/still-life-with-wisteria-v1.png';
import artworkProxy724 from '../../assets/cinematic/art-pieces/still-life-with-wisteria/delivery/still-life-with-wisteria-proxy-724.webp';
import artworkProxy1448 from '../../assets/cinematic/art-pieces/still-life-with-wisteria/delivery/still-life-with-wisteria-proxy-1448.webp';
import constructionLedger from '../../world/structures/castle/construction-ledger.json';
import locationRegistry from '../../world/structures/castle/locations.json';
import { getNotionCastleEntries } from '@/lib/notionCastle';
import { castleArtworkPublicationDecision } from '../../scripts/notion/castle-publication.mjs';

const gallerySceneRegistry = locationRegistry.scenes.find(
  (scene) => scene.id === 'castle-gallery-wall'
);
if (!gallerySceneRegistry) throw new Error('Castle Gallery scene registry is missing.');

const composition = gallerySceneRegistry.composition;
if (composition?.mode !== 'curated-exhibit') {
  throw new Error('Castle Gallery curated composition is not registered.');
}
const stillLifePlacementCandidate = composition.placements.find(
  (placement) => placement.artworkId === 'still-life-with-wisteria'
);
if (!stillLifePlacementCandidate) {
  throw new Error('Castle Gallery still-life placement is not registered.');
}
const stillLifePlacement = stillLifePlacementCandidate;

const castleGallerySceneBase = {
  id: gallerySceneRegistry.id,
  mode: composition.mode,
  compositionVersion: composition.compositionVersion,
  compositionHash: composition.compositionHash,
  exhibitRegion: composition.exhibitRegion,
  canvas: { width: 1672, height: 941 },
  initialFocalRatio: 836 / 1672,
  baseAssets: [galleryBase1254, galleryBase1672],
  proxyAssets: [galleryProxy1254, galleryProxy1672],
  shellAssets: [galleryShell1254, galleryShell1672],
  fallbackAssets: [galleryFallback1254, galleryFallback1672]
} as const;

const artworkRecordCandidate = constructionLedger.records.find(
  (record) => record.wisteriaId === stillLifePlacement.artworkId
);
if (!artworkRecordCandidate || artworkRecordCandidate.entityKind !== 'item') {
  throw new Error('Castle Gallery artwork construction record is missing.');
}
const artworkRecord = artworkRecordCandidate;

const artworkDefinition = {
    id: stillLifePlacement.artworkId,
    title: 'Still Life with Wisteria',
    titleZh: '紫藤静物',
    artist: 'Wisteria Collection',
    year: 'Undated',
    description:
      'A blue-and-white pitcher and teacup rest beside a walnut-bound sketchbook, mustard cloth, wisteria sprig, and aged-brass candleholder.',
    route: `/castle/gallery/art/${stillLifePlacement.artworkId}`,
    hotspotId: stillLifePlacement.hotspotId,
    placementId: stillLifePlacement.id,
    artKind: stillLifePlacement.artKind,
    bounds: stillLifePlacement.frameBounds,
    apertureBounds: stillLifePlacement.apertureBounds,
    source: artworkSource,
    proxySources: [artworkProxy724, artworkProxy1448],
  sourceSha256:
    '60d56d0150d46b64524e99f367def985d36c1359bad99bd8d49b6bbc09043e53'
} as const;

export async function getCastleGalleryScene() {
  const context = process.env.CONTEXT ?? process.env.WISTERIA_BUILD_CONTEXT ?? 'local';
  const entries = await getNotionCastleEntries();
  const entry = entries.find((candidate) => candidate.wisteriaId === stillLifePlacement.artworkId);
  const publication = castleArtworkPublicationDecision({
    context,
    record: artworkRecord,
    placement: stillLifePlacement,
    entry
  });
  const artwork = publication.visible ? artworkDefinition : null;
  return {
    ...castleGallerySceneBase,
    proxyAssets: artwork ? castleGallerySceneBase.proxyAssets : [],
    fallbackAssets: artwork
      ? castleGallerySceneBase.fallbackAssets
      : castleGallerySceneBase.baseAssets,
    artwork
  };
}

export type CastleGalleryArtwork = NonNullable<Awaited<ReturnType<typeof getCastleGalleryScene>>['artwork']>;
