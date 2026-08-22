export interface LayeredScenePlane {
  element: HTMLElement;
  owner: string;
  z: number;
  pointerX: number;
  pointerY: number;
  spatialX: number;
  spatialY: number;
  minX?: number;
  maxX?: number;
  hotspotAssociation: string[];
}

export interface PrototypeLayeredSceneController {
  recalculate: () => void;
  setSpatialFocus: (focus: { x: number; y: number } | null) => void;
  setSuspended: (suspended: boolean, immediate?: boolean) => void;
  reset: (immediate?: boolean) => void;
  destroy: () => void;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function createPrototypeLayeredSceneController(options: {
  root: HTMLElement;
  viewport: HTMLElement;
  world: HTMLElement;
  planes: LayeredScenePlane[];
  neutralFocalRatio?: number;
  signal: AbortSignal;
}): PrototypeLayeredSceneController {
  const { root, viewport, world, planes, signal } = options;
  const neutral = options.neutralFocalRatio ?? 0.53;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let target = { x: 0, y: 0 };
  let current = { x: 0, y: 0 };
  let spatial = { x: 0, y: 0 };
  let suspended = true;
  let overflow = false;
  let exploredRatio = neutral;
  let initialized = false;
  let frame = 0;

  const apply = () => {
    const width = world.clientWidth || 1;
    const height = world.clientHeight || 1;
    for (const plane of planes) {
      const rawX = width * ((current.x * plane.pointerX + spatial.x * plane.spatialX) / 100);
      const minX = width * ((plane.minX ?? -Infinity) / 100);
      const maxX = width * ((plane.maxX ?? Infinity) / 100);
      const x = clamp(rawX, minX, maxX);
      const y = height * ((current.y * plane.pointerY + spatial.y * plane.spatialY) / 100);
      plane.element.style.setProperty('--plane-x', `${x.toFixed(2)}px`);
      plane.element.style.setProperty('--plane-y', `${y.toFixed(2)}px`);
    }
  };

  const animate = () => {
    frame = requestAnimationFrame(animate);
    const ease = reducedMotion.matches ? 1 : 0.085;
    current.x += (target.x - current.x) * ease;
    current.y += (target.y - current.y) * ease;
    apply();
  };

  const syncScrollFocus = () => {
    if (!overflow) return;
    exploredRatio = (viewport.scrollLeft + viewport.clientWidth / 2) / viewport.scrollWidth;
    target.x = clamp((neutral - exploredRatio) * 3.2, -1, 1);
    target.y = 0;
  };

  const recalculate = () => {
    const previousOverflow = overflow;
    // Measure registered layout geometry, not transformed paint overflow from
    // the 1.035× safety camera. Otherwise overscan falsely enables scrolling.
    overflow = world.offsetWidth - viewport.clientWidth > 1;
    root.toggleAttribute('data-overflow', overflow);
    if (overflow) {
      const max = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      const desired = clamp(exploredRatio * viewport.scrollWidth - viewport.clientWidth / 2, 0, max);
      viewport.scrollLeft = desired;
      syncScrollFocus();
    } else {
      if (previousOverflow) target = { x: 0, y: 0 };
      exploredRatio = clamp(exploredRatio, 0, 1);
    }
    if (!initialized) {
      initialized = true;
      exploredRatio = neutral;
      if (overflow) viewport.scrollLeft = clamp(neutral * viewport.scrollWidth - viewport.clientWidth / 2, 0, viewport.scrollWidth);
    }
  };

  const onKey = (event: KeyboardEvent) => {
    if (!overflow) return;
    const amount = Math.max(120, viewport.clientWidth * 0.22);
    if (event.key === 'ArrowLeft') viewport.scrollBy({ left: -amount, behavior: 'smooth' });
    else if (event.key === 'ArrowRight') viewport.scrollBy({ left: amount, behavior: 'smooth' });
    else if (event.key === 'Home') viewport.scrollTo({ left: 0, behavior: 'smooth' });
    else if (event.key === 'End') viewport.scrollTo({ left: viewport.scrollWidth, behavior: 'smooth' });
    else return;
    event.preventDefault();
  };

  viewport.addEventListener('scroll', syncScrollFocus, { signal, passive: true });
  viewport.addEventListener('keydown', onKey, { signal });
  const observer = new ResizeObserver(recalculate);
  observer.observe(viewport);
  observer.observe(world);
  signal.addEventListener('abort', () => observer.disconnect(), { once: true });
  frame = requestAnimationFrame(animate);
  recalculate();

  return {
    recalculate,
    setSpatialFocus(focus) {
      spatial = focus ?? { x: 0, y: 0 };
      if (reducedMotion.matches || suspended) spatial = { x: 0, y: 0 };
      apply();
    },
    setSuspended(next, immediate = false) {
      suspended = next;
      if (next) {
        spatial = { x: 0, y: 0 };
        if (!overflow) target = { x: 0, y: 0 };
        if (immediate) current = { ...target };
      }
      apply();
    },
    reset(immediate = false) {
      target = { x: 0, y: 0 };
      spatial = { x: 0, y: 0 };
      if (immediate) current = { x: 0, y: 0 };
      apply();
    },
    destroy() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      for (const plane of planes) {
        plane.element.style.removeProperty('--plane-x');
        plane.element.style.removeProperty('--plane-y');
      }
    }
  };
}
