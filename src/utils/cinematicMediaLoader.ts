export const PRIMARY_SCENE_TIMEOUT_MS = 8_000;
export const OPTIONAL_DETAIL_TIMEOUT_MS = 4_000;

export type CinematicImageState =
  | 'loaded'
  | 'timed-out'
  | 'failed'
  | 'aborted';

interface CinematicImageOptions {
  signal: AbortSignal;
  timeoutMs?: number;
  onLateReady?: () => void;
}

async function decodeLoadedImage(image: HTMLImageElement) {
  if (typeof image.decode !== 'function') return;
  await image.decode().catch(() => undefined);
}

/**
 * Wait for a scene image without allowing a stalled request to trap the page.
 * A timed-out image keeps its load listener so callers can recover if it
 * becomes ready later.
 */
export function waitForCinematicImage(
  image: HTMLImageElement,
  {
    signal,
    timeoutMs = PRIMARY_SCENE_TIMEOUT_MS,
    onLateReady
  }: CinematicImageOptions
) {
  return new Promise<CinematicImageState>((resolve) => {
    let initialState: CinematicImageState | null = null;
    let timer = 0;

    const cleanup = () => {
      window.clearTimeout(timer);
      image.removeEventListener('load', onLoad);
      image.removeEventListener('error', onError);
      signal.removeEventListener('abort', onAbort);
    };
    const settle = (state: CinematicImageState, keepListening = false) => {
      if (initialState) return;
      initialState = state;
      window.clearTimeout(timer);
      if (!keepListening) cleanup();
      resolve(state);
    };
    const onLoad = () => {
      void decodeLoadedImage(image).then(() => {
        if (signal.aborted || image.naturalWidth <= 0) return;
        if (initialState === 'timed-out') {
          cleanup();
          onLateReady?.();
          return;
        }
        settle('loaded');
      });
    };
    const onError = () => {
      if (initialState === 'timed-out') {
        cleanup();
        return;
      }
      settle('failed');
    };
    const onAbort = () => {
      if (!initialState) settle('aborted');
      else cleanup();
    };

    if (signal.aborted) {
      settle('aborted');
      return;
    }

    image.addEventListener('load', onLoad);
    image.addEventListener('error', onError);
    signal.addEventListener('abort', onAbort, { once: true });
    timer = window.setTimeout(
      () => settle('timed-out', Boolean(onLateReady)),
      timeoutMs
    );

    if (image.complete) {
      if (image.naturalWidth > 0) onLoad();
      else onError();
    }
  });
}

export function afterCinematicPaint(
  callback: () => void,
  signal?: AbortSignal
) {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      if (!signal?.aborted) callback();
    });
  });
}
