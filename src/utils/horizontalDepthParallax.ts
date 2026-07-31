interface HorizontalDepthPlane {
  property: string;
  maximumPercent: number;
}

interface HorizontalDepthParallaxOptions {
  root: HTMLElement;
  viewport: HTMLElement;
  world: HTMLElement;
  signal: AbortSignal;
  planes: HorizontalDepthPlane[];
  neutralCenterRatio?: number;
  isInteractive?: () => boolean;
}

export interface HorizontalDepthParallaxController {
  recalculate: () => void;
  reset: (immediate?: boolean) => void;
  setSuspended: (suspended: boolean, immediate?: boolean) => void;
  destroy: () => void;
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export function createHorizontalDepthParallax({
  root,
  viewport,
  world,
  signal,
  planes,
  neutralCenterRatio = 0.5,
  isInteractive = () => true
}: HorizontalDepthParallaxOptions): HorizontalDepthParallaxController {
  const finePointer = window.matchMedia(
    '(hover: hover) and (pointer: fine)'
  );
  const reduceMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  );

  let frame = 0;
  let resizeFrame = 0;
  let currentFocus = 0;
  let targetFocus = 0;
  let previousTime = 0;
  let suspended = true;
  let destroyed = false;

  const hasOverflow = () =>
    viewport.scrollWidth - viewport.clientWidth > 1;

  const applyFocus = (focus: number) => {
    const width = world.offsetWidth || 1672;
    for (const plane of planes) {
      const pixels = width * (plane.maximumPercent / 100) * focus;
      root.style.setProperty(plane.property, `${pixels.toFixed(3)}px`);
    }
  };

  const schedule = () => {
    if (!frame && !destroyed) {
      frame = window.requestAnimationFrame(animate);
    }
  };

  const animate = (time: number) => {
    frame = 0;
    const elapsed = previousTime
      ? Math.min(0.05, (time - previousTime) / 1000)
      : 1 / 60;
    previousTime = time;
    const easing = 1 - Math.exp(-elapsed * 8);
    const nextTarget =
      suspended ||
      reduceMotion.matches ||
      document.hidden ||
      !isInteractive()
        ? 0
        : targetFocus;

    currentFocus += (nextTarget - currentFocus) * easing;
    if (Math.abs(nextTarget - currentFocus) < 0.0005) {
      currentFocus = nextTarget;
    }
    applyFocus(currentFocus);

    if (currentFocus !== nextTarget) {
      schedule();
    } else {
      previousTime = 0;
    }
  };

  const focusFromScroll = () => {
    if (!hasOverflow()) return 0;
    const worldWidth = viewport.scrollWidth;
    const halfViewport = viewport.clientWidth / 2;
    const minimumCenter = halfViewport / worldWidth;
    const maximumCenter = 1 - minimumCenter;
    const center = clamp(
      (viewport.scrollLeft + halfViewport) / worldWidth,
      minimumCenter,
      maximumCenter
    );
    const neutral = clamp(
      neutralCenterRatio,
      minimumCenter,
      maximumCenter
    );

    if (center < neutral) {
      return clamp(
        (neutral - center) / Math.max(0.0001, neutral - minimumCenter),
        0,
        1
      );
    }
    return -clamp(
      (center - neutral) / Math.max(0.0001, maximumCenter - neutral),
      0,
      1
    );
  };

  const updateFromLayout = () => {
    if (destroyed || suspended || reduceMotion.matches) {
      targetFocus = 0;
      schedule();
      return;
    }
    if (hasOverflow()) {
      targetFocus = focusFromScroll();
      schedule();
    }
  };

  const reset = (immediate = false) => {
    targetFocus = 0;
    if (immediate) {
      window.cancelAnimationFrame(frame);
      frame = 0;
      previousTime = 0;
      currentFocus = 0;
      applyFocus(0);
      return;
    }
    schedule();
  };

  const setSuspended = (next: boolean, immediate = false) => {
    suspended = next;
    if (next) {
      reset(immediate);
    } else {
      updateFromLayout();
    }
  };

  const recalculate = () => {
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(() => {
      updateFromLayout();
    });
  };

  viewport.addEventListener('pointermove', (event) => {
    if (
      suspended ||
      hasOverflow() ||
      !finePointer.matches ||
      reduceMotion.matches ||
      !isInteractive() ||
      event.pointerType === 'touch'
    ) return;
    const bounds = viewport.getBoundingClientRect();
    const normalized = clamp(
      (event.clientX - bounds.left) / Math.max(1, bounds.width),
      0,
      1
    );
    // Pointer left reveals more of the artwork's left edge by moving plates
    // right. Every depth plane follows the same signed focus value.
    targetFocus = clamp((0.5 - normalized) * 2, -1, 1);
    schedule();
  }, { signal });

  viewport.addEventListener('pointerleave', () => {
    if (!hasOverflow()) reset();
  }, { signal });

  viewport.addEventListener('scroll', () => {
    if (!suspended && hasOverflow()) {
      targetFocus = focusFromScroll();
      schedule();
    }
  }, { passive: true, signal });

  window.addEventListener('resize', recalculate, {
    passive: true,
    signal
  });
  window.addEventListener('orientationchange', recalculate, {
    passive: true,
    signal
  });

  finePointer.addEventListener('change', () => {
    reset(true);
    recalculate();
  }, { signal });

  reduceMotion.addEventListener('change', () => {
    reset(true);
    recalculate();
  }, { signal });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) reset(true);
    else recalculate();
  }, { signal });

  const observer =
    typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(recalculate);
  observer?.observe(viewport);
  observer?.observe(world);

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    window.cancelAnimationFrame(frame);
    window.cancelAnimationFrame(resizeFrame);
    observer?.disconnect();
    applyFocus(0);
  };

  signal.addEventListener('abort', destroy, { once: true });
  applyFocus(0);

  return { recalculate, reset, setSuspended, destroy };
}
