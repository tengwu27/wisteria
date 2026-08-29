import galleryBase1254 from '../../assets/cinematic/scenes/castle-gallery-room/delivery/castle-gallery-base-1254.webp';
import galleryBase1672 from '../../assets/cinematic/scenes/castle-gallery-room/delivery/castle-gallery-base-1672.webp';
import galleryFallback1254 from '../../assets/cinematic/scenes/castle-gallery-room/delivery/castle-gallery-fallback-1254.webp';
import galleryFallback1672 from '../../assets/cinematic/scenes/castle-gallery-room/delivery/castle-gallery-fallback-1672.webp';
import galleryProxy1254 from '../../assets/cinematic/scenes/castle-gallery-room/delivery/castle-gallery-proxy-1254.webp';
import galleryProxy1672 from '../../assets/cinematic/scenes/castle-gallery-room/delivery/castle-gallery-proxy-1672.webp';
import galleryShell1254 from '../../assets/cinematic/scenes/castle-gallery-room/delivery/castle-gallery-shell-1254.webp';
import galleryShell1672 from '../../assets/cinematic/scenes/castle-gallery-room/delivery/castle-gallery-shell-1672.webp';
import artwork724 from '../../assets/cinematic/art-pieces/still-life-with-wisteria/delivery/still-life-with-wisteria-724.webp';
import artwork1448 from '../../assets/cinematic/art-pieces/still-life-with-wisteria/delivery/still-life-with-wisteria-1448.webp';
import artworkSource from '../../assets/cinematic/art-pieces/still-life-with-wisteria/source/still-life-with-wisteria-v1.png';
import artworkProxy724 from '../../assets/cinematic/art-pieces/still-life-with-wisteria/delivery/still-life-with-wisteria-proxy-724.webp';
import artworkProxy1448 from '../../assets/cinematic/art-pieces/still-life-with-wisteria/delivery/still-life-with-wisteria-proxy-1448.webp';
import locationRegistry from '../../world/structures/castle/locations.json';

const gallerySceneRegistry = locationRegistry.scenes.find(
  (scene) => scene.id === 'castle-gallery-wall'
);
if (!gallerySceneRegistry) throw new Error('Castle Gallery scene registry is missing.');

const centerFrame = gallerySceneRegistry.slots.find(
  (slot) => slot.id === 'gallery-center-frame'
);
if (!centerFrame?.occupiedBy || !centerFrame.apertureBounds) {
  throw new Error('Castle Gallery center frame is not registered.');
}

export const castleGalleryScene = {
  id: gallerySceneRegistry.id,
  canvas: { width: 1672, height: 941 },
  initialFocalRatio: 836 / 1672,
  baseAssets: [galleryBase1254, galleryBase1672],
  proxyAssets: [galleryProxy1254, galleryProxy1672],
  shellAssets: [galleryShell1254, galleryShell1672],
  fallbackAssets: [galleryFallback1254, galleryFallback1672],
  artwork: {
    id: centerFrame.occupiedBy,
    title: 'Still Life with Wisteria',
    titleZh: '紫藤静物',
    artist: 'Wisteria Collection',
    year: 'Undated',
    description:
      'A blue-and-white pitcher and teacup rest beside a walnut-bound sketchbook, mustard cloth, wisteria sprig, and aged-brass candleholder.',
    route: `/castle/gallery/art/${centerFrame.occupiedBy}`,
    hotspotId: 'castle-gallery-still-life-with-wisteria',
    bounds: centerFrame.bounds,
    apertureBounds: centerFrame.apertureBounds,
    source: artworkSource,
    responsiveSources: [artwork724, artwork1448],
    proxySources: [artworkProxy724, artworkProxy1448],
    sourceSha256:
      '60d56d0150d46b64524e99f367def985d36c1359bad99bd8d49b6bbc09043e53'
  }
} as const;

export type CastleGalleryArtwork = typeof castleGalleryScene.artwork;

export function findCastleGalleryArtwork(artworkId: string) {
  return artworkId === castleGalleryScene.artwork.id
    ? castleGalleryScene.artwork
    : undefined;
}

