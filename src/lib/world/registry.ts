import houseShellV2 from '@/assets/images/world/house/v2/house-shell-v2.png?url';
import houseDoorInteriorV2 from '@/assets/images/world/house/v2/main-door-interior-v2.png?url';
import houseDoorClosedV2 from '@/assets/images/world/house/v2/main-door-closed-v2.png?url';
import houseDoorOpenV2 from '@/assets/images/world/house/v2/main-door-open-v2.png?url';
import houseDoorForegroundV2 from '@/assets/images/world/house/v2/main-door-foreground-v2.png?url';
import houseDoorFitMaskV2 from '@/assets/images/world/house/v2/main-door-fit-mask-v2.png?url';
import houseWindowBackplatesV2 from '@/assets/images/world/house/v2/window-backplates-v2.png?url';
import houseWindowsClosedV2 from '@/assets/images/world/house/v2/windows-closed-v2.png?url';
import houseWindowsOpenV2 from '@/assets/images/world/house/v2/windows-open-v2.png?url';
import houseTurbineMastV2 from '@/assets/images/world/house/v2/turbine-mast-v2.png?url';
import houseTurbineRotorV2 from '@/assets/images/world/house/v2/turbine-rotor-v2.png?url';
import houseTurbineHubV2 from '@/assets/images/world/house/v2/turbine-hub-v2.png?url';
import houseRoofFlagV2 from '@/assets/images/world/house/v2/roof-flag-v2.png?url';
import houseLampOffV2 from '@/assets/images/world/house/v2/wall-lamp-off-v2.png?url';
import houseLampOnV2 from '@/assets/images/world/house/v2/wall-lamp-on-v2.png?url';
import houseClockBaseV2 from '@/assets/images/world/house/v2/clock-base-v2.png?url';
import turbineRotor from '@/assets/images/world/garage/v1/exhaust-fan.webp?url';
import planePropeller from '@/assets/images/world/airplane/v1/propeller.webp?url';
import type { WorldObjectManifest } from './types';

const WARM_GLOW = 'rgba(255, 218, 138, 0.75)';
const WARM_GLOW_SOFT = 'rgba(255, 196, 86, 0.5)';

/**
 * Reusable asset packages. Layer frames are fractions of each package box;
 * the values mirror the hand-tuned extraction alignment of the v3 panorama.
 */
export const worldRegistry: Record<string, WorldObjectManifest> = {
  house: {
    id: 'house',
    size: { w: 780, h: 975 },
    authoringCanvas: { w: 780, h: 975 },
    nativeFacing: 'bottom-right',
    sockets: {
      mainDoor: {
        kind: 'hinged-door',
        placementMode: 'behind-aperture',
        stateGroup: 'main-door',
        opens: 'inward',
        hingeSideNative: 'right',
        hingeSideIntegrated: 'left',
        pivot: { x: 346, y: 766 },
        hingeLine: {
          top: { x: 346, y: 704 },
          bottom: { x: 346, y: 828 }
        },
        openProjection: {
          freeTop: { x: 296, y: 688 },
          hingeTop: { x: 346, y: 665 },
          hingeBottom: { x: 346, y: 828 },
          freeBottom: { x: 296, y: 792 }
        },
        aperture: { x: 296, y: 665, w: 50, h: 163 },
        motionEnvelope: { x: 294, y: 662, w: 56, h: 170 },
        fitMask: houseDoorFitMaskV2,
        layerOrder: ['door-interior', 'door-closed|door-open', 'house-shell', 'door-foreground']
      },
      windows: {
        kind: 'stateful-aperture-set',
        placementMode: 'behind-aperture',
        stateGroup: 'windows',
        nativeFacing: 'bottom-right',
        layerOrder: ['window-backplates', 'windows-closed|windows-open', 'house-shell']
      },
      turbine: {
        kind: 'rigid-rotor-assembly',
        placementMode: 'sandwiched',
        pivot: { x: 350, y: 92 },
        animation: 'runtime-rotation',
        layerOrder: ['turbine-mast', 'turbine-rotor', 'turbine-hub']
      },
      roofFlag: {
        kind: 'cloth-sway',
        placementMode: 'foreground-mounted',
        pivot: { x: 536, y: 105 },
        animation: 'runtime-sway',
        layerOrder: ['house-shell', 'roof-flag']
      },
      wallLamp: {
        kind: 'stateful-lamp',
        placementMode: 'foreground-mounted',
        stateGroup: 'wall-lamp',
        nativeFacing: 'bottom-right',
        pivot: { x: 475, y: 608 },
        layerOrder: ['house-shell', 'wall-lamp-off|wall-lamp-on']
      },
      wallClock: {
        kind: 'runtime-clock',
        placementMode: 'foreground-mounted',
        pivot: { x: 403, y: 469 },
        animation: 'runtime-hands',
        layerOrder: ['house-shell', 'clock-base', 'clock-minute-hand|clock-hour-hand']
      }
    },
    layers: [
      {
        id: 'window-backplates',
        kind: 'image',
        src: houseWindowBackplatesV2,
        width: 780,
        height: 975,
        socket: 'windows',
        z: 0,
        frame: { x: 0, y: 0, w: 1, h: 1 }
      },
      {
        id: 'windows-closed',
        kind: 'image',
        src: houseWindowsClosedV2,
        width: 780,
        height: 975,
        socket: 'windows',
        stateGroup: 'windows',
        state: 'closed',
        z: 1,
        frame: { x: 0, y: 0, w: 1, h: 1 },
        behavior: { name: 'conceal', trigger: 'active' }
      },
      {
        id: 'windows-open',
        kind: 'image',
        src: houseWindowsOpenV2,
        width: 780,
        height: 975,
        socket: 'windows',
        stateGroup: 'windows',
        state: 'open',
        z: 1,
        frame: { x: 0, y: 0, w: 1, h: 1 },
        behavior: { name: 'reveal', trigger: 'active' }
      },
      {
        id: 'door-interior',
        kind: 'image',
        src: houseDoorInteriorV2,
        width: 780,
        height: 975,
        socket: 'mainDoor',
        z: 0,
        frame: { x: 0, y: 0, w: 1, h: 1 }
      },
      {
        id: 'house-shell',
        kind: 'image',
        src: houseShellV2,
        width: 780,
        height: 975,
        z: 2,
        frame: { x: 0, y: 0, w: 1, h: 1 }
      },
      {
        id: 'door-closed',
        kind: 'image',
        src: houseDoorClosedV2,
        width: 780,
        height: 975,
        socket: 'mainDoor',
        stateGroup: 'main-door',
        state: 'closed',
        z: 1,
        frame: { x: 0, y: 0, w: 1, h: 1 },
        behavior: { name: 'conceal', trigger: 'active' }
      },
      {
        id: 'door-open',
        kind: 'image',
        src: houseDoorOpenV2,
        width: 780,
        height: 975,
        socket: 'mainDoor',
        stateGroup: 'main-door',
        state: 'open',
        z: 1,
        frame: { x: 0, y: 0, w: 1, h: 1 },
        behavior: { name: 'reveal', trigger: 'active' }
      },
      {
        id: 'door-foreground',
        kind: 'image',
        src: houseDoorForegroundV2,
        width: 780,
        height: 975,
        socket: 'mainDoor',
        z: 3,
        frame: { x: 0, y: 0, w: 1, h: 1 }
      },
      {
        id: 'window-porthole',
        kind: 'glow',
        env: 'night',
        z: 4,
        shape: 'circle',
        color: WARM_GLOW,
        soft: WARM_GLOW_SOFT,
        frame: { x: 0.33, y: 0.363, w: 0.105, h: 0.083 }
      },
      {
        id: 'window-arch',
        kind: 'glow',
        env: 'night',
        z: 4,
        shape: 'arch',
        color: WARM_GLOW,
        soft: WARM_GLOW_SOFT,
        frame: { x: 0.357, y: 0.49, w: 0.096, h: 0.07 }
      },
      {
        id: 'window-right-upper',
        kind: 'glow',
        env: 'night',
        z: 4,
        shape: 'window',
        color: WARM_GLOW,
        soft: WARM_GLOW_SOFT,
        frame: { x: 0.647, y: 0.437, w: 0.077, h: 0.064 }
      },
      {
        id: 'window-right-lower',
        kind: 'glow',
        env: 'night',
        z: 4,
        shape: 'window',
        color: WARM_GLOW,
        soft: WARM_GLOW_SOFT,
        frame: { x: 0.734, y: 0.766, w: 0.058, h: 0.058 }
      },
      {
        id: 'window-side',
        kind: 'glow',
        env: 'night',
        z: 4,
        shape: 'arch',
        color: WARM_GLOW,
        soft: WARM_GLOW_SOFT,
        frame: { x: 0.126, y: 0.732, w: 0.095, h: 0.11 }
      },
      {
        id: 'turbine-rotor',
        kind: 'image',
        src: houseTurbineRotorV2,
        width: 780,
        height: 975,
        socket: 'turbine',
        z: 6,
        frame: { x: 0, y: 0, w: 1, h: 1 },
        behavior: { name: 'rotate', trigger: 'idle', duration: 2600, origin: '44.87% 9.44%' }
      },
      {
        id: 'turbine-mast',
        kind: 'image',
        src: houseTurbineMastV2,
        width: 780,
        height: 975,
        socket: 'turbine',
        z: 5,
        frame: { x: 0, y: 0, w: 1, h: 1 }
      },
      {
        id: 'turbine-hub',
        kind: 'image',
        src: houseTurbineHubV2,
        width: 780,
        height: 975,
        socket: 'turbine',
        z: 7,
        frame: { x: 0, y: 0, w: 1, h: 1 }
      },
      {
        id: 'roof-flag',
        kind: 'image',
        src: houseRoofFlagV2,
        width: 780,
        height: 975,
        socket: 'roofFlag',
        z: 8,
        frame: { x: 0, y: 0, w: 1, h: 1 },
        behavior: {
          name: 'sway',
          trigger: 'idle',
          duration: 620,
          origin: '68.72% 10.77%',
          from: 'perspective(80px) rotateY(-9deg) skewY(-3deg) scaleX(0.92)',
          to: 'perspective(80px) rotateY(8deg) skewY(4deg) scaleX(1.03)'
        }
      },
      {
        id: 'wall-lamp-off',
        kind: 'image',
        src: houseLampOffV2,
        width: 780,
        height: 975,
        socket: 'wallLamp',
        env: 'day',
        z: 8,
        frame: { x: 0, y: 0, w: 1, h: 1 }
      },
      {
        id: 'wall-lamp-on',
        kind: 'image',
        src: houseLampOnV2,
        width: 780,
        height: 975,
        socket: 'wallLamp',
        env: 'night',
        z: 8,
        frame: { x: 0, y: 0, w: 1, h: 1 }
      },
      {
        id: 'clock-base',
        kind: 'image',
        src: houseClockBaseV2,
        width: 780,
        height: 975,
        socket: 'wallClock',
        z: 8,
        frame: { x: 0, y: 0, w: 1, h: 1 }
      },
      {
        id: 'clock-minute-hand',
        kind: 'shapes',
        z: 10,
        frame: { x: 0.512, y: 0.452, w: 0.01, h: 0.029 },
        behavior: { name: 'rotate', trigger: 'idle', duration: 60000, origin: '50% 100%' },
        shapes: [{ left: 'calc(50% - 1px)', width: '2px', height: '100%', background: '#20333b', origin: '50% 100%' }]
      },
      {
        id: 'clock-hour-hand',
        kind: 'shapes',
        z: 11,
        frame: { x: 0.513, y: 0.458, w: 0.008, h: 0.023 },
        behavior: { name: 'rotate', trigger: 'idle', duration: 720000, origin: '50% 100%' },
        shapes: [{ left: 'calc(50% - 1.5px)', width: '3px', height: '100%', background: '#20333b', origin: '50% 100%' }]
      },
      {
        id: 'chimney-smoke',
        kind: 'emitter',
        variant: 'puff',
        trigger: 'active',
        z: 9,
        frame: { x: 0.735, y: 0, w: 0.22, h: 0.18 },
        duration: 2200,
        stagger: 520,
        count: 3,
        anchor: 'left',
        size: '38%',
        drift: { x: '145%', y: '-180%', scale: 1.12, startY: '8%', startScale: 0.35, peak: 0.9 }
      }
    ]
  },

  cafe: {
    id: 'cafe',
    size: { w: 351.12, h: 366.99 },
    layers: [
      {
        id: 'window-front',
        kind: 'glow',
        env: 'night',
        z: 4,
        shape: 'window',
        color: WARM_GLOW,
        soft: WARM_GLOW_SOFT,
        frame: { x: 0.375, y: 0.55, w: 0.155, h: 0.23 }
      },
      {
        id: 'window-left',
        kind: 'glow',
        env: 'night',
        z: 4,
        shape: 'window',
        color: WARM_GLOW,
        soft: WARM_GLOW_SOFT,
        frame: { x: 0.04, y: 0.56, w: 0.09, h: 0.16 }
      },
      {
        id: 'gable-window',
        kind: 'glow',
        env: 'night',
        z: 4,
        shape: 'arch',
        color: WARM_GLOW,
        soft: WARM_GLOW_SOFT,
        frame: { x: 0.58, y: 0.163, w: 0.08, h: 0.108 }
      },
      {
        id: 'lantern-left',
        kind: 'glow',
        env: 'night',
        z: 4,
        shape: 'circle',
        color: 'rgba(255, 214, 110, 0.9)',
        soft: WARM_GLOW_SOFT,
        halo: '9px 4px',
        frame: { x: 0.295, y: 0.467, w: 0.057, h: 0.08 }
      },
      {
        id: 'lantern-right',
        kind: 'glow',
        env: 'night',
        z: 4,
        shape: 'circle',
        color: 'rgba(255, 214, 110, 0.9)',
        soft: WARM_GLOW_SOFT,
        halo: '9px 4px',
        frame: { x: 0.832, y: 0.51, w: 0.057, h: 0.08 }
      },
      {
        id: 'door-glass',
        kind: 'glow',
        env: 'night',
        z: 4,
        shape: 'arch',
        color: WARM_GLOW,
        soft: WARM_GLOW_SOFT,
        frame: { x: 0.582, y: 0.62, w: 0.12, h: 0.15 }
      },
      {
        id: 'cup-steam',
        kind: 'emitter',
        variant: 'wisp',
        trigger: 'active',
        z: 7,
        frame: { x: 0.69, y: 0.32, w: 0.17, h: 0.25 },
        duration: 1250,
        stagger: 150,
        items: [
          { left: '8%', height: '54%' },
          { left: '38%', height: '72%' },
          { left: '68%', height: '58%' }
        ]
      }
    ]
  },

  airplane: {
    id: 'airplane',
    size: { w: 267.52, h: 178.79 },
    layers: [
      {
        id: 'propeller',
        kind: 'image',
        src: planePropeller,
        width: 255,
        height: 240,
        z: 8,
        frame: { x: 0.66, y: 0.29, w: 0.27 },
        behavior: { name: 'rotate', trigger: 'idle', duration: 820, origin: '50% 50%' }
      },
      {
        id: 'navigation-light',
        kind: 'glow',
        z: 9,
        shape: 'circle',
        color: 'rgba(255, 106, 77, 0.8)',
        soft: 'rgba(255, 106, 77, 0.78)',
        nightOn: true,
        frame: { x: 0.065, y: 0.5, w: 0.026, h: 0.04 },
        behavior: { name: 'blink', trigger: 'idle', duration: 1250, min: 0.2, max: 1 }
      }
    ]
  },

  sailboat: {
    id: 'sailboat',
    size: { w: 367.84, h: 592.83 },
    layers: [
      {
        id: 'cabin-light',
        kind: 'glow',
        env: 'night',
        z: 4,
        shape: 'circle',
        color: WARM_GLOW,
        soft: WARM_GLOW_SOFT,
        frame: { x: 0.548, y: 0.812, w: 0.07, h: 0.044 }
      },
      {
        id: 'bow-ripple',
        kind: 'emitter',
        variant: 'ring',
        trigger: 'active',
        z: 5,
        frame: { x: 0.09, y: 0.86, w: 0.91, h: 0.09 },
        duration: 1100
      }
    ]
  },

  car: {
    id: 'car',
    size: { w: 334.4, h: 254.07 },
    layers: [
      {
        id: 'contact-shadow',
        kind: 'shadow',
        z: 3,
        strength: 0.16,
        frame: { x: 0.17, y: 0.85, w: 0.68, h: 0.13 }
      },
      {
        id: 'headlamp-left',
        kind: 'glow',
        z: 4,
        shape: 'circle',
        color: 'rgba(255, 235, 116, 0.2)',
        soft: 'rgba(255, 230, 84, 0.9)',
        nightOn: true,
        frame: { x: 0.59, y: 0.58, w: 0.07, h: 0.0921 },
        behavior: { name: 'pulse', trigger: 'active', duration: 720 }
      },
      {
        id: 'headlamp-right',
        kind: 'glow',
        z: 4,
        shape: 'circle',
        color: 'rgba(255, 235, 116, 0.2)',
        soft: 'rgba(255, 230, 84, 0.9)',
        nightOn: true,
        frame: { x: 0.78, y: 0.58, w: 0.07, h: 0.0921 },
        behavior: { name: 'pulse', trigger: 'active', duration: 720 }
      },
      {
        id: 'exhaust-smoke',
        kind: 'emitter',
        variant: 'puff',
        trigger: 'active',
        z: 8,
        frame: { x: -0.2, y: 0.44, w: 0.29, h: 0.2 },
        duration: 2400,
        stagger: 520,
        count: 3,
        anchor: 'right',
        size: '34%',
        drift: { x: '-175%', y: '-72%', scale: 1.06, startScale: 0.3, peak: 0.82 }
      },
    ]
  },

  hangar: {
    id: 'hangar',
    size: { w: 270, h: 250 },
    layers: [
      {
        id: 'hangar-interior',
        kind: 'glow',
        z: 4,
        shape: 'arch',
        color: 'rgba(255, 220, 145, 0.22)',
        soft: WARM_GLOW_SOFT,
        nightOn: true,
        frame: { x: 0.39, y: 0.48, w: 0.42, h: 0.29 },
        behavior: { name: 'pulse', trigger: 'active', duration: 1100 }
      }
    ]
  },

  garage: {
    id: 'garage',
    size: { w: 330, h: 320 },
    layers: [
      {
        id: 'garage-bay-light',
        kind: 'glow',
        z: 4,
        shape: 'arch',
        color: 'rgba(255, 218, 138, 0.24)',
        soft: WARM_GLOW_SOFT,
        nightOn: true,
        frame: { x: 0.45, y: 0.46, w: 0.36, h: 0.31 },
        behavior: { name: 'pulse', trigger: 'active', duration: 900 }
      },
      {
        id: 'exhaust-fan',
        kind: 'image',
        src: turbineRotor,
        width: 140,
        height: 140,
        z: 7,
        frame: { x: 0.43, y: 0.12, w: 0.18 },
        behavior: { name: 'rotate', trigger: 'active', duration: 760, origin: '52.1% 60%' }
      },
      {
        id: 'garage-smoke',
        kind: 'emitter',
        variant: 'puff',
        trigger: 'active',
        z: 8,
        frame: { x: 0.78, y: 0.03, w: 0.2, h: 0.2 },
        duration: 1900,
        stagger: 430,
        count: 3,
        anchor: 'left',
        size: '34%',
        drift: { x: '120%', y: '-155%', scale: 1.05, startScale: 0.3, peak: 0.82 }
      }
    ]
  },

  lighthouse: {
    id: 'lighthouse',
    size: { w: 215, h: 430 },
    layers: [
      {
        id: 'beacon-core',
        kind: 'glow',
        z: 8,
        shape: 'circle',
        color: '#fff1aa',
        soft: 'rgba(255, 220, 112, 0.84)',
        nightOn: true,
        frame: { x: 0.35, y: 0.1, w: 0.24, h: 0.12 },
        behavior: { name: 'pulse', trigger: 'night', duration: 1900 }
      },
      {
        id: 'beacon-sweep',
        kind: 'shapes',
        env: 'night',
        z: 7,
        frame: { x: -0.25, y: 0.08, w: 1.25, h: 0.22 },
        behavior: { name: 'rotate', trigger: 'night', duration: 5200, origin: '48% 50%' },
        shapes: [
          {
            left: '42%',
            width: '58%',
            height: '42%',
            clip: 'polygon(0 35%, 100% 0, 100% 100%, 0 65%)',
            background: 'linear-gradient(90deg, rgba(255,241,170,.42), rgba(255,241,170,0))',
            origin: '0 50%'
          }
        ]
      }
    ]
  },

  'harbor-office': {
    id: 'harbor-office',
    size: { w: 315, h: 310 },
    layers: [
      {
        id: 'office-window-light',
        kind: 'glow',
        env: 'night',
        z: 4,
        shape: 'window',
        color: WARM_GLOW,
        soft: WARM_GLOW_SOFT,
        frame: { x: 0.58, y: 0.42, w: 0.13, h: 0.13 }
      },
      {
        id: 'dock-ripple',
        kind: 'emitter',
        variant: 'ring',
        trigger: 'idle',
        z: 6,
        frame: { x: 0.05, y: 0.9, w: 0.75, h: 0.08 },
        duration: 1700
      }
    ]
  }
};
