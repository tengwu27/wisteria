export interface CinematicVideoMedia {
  src: string;
  poster?: string;
}

interface LayerBundleLoaderOptions<Theme extends string> {
  stacks: Record<Theme, HTMLElement>;
  imageSelector: string;
  signal: AbortSignal;
}

export interface LayerBundleLoader<Theme extends string> {
  load: (theme: Theme) => Promise<boolean>;
  isLoaded: (theme: Theme) => boolean;
}

export function showDeferredVideoPoster(
  video: HTMLVideoElement,
  media: CinematicVideoMedia
) {
  if (media.poster && video.getAttribute('poster') !== media.poster) {
    video.setAttribute('poster', media.poster);
  }
}

export function loadDeferredVideo(
  video: HTMLVideoElement,
  media: CinematicVideoMedia
) {
  video.muted = true;
  showDeferredVideoPoster(video, media);
  if (video.getAttribute('src') !== media.src) {
    video.setAttribute('src', media.src);
    video.load();
  }
}

export function releaseDeferredVideo(
  video: HTMLVideoElement,
  options: { keepPoster?: boolean } = {}
) {
  video.pause();
  video.removeAttribute('src');
  if (!options.keepPoster) video.removeAttribute('poster');
  video.load();
}

function waitForImage(image: HTMLImageElement, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Layer loading aborted', 'AbortError'));
      return;
    }

    const decode = () => {
      if (typeof image.decode === 'function') {
        image.decode().then(resolve).catch(resolve);
      } else {
        resolve();
      }
    };

    if (image.complete && image.naturalWidth > 0) {
      decode();
      return;
    }

    const cleanup = () => {
      image.removeEventListener('load', onLoad);
      image.removeEventListener('error', onError);
    };
    const onLoad = () => {
      cleanup();
      decode();
    };
    const onError = () => {
      cleanup();
      reject(new Error(`Layer failed: ${image.dataset.src ?? 'unknown'}`));
    };

    image.addEventListener('load', onLoad, { once: true });
    image.addEventListener('error', onError, { once: true });
  });
}

export function createLayerBundleLoader<Theme extends string>({
  stacks,
  imageSelector,
  signal
}: LayerBundleLoaderOptions<Theme>): LayerBundleLoader<Theme> {
  const promises = new Map<Theme, Promise<boolean>>();

  const load = (theme: Theme) => {
    const existing = promises.get(theme);
    if (existing) return existing;

    const stack = stacks[theme];
    const images = Array.from(
      stack.querySelectorAll<HTMLImageElement>(imageSelector)
    );
    for (const image of images) {
      if (!image.hasAttribute('src') && image.dataset.src) {
        image.src = image.dataset.src;
      }
    }

    const promise = Promise.all(images.map((image) => waitForImage(image, signal)))
      .then(() => {
        stack.dataset.loaded = 'true';
        delete stack.dataset.failed;
        return true;
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          stack.dataset.failed = 'true';
        }
        promises.delete(theme);
        return false;
      });

    promises.set(theme, promise);
    return promise;
  };

  return {
    load,
    isLoaded: (theme) => stacks[theme].dataset.loaded === 'true'
  };
}
