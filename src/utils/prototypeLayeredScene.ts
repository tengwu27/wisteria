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
  neutralFocalRatioX?: number;
  neutralFocalRatioY?: number;
  signal: AbortSignal;
}): PrototypeLayeredSceneController {
  const { root, viewport, world, planes, signal } = options;
  const neutral = {
    x: options.neutralFocalRatioX ?? 0.53,
    y: options.neutralFocalRatioY ?? 0.5
  };
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let target = { x: 0, y: 0 };
  let current = { x: 0, y: 0 };
  let spatial = { x: 0, y: 0 };
  let suspended = true;
  let overflow = { x: false, y: false };
  let exploredRatio = { ...neutral };
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
    if (overflow.x) {
      exploredRatio.x =
        (viewport.scrollLeft + viewport.clientWidth / 2) /
        viewport.scrollWidth;
      target.x = clamp((neutral.x - exploredRatio.x) * 3.2, -1, 1);
    } else {
      target.x = 0;
    }

    if (overflow.y) {
      exploredRatio.y =
        (viewport.scrollTop + viewport.clientHeight / 2) /
        viewport.scrollHeight;
      target.y = clamp((neutral.y - exploredRatio.y) * 3.2, -1, 1);
    } else {
      target.y = 0;
    }
  };

  const recalculate = () => {
    const previousOverflow = { ...overflow };
    // Measure registered layout geometry, not transformed paint overflow from
    // the camera safety overscan. Otherwise paint overflow falsely enables scrolling.
    overflow = {
      x: world.offsetWidth - viewport.clientWidth > 1,
      y: world.offsetHeight - viewport.clientHeight > 1
    };
    root.toggleAttribute('data-overflow', overflow.x || overflow.y);
    root.toggleAttribute('data-overflow-x', overflow.x);
    root.toggleAttribute('data-overflow-y', overflow.y);

    if (!initialized) {
      initialized = true;
      exploredRatio = { ...neutral };
    } else {
      if (previousOverflow.x && !overflow.x) target.x = 0;
      if (previousOverflow.y && !overflow.y) target.y = 0;
      exploredRatio.x = clamp(exploredRatio.x, 0, 1);
      exploredRatio.y = clamp(exploredRatio.y, 0, 1);
    }

    const maxX = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const maxY = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    viewport.scrollLeft = overflow.x
      ? clamp(
          exploredRatio.x * viewport.scrollWidth - viewport.clientWidth / 2,
          0,
          maxX
        )
      : 0;
    viewport.scrollTop = overflow.y
      ? clamp(
          exploredRatio.y * viewport.scrollHeight - viewport.clientHeight / 2,
          0,
          maxY
        )
      : 0;
    syncScrollFocus();
  };

  const onKey = (event: KeyboardEvent) => {
    if (!overflow.x && !overflow.y) return;
    const amountX = Math.max(120, viewport.clientWidth * 0.22);
    const amountY = Math.max(90, viewport.clientHeight * 0.18);
    if (event.key === 'ArrowLeft') viewport.scrollBy({ left: -amountX, behavior: 'smooth' });
    else if (event.key === 'ArrowRight') viewport.scrollBy({ left: amountX, behavior: 'smooth' });
    else if (event.key === 'ArrowUp') viewport.scrollBy({ top: -amountY, behavior: 'smooth' });
    else if (event.key === 'ArrowDown') viewport.scrollBy({ top: amountY, behavior: 'smooth' });
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
        if (!overflow.x) target.x = 0;
        if (!overflow.y) target.y = 0;
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
