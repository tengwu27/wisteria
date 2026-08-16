const KiB = 1024;
const MiB = 1024 * KiB;

// For temporary visual testing, set only the affected route to `prototype` and
// replace its null bypass with { reason: '...', expires: 'YYYY-MM-DD' }.
// The normal production build rejects that state until it is removed.
export const cinematicDeliveryConfig = {
  schemaVersion: 1,
  globalPerformanceBypass: null,
  budgets: {
    initialRouteCodeBytes: 350 * KiB,
    immersiveFontBytes: 32 * KiB,
    deliveryImageBytes: 1 * MiB,
    transitionVideoBytes: 7 * MiB
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
    }
  ]
};
