/**
 * Data-driven 2D world scene system.
 *
 * Every position is expressed either in the canonical world space
 * (1672×941, the master panorama) or as unit fractions of a containing
 * box, so the renderer can convert responsively without per-object CSS.
 */

export const WORLD_WIDTH = 2048;
export const WORLD_HEIGHT = 1152;

/** Rectangle in canonical world pixels. */
export type WorldRect = { x: number; y: number; w: number; h: number };

/** Point in an asset package's canonical authoring canvas. */
export type AssetPoint = { x: number; y: number };

/** Rectangle in an asset package's canonical authoring canvas. */
export type AssetRect = { x: number; y: number; w: number; h: number };

/**
 * Rectangle as fractions of a containing box (object box or scene canvas).
 * Values may fall outside 0–1 for parts that overhang their box.
 * `h` may be omitted when the layer derives height from its aspect ratio.
 */
export type UnitRect = { x: number; y: number; w: number; h?: number };

export type EnvironmentId = 'day' | 'night';

/** Isometric screen-space direction an asset or placed object faces. */
export type WorldFacing = 'bottom-left' | 'bottom-right';

/**
 * When a behavior runs:
 * - `idle`   — always (still disabled under prefers-reduced-motion)
 * - `active` — hover / keyboard focus / touch selection of the hotspot
 * - `night` / `day` — while that environment is applied
 */
export type BehaviorTrigger = 'idle' | 'active' | 'night' | 'day';

export type Behavior =
  | { name: 'rotate'; trigger: BehaviorTrigger; duration: number; origin: string }
  | {
      /** Generic from→to transform oscillation (covers sway, rock, flap, drift). */
      name: 'sway';
      trigger: BehaviorTrigger;
      duration: number;
      from: string;
      to: string;
      easing?: string;
      origin?: string;
    }
  | { name: 'bob'; trigger: BehaviorTrigger; duration: number; amplitude: string }
  | {
      /** Door leaf opening around its illustrated hinge. */
      name: 'hinge-open';
      trigger: 'active';
      angle: number;
      hinge: string;
      perspective?: number;
      shift?: string;
    }
  | {
      /** Fade-in reveal for interiors behind hinged doors. */
      name: 'reveal';
      trigger: 'active';
    }
  | {
      /** Fade-out counterpart used when an authored open-state sprite replaces a closed state. */
      name: 'conceal';
      trigger: 'active';
    }
  | { name: 'pulse'; trigger: BehaviorTrigger; duration: number }
  | { name: 'blink'; trigger: BehaviorTrigger; duration: number; delay?: number; min?: number; max?: number };

type LayerCommon = {
  id: string;
  /** Fractions of the containing box (object box, or scene canvas for atmosphere). */
  frame: UnitRect;
  /** Stacking order inside the object; scene bands are defined in the renderer CSS. */
  z?: number;
  /** Restrict the layer to one environment; it cross-fades on toggle. */
  env?: EnvironmentId;
  behavior?: Behavior;
};

/** Transparent raster part (door leaf, rotor, flag …). */
export type ImageLayer = LayerCommon & {
  kind: 'image';
  src: string;
  width: number;
  height: number;
  /** Native direction of the transparent artwork; the renderer mirrors it when placement differs. */
  assetFacing?: WorldFacing;
  /** Optional socket/state metadata used by the asset lab and validators. */
  socket?: string;
  stateGroup?: string;
  state?: string;
};

/** One CSS-drawn shape inside a `shapes` layer (sail cloth, masts …). */
export type ShapeSpec = {
  left?: string;
  right?: string;
  width: string;
  height?: string;
  clip?: string;
  background?: string;
  borderLeft?: string;
  origin?: string;
  behavior?: Behavior;
};

export type ShapeGroupLayer = LayerCommon & { kind: 'shapes'; shapes: ShapeSpec[] };

/** Particle emitter: chimney/exhaust puffs, steam wisps, water ripple rings. */
export type EmitterLayer = LayerCommon & {
  kind: 'emitter';
  variant: 'puff' | 'wisp' | 'ring';
  trigger: BehaviorTrigger;
  duration: number;
  stagger?: number;
  /** puff: end-of-life translate/scale in % of the particle box. */
  drift?: { x: string; y: string; scale?: number; startY?: string; startScale?: number; peak?: number };
  /** puff: which edge of the layer box particles are pinned to. */
  anchor?: 'left' | 'right';
  /** puff: particle width as % of the layer box. */
  size?: string;
  count?: number;
  /** wisp: individual wisp positions. */
  items?: { left: string; height: string }[];
};

/** Emissive light: window glows, lamps, headlights, stars, beacons. */
export type GlowLayer = LayerCommon & {
  kind: 'glow';
  color: string;
  soft?: string;
  shape?: 'circle' | 'window' | 'arch';
  /** Halo blur/spread lengths, e.g. `'14px 5px'`. */
  halo?: string;
  /** Steady-on while the night environment is applied. */
  nightOn?: boolean;
};

/** Transparent contact shadow that reacts to the environment. */
export type ShadowLayer = LayerCommon & { kind: 'shadow'; strength?: number };

/** Cached crop of the master panorama used to animate a baked-in object. */
export type CropLayer = LayerCommon & {
  kind: 'crop';
  bgSize: string;
  bgPos: string;
  radius?: string;
  halo?: string;
};

export type WorldLayerSpec =
  | ImageLayer
  | ShapeGroupLayer
  | EmitterLayer
  | GlowLayer
  | ShadowLayer
  | CropLayer;

/** Reusable asset package: an object type that can be placed in any scene. */
export type WorldObjectManifest = {
  id: string;
  /** Canonical design size of the package box in world pixels. */
  size: { w: number; h: number };
  /** Canonical source canvas shared by every authored package layer. */
  authoringCanvas?: { w: number; h: number };
  /** Native isometric direction; new modular packages flip at the object root. */
  nativeFacing?: WorldFacing;
  /** Exact attachment contracts for stateful or moving subcomponents. */
  sockets?: Record<string, {
    kind: string;
    placementMode?: 'behind-aperture' | 'foreground-mounted' | 'sandwiched';
    stateGroup?: string;
    nativeFacing?: WorldFacing;
    opens?: 'inward' | 'outward';
    hingeSideNative?: 'left' | 'right';
    hingeSideIntegrated?: 'left' | 'right';
    pivot?: AssetPoint;
    hingeLine?: { top: AssetPoint; bottom: AssetPoint };
    openProjection?: {
      freeTop: AssetPoint;
      hingeTop: AssetPoint;
      hingeBottom: AssetPoint;
      freeBottom: AssetPoint;
    };
    aperture?: AssetRect;
    motionEnvelope?: AssetRect;
    fitMask?: string;
    animation?: 'runtime-rotation' | 'runtime-sway' | 'runtime-hands';
    layerOrder: string[];
  }>;
  /** Interactive hit area as fractions of the box; defaults to the full box. */
  hitArea?: UnitRect;
  layers: WorldLayerSpec[];
};

export type WorldEnvironment = {
  id: EnvironmentId;
  /** Announced on the toggle when switching *to* this environment. */
  label: string;
  icon: string;
  /** CSS custom properties applied at `[data-env="<id>"]`. */
  tokens: Record<string, string>;
};

export type WorldDestination = 'lifestyle' | 'art' | 'travel';

export type WorldInstanceContent = {
  label: string;
  eyebrow: string;
  href: `/${WorldDestination}`;
  preview: string;
  prompt: string;
  icon: string;
  tone: WorldDestination;
};

/** One placed object: manifest id + world-space placement + its content. */
export type WorldSceneInstance = {
  id: string;
  object: string;
  at: WorldRect;
  /** Direction required by this placement in the painted world. */
  facing?: WorldFacing;
  content: WorldInstanceContent;
  labelAnchor?: { left: string; bottom: string };
  /** Initial centering target for the mobile panorama. */
  mobileFocus?: boolean;
};

export type WorldSceneData = {
  title: string;
  viewportLabel: string;
  canvas: { w: number; h: number };
  background: { src: string; alt: string };
  /** Scene-level layers (stars, moon, distant lights); frames are canvas fractions. */
  atmosphere: WorldLayerSpec[];
  environments: WorldEnvironment[];
  toneColors: Record<WorldDestination, string>;
  instances: WorldSceneInstance[];
};

const pct = (value: number) => `${Number((value * 100).toFixed(4))}%`;

/** Convert a canonical world rect to percentage offsets of the scene canvas. */
export function worldRectToPercent(rect: WorldRect, canvas: { w: number; h: number }) {
  return {
    left: pct(rect.x / canvas.w),
    top: pct(rect.y / canvas.h),
    width: pct(rect.w / canvas.w),
    height: pct(rect.h / canvas.h)
  };
}

/** Convert a unit-fraction frame to percentage offsets of its box. */
export function unitRectToPercent(frame: UnitRect) {
  return {
    left: pct(frame.x),
    top: pct(frame.y),
    width: pct(frame.w),
    height: frame.h === undefined ? undefined : pct(frame.h)
  };
}
