interface AdaptiveCinematicViewportOptions {
  root: HTMLElement;
  viewport: HTMLElement;
  world: HTMLElement;
  signal: AbortSignal;
  initialCenterRatio?: number;
  isInteractive?: () => boolean;
}

export interface AdaptiveCinematicViewportController {
  recalculate: (preservePosition?: boolean) => void;
  stopMotion: (immediate?: boolean) => void;
  destroy: () => void;
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export function createAdaptiveCinematicViewport({
  root,
  viewport,
  world,
  signal,
  initialCenterRatio = 0.5,
  isInteractive = () => true
}: AdaptiveCinematicViewportOptions): AdaptiveCinematicViewportController {
  const finePointer = window.matchMedia(
    '(hover: hover) and (pointer: fine)'
  );
  const reduceMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  );

  let centerRatio = clamp(initialCenterRatio, 0, 1);
  let hasOverflow = false;
  let viewportReady = false;
  let panFrame = 0;
  let resizeFrame = 0;
  let panVelocity = 0;
  let targetPanVelocity = 0;
  let previousFrameTime = 0;
  let destroyed = false;

  const updateCenterRatio = () => {
    if (!hasOverflow || viewport.scrollWidth <= 0) return;
    centerRatio = clamp(
      (viewport.scrollLeft + viewport.clientWidth / 2) /
        viewport.scrollWidth,
      0,
      1
    );
  };

  const stopMotion = (immediate = false) => {
    targetPanVelocity = 0;
    if (!immediate) return;
    window.cancelAnimationFrame(panFrame);
    panFrame = 0;
    panVelocity = 0;
    previousFrameTime = 0;
  };

  const animatePan = (time: number) => {
    panFrame = 0;
    const elapsedSeconds = previousFrameTime
      ? Math.min(0.05, (time - previousFrameTime) / 1000)
      : 1 / 60;
    previousFrameTime = time;
    const easing = 1 - Math.exp(-elapsedSeconds * 8);

    if (
      !hasOverflow ||
      !isInteractive() ||
      document.hidden ||
      reduceMotion.matches
    ) {
      targetPanVelocity = 0;
    }
    panVelocity += (targetPanVelocity - panVelocity) * easing;

    if (Math.abs(panVelocity) >= 0.1) {
      const maxScroll = Math.max(
        0,
        viewport.scrollWidth - viewport.clientWidth
      );
      const nextScroll = clamp(
        viewport.scrollLeft + panVelocity * elapsedSeconds,
        0,
        maxScroll
      );
      const reachedBoundary =
        nextScroll === viewport.scrollLeft &&
        ((nextScroll <= 0 && panVelocity < 0) ||
          (nextScroll >= maxScroll && panVelocity > 0));

      viewport.scrollLeft = nextScroll;
      if (reachedBoundary) {
        panVelocity = 0;
        targetPanVelocity = 0;
      }
    }

    const settled =
      Math.abs(targetPanVelocity - panVelocity) < 0.1 &&
      Math.abs(panVelocity) < 0.1;
    if (settled) {
      panVelocity = targetPanVelocity;
      previousFrameTime = 0;
      return;
    }

    panFrame = window.requestAnimationFrame(animatePan);
  };

  const schedulePan = () => {
    if (!panFrame) {
      panFrame = window.requestAnimationFrame(animatePan);
    }
  };

  const positionViewport = (preservePosition = true) => {
    if (destroyed) return;
    stopMotion(true);
    viewportReady = false;

    window.requestAnimationFrame(() => {
      if (destroyed) return;
      hasOverflow = world.offsetWidth - viewport.clientWidth > 1;
      root.classList.toggle('has-world-overflow', hasOverflow);
      root.classList.toggle('has-fine-pointer', finePointer.matches);

      if (!hasOverflow) {
        viewport.scrollLeft = 0;
        viewportReady = true;
        return;
      }

      const ratio = preservePosition
        ? centerRatio
        : clamp(initialCenterRatio, 0, 1);
      const maxScroll = Math.max(
        0,
        world.offsetWidth - viewport.clientWidth
      );
      viewport.scrollLeft = clamp(
        ratio * world.offsetWidth - viewport.clientWidth / 2,
        0,
        maxScroll
      );

      window.requestAnimationFrame(() => {
        if (destroyed) return;
        viewportReady = true;
        updateCenterRatio();
      });
    });
  };

  const recalculate = (preservePosition = true) => {
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(() => {
      positionViewport(preservePosition);
    });
  };

  viewport.addEventListener('pointermove', (event) => {
    if (
      !hasOverflow ||
      !finePointer.matches ||
      reduceMotion.matches ||
      !isInteractive() ||
      event.pointerType === 'touch'
    ) return;

    const bounds = viewport.getBoundingClientRect();
    const pointerX = event.clientX - bounds.left;
    const edgeZone = Math.min(
      220,
      Math.max(90, bounds.width * 0.2)
    );
    let edgeStrength = 0;

    if (pointerX < edgeZone) {
      edgeStrength = -(1 - pointerX / edgeZone);
    } else if (pointerX > bounds.width - edgeZone) {
      edgeStrength =
        (pointerX - (bounds.width - edgeZone)) / edgeZone;
    }

    const maximumSpeed = Math.min(
      850,
      Math.max(260, bounds.width * 0.55)
    );
    targetPanVelocity =
      Math.sign(edgeStrength) *
      Math.pow(Math.abs(edgeStrength), 1.65) *
      maximumSpeed;
    schedulePan();
  }, { signal });

  viewport.addEventListener('pointerleave', () => {
    stopMotion();
    schedulePan();
  }, { signal });

  viewport.addEventListener('scroll', () => {
    if (!hasOverflow || !viewportReady) return;
    updateCenterRatio();
    root.classList.add('has-explored');
  }, { passive: true, signal });

  viewport.addEventListener('keydown', (event) => {
    if (!hasOverflow || !isInteractive()) return;
    const distance = Math.max(160, viewport.clientWidth * 0.72);
    let nextLeft: number | null = null;

    if (event.key === 'ArrowLeft') {
      nextLeft = viewport.scrollLeft - distance;
    } else if (event.key === 'ArrowRight') {
      nextLeft = viewport.scrollLeft + distance;
    } else if (event.key === 'Home') {
      nextLeft = 0;
    } else if (event.key === 'End') {
      nextLeft = viewport.scrollWidth;
    }

    if (nextLeft === null) return;
    event.preventDefault();
    viewport.scrollTo({
      left: nextLeft,
      behavior: reduceMotion.matches ? 'auto' : 'smooth'
    });
  }, { signal });

  window.addEventListener('resize', () => {
    recalculate(true);
  }, { passive: true, signal });

  window.addEventListener('orientationchange', () => {
    recalculate(true);
  }, { passive: true, signal });

  window.visualViewport?.addEventListener('resize', () => {
    recalculate(true);
  }, { passive: true, signal });

  finePointer.addEventListener('change', () => {
    recalculate(true);
  }, { signal });

  reduceMotion.addEventListener('change', () => {
    stopMotion(true);
  }, { signal });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopMotion(true);
  }, { signal });

  const viewportObserver =
    typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => recalculate(true));
  viewportObserver?.observe(viewport);
  viewportObserver?.observe(world);

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    stopMotion(true);
    window.cancelAnimationFrame(resizeFrame);
    viewportObserver?.disconnect();
  };

  signal.addEventListener('abort', destroy, { once: true });
  positionViewport(false);

  return { recalculate, stopMotion, destroy };
}
