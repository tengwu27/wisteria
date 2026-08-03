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
      label: 'village',
      html: 'dist/index.html',
      mediaRoots: ['public/media/village'],
      deliveryStatus: 'production',
      performanceBypass: null
    },
    {
      id: 'living-room',
      label: 'living room',
      html: 'dist/lifestyle/index.html',
      mediaRoots: ['public/media/living-room'],
      deliveryStatus: 'production',
      performanceBypass: null
    },
    {
      id: 'cafe-gallery',
      label: 'cafe gallery',
      html: 'dist/art/index.html',
      mediaRoots: ['public/media/cafe-gallery'],
      deliveryStatus: 'production',
      performanceBypass: null
    },
    {
      id: 'car-interior',
      label: 'car interior',
      html: 'dist/travel/index.html',
      mediaRoots: ['public/media/car-interior'],
      deliveryStatus: 'production',
      performanceBypass: null
    },
    {
      id: 'garage',
      label: 'garage',
      html: 'dist/garage/index.html',
      mediaRoots: ['public/media/garage-workshop'],
      deliveryStatus: 'production',
      performanceBypass: null
    }
  ]
};
