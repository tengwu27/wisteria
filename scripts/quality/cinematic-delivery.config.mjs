const KiB = 1024;
const MiB = 1024 * KiB;

// For temporary visual testing, set only the affected route to `prototype` and
// replace its null bypass with { reason: '...', expires: 'YYYY-MM-DD' }.
// The normal production build rejects that state until it is removed.
export const cinematicDeliveryConfig = {
  schemaVersion: 1,
  globalPerformanceBypass: null,
  sitemapExcludedFragments: [
    '/prototype/',
    '/collection/',
    '/art/archive/',
    '/lifestyle/archive/',
    '/travel/archive/',
    '/art/quiet-window-study/',
    '/art/soft-geometry/',
    '/lifestyle/a-found-essay/',
    '/lifestyle/morning-table-notes/',
    '/travel/garden-walk/',
    '/travel/winter-coastline/',
    '/travel/supabase-test-trip/'
  ],
  legacyRedirects: [
    'art/archive',
    'lifestyle/archive',
    'travel/archive',
    'art/quiet-window-study',
    'art/soft-geometry',
    'lifestyle/a-found-essay',
    'lifestyle/morning-table-notes',
    'travel/garden-walk',
    'travel/winter-coastline',
    'travel/supabase-test-trip'
  ],
  budgets: {
    initialRouteCodeBytes: 350 * KiB,
    immersiveFontBytes: 32 * KiB,
    deliveryImageBytes: 1 * MiB
  },
  routes: [
    {
      id: 'village',
      label: 'isometric coastal village',
      html: 'dist/index.html',
      mediaRoots: [
        'assets/cinematic/scenes/gamified-coastal-village/isometric-parallax/registered'
      ],
      deliveryStatus: 'production',
      performanceBypass: null
    },
    {
      id: 'harbor',
      label: 'green-domed harbor vista interior',
      html: 'dist/harbor/index.html',
      mediaRoots: [
        'assets/cinematic/scenes/harbor-interior/delivery'
      ],
      sceneKind: 'static-artwork',
      deliveryStatus: 'production',
      performanceBypass: null
    },
    {
      id: 'castle-gate',
      label: 'castle bridgehead and main gate',
      html: 'dist/castle/index.html',
      mediaRoots: [
        'assets/cinematic/scenes/castle-interior/delivery'
      ],
      sceneKind: 'static-artwork',
      castleScene: 'gate',
      deliveryStatus: 'production',
      performanceBypass: null
    },
    {
      id: 'castle-courtyard',
      label: 'castle inner courtyard',
      html: 'dist/castle/courtyard/index.html',
      mediaRoots: [
        'assets/cinematic/scenes/castle-interior/delivery'
      ],
      sceneKind: 'static-artwork',
      castleScene: 'courtyard',
      deliveryStatus: 'production',
      performanceBypass: null
    },
    {
      id: 'castle-arcade',
      label: 'castle rear arcade',
      html: 'dist/castle/arcade/index.html',
      mediaRoots: [
        'assets/cinematic/scenes/castle-interior/delivery'
      ],
      sceneKind: 'static-artwork',
      castleScene: 'arcade',
      deliveryStatus: 'production',
      performanceBypass: null
    },
    {
      id: 'castle-gallery',
      label: 'castle framed-art gallery',
      html: 'dist/castle/gallery/index.html',
      mediaRoots: [
        'assets/cinematic/art-pieces/still-life-with-wisteria/delivery'
      ],
      sceneKind: 'layered-art-gallery',
      manifest: 'assets/cinematic/scenes/castle-gallery-room/delivery/gallery-layer-manifest.json',
      artworkHtml: 'dist/castle/gallery/art/still-life-with-wisteria/index.html',
      artworkId: 'still-life-with-wisteria',
      sourceArtwork: {
        path: 'assets/cinematic/art-pieces/still-life-with-wisteria/source/still-life-with-wisteria-v1.png',
        width: 1448,
        height: 1086,
        sha256: '60d56d0150d46b64524e99f367def985d36c1359bad99bd8d49b6bbc09043e53'
      },
      galleryMedia: [
        { path: 'assets/cinematic/scenes/castle-gallery-room/delivery/castle-gallery-base-1254.webp', width: 1254, height: 706 },
        { path: 'assets/cinematic/scenes/castle-gallery-room/delivery/castle-gallery-base-1672.webp', width: 1672, height: 941 },
        { path: 'assets/cinematic/scenes/castle-gallery-room/delivery/castle-gallery-proxy-1254.webp', width: 1254, height: 706 },
        { path: 'assets/cinematic/scenes/castle-gallery-room/delivery/castle-gallery-proxy-1672.webp', width: 1672, height: 941 },
        { path: 'assets/cinematic/scenes/castle-gallery-room/delivery/castle-gallery-shell-1254.webp', width: 1254, height: 706 },
        { path: 'assets/cinematic/scenes/castle-gallery-room/delivery/castle-gallery-shell-1672.webp', width: 1672, height: 941 },
        { path: 'assets/cinematic/scenes/castle-gallery-room/delivery/castle-gallery-fallback-1254.webp', width: 1254, height: 706 },
        { path: 'assets/cinematic/scenes/castle-gallery-room/delivery/castle-gallery-fallback-1672.webp', width: 1672, height: 941 },
        { path: 'assets/cinematic/art-pieces/still-life-with-wisteria/delivery/still-life-with-wisteria-724.webp', width: 724, height: 543 },
        { path: 'assets/cinematic/art-pieces/still-life-with-wisteria/delivery/still-life-with-wisteria-1448.webp', width: 1448, height: 1086 },
        { path: 'assets/cinematic/art-pieces/still-life-with-wisteria/delivery/still-life-with-wisteria-proxy-724.webp', width: 724, height: 543 },
        { path: 'assets/cinematic/art-pieces/still-life-with-wisteria/delivery/still-life-with-wisteria-proxy-1448.webp', width: 1448, height: 1086 }
      ],
      deliveryStatus: 'production',
      performanceBypass: null
    },
    {
      id: 'restaurant',
      label: 'restaurant vista interior',
      html: 'dist/restaurant/index.html',
      mediaRoots: [
        'assets/cinematic/scenes/restaurant-vista-interior/delivery'
      ],
      sceneKind: 'static-artwork',
      deliveryStatus: 'production',
      performanceBypass: null
    },
    {
      id: 'cafe',
      label: 'windmill cafe interior',
      html: 'dist/cafe/index.html',
      mediaRoots: [
        'assets/cinematic/scenes/windmill-cafe-interior/delivery'
      ],
      sceneKind: 'static-artwork',
      deliveryStatus: 'production',
      performanceBypass: null
    },
    {
      id: 'workshop',
      label: 'bay workshop interior',
      html: 'dist/workshop/index.html',
      mediaRoots: [
        'assets/cinematic/scenes/workshop-interior/delivery'
      ],
      sceneKind: 'static-artwork',
      deliveryStatus: 'production',
      performanceBypass: null
    },
    {
      id: 'library',
      label: 'cathedral library grand hall',
      html: 'dist/library/index.html',
      mediaRoots: [
        'assets/cinematic/scenes/library-grand-hall/delivery'
      ],
      sceneKind: 'interactive-artifact-scene',
      manifest: 'assets/cinematic/scenes/library-grand-hall/focus-manifest.json',
      bookMedia: [
        { path: 'src/assets/images/art/retro-studio-720.webp', width: 720, height: 540 },
        { path: 'src/assets/images/art/retro-studio-1448.webp', width: 1448, height: 1086 },
        { path: 'src/assets/images/lifestyle/retro-morning-720.webp', width: 720, height: 540 },
        { path: 'src/assets/images/lifestyle/retro-morning-1448.webp', width: 1448, height: 1086 },
        { path: 'src/assets/images/travel/retro-coast-train-720.webp', width: 720, height: 540 },
        { path: 'src/assets/images/travel/retro-coast-train-1448.webp', width: 1448, height: 1086 }
      ],
      artifactRoutes: [
        {
          id: 'wisteria-field-notes',
          pages: 4,
          html: 'dist/collection/wisteria-field-notes/index.html'
        },
        {
          id: 'atlas-of-tides',
          pages: 4,
          html: 'dist/collection/atlas-of-tides/index.html'
        },
        {
          id: 'collected-glimmers',
          pages: 2,
          html: 'dist/collection/collected-glimmers/index.html'
        }
      ],
      deliveryStatus: 'production',
      performanceBypass: null
    },
    {
      id: 'factory',
      label: 'coffee factory interior',
      html: 'dist/factory/index.html',
      mediaRoots: [
        'assets/cinematic/scenes/coffee-factory-interior/delivery'
      ],
      sceneKind: 'static-artwork',
      deliveryStatus: 'production',
      performanceBypass: null
    }
  ]
};
