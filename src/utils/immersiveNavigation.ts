const NAVIGATION_STATE_KEY = '__wisteriaImmersiveNavigation';
const NAVIGATION_START_EVENT = 'wisteria:immersive-navigation-start';
const ARRIVAL_READY_EVENT = 'wisteria:immersive-arrival-ready';
const CURTAIN_DURATION_MS = 180;
const DESTINATION_PRELOAD_TIMEOUT_MS = 8_000;
const ARRIVAL_READY_TIMEOUT_MS = 9_000;
let arrivalTimer = 0;
let unlockTimer = 0;

interface AstroBeforePreparationEvent extends Event {
  to: URL;
  signal: AbortSignal;
  newDocument: Document;
  loader: () => Promise<void>;
}

interface ImmersiveNavigationState {
  installed: true;
  reset: () => void;
}

interface ImmersiveNavigationWindow extends Window {
  [NAVIGATION_STATE_KEY]?: ImmersiveNavigationState;
}

function curtainDuration() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 1
    : CURTAIN_DURATION_MS;
}

function waitForCurtain(signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }

    const timer = window.setTimeout(finish, curtainDuration());
    function finish() {
      window.clearTimeout(timer);
      signal.removeEventListener('abort', finish);
      resolve();
    }
    signal.addEventListener('abort', finish, { once: true });
  });
}

function routeCurtain(target: Document = document) {
  return target.querySelector<HTMLElement>('[data-immersive-route-curtain]');
}

function setCurtain(target: Document, active: boolean) {
  const curtain = routeCurtain(target);
  if (active) curtain?.setAttribute('data-active', 'true');
  else curtain?.removeAttribute('data-active');
  curtain?.setAttribute('aria-hidden', String(!active));
}

function beginNavigation() {
  const alreadyNavigating =
    document.documentElement.dataset.immersiveNavigating === 'true';
  document.documentElement.dataset.immersiveNavigating = 'true';
  delete document.documentElement.dataset.immersiveArrivalReady;
  if (!alreadyNavigating) {
    document.dispatchEvent(new Event(NAVIGATION_START_EVENT));
  }
}

function resetNavigation() {
  window.clearTimeout(arrivalTimer);
  window.clearTimeout(unlockTimer);
  arrivalTimer = 0;
  unlockTimer = 0;
  document.documentElement.classList.remove('is-immersive-arrival-pending');
  delete document.documentElement.dataset.immersiveNavigating;
  setCurtain(document, false);
}

function releaseCurtain() {
  window.clearTimeout(arrivalTimer);
  window.clearTimeout(unlockTimer);
  arrivalTimer = 0;
  document.documentElement.classList.remove('is-immersive-arrival-pending');
  setCurtain(document, false);
  unlockTimer = window.setTimeout(() => {
    delete document.documentElement.dataset.immersiveNavigating;
    unlockTimer = 0;
  }, curtainDuration());
}

function awaitImmersiveArrival() {
  if (document.documentElement.dataset.immersiveNavigating !== 'true') {
    resetNavigation();
    return;
  }
  if (document.documentElement.dataset.immersiveArrivalReady === 'true') {
    releaseCurtain();
    return;
  }

  window.clearTimeout(arrivalTimer);
  arrivalTimer = window.setTimeout(
    releaseCurtain,
    ARRIVAL_READY_TIMEOUT_MS
  );
}

function preloadDestinationImage(
  source: HTMLImageElement,
  destination: URL,
  signal: AbortSignal
) {
  return new Promise<void>((resolve) => {
    const src = source.dataset.src ?? source.getAttribute('src');
    if (!src || signal.aborted) {
      resolve();
      return;
    }

    const preview = new Image();
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      preview.removeEventListener('load', onLoad);
      preview.removeEventListener('error', finish);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    const onLoad = () => {
      const decoded = typeof preview.decode === 'function'
        ? preview.decode().catch(() => undefined)
        : Promise.resolve();
      void decoded.then(finish);
    };
    const timer = window.setTimeout(finish, DESTINATION_PRELOAD_TIMEOUT_MS);
    const sizes = source.getAttribute('sizes');
    const srcset = source.dataset.srcset ?? source.getAttribute('srcset');

    preview.decoding = 'async';
    if (sizes) preview.sizes = sizes;
    if (srcset) preview.srcset = srcset;
    preview.addEventListener('load', onLoad);
    preview.addEventListener('error', finish);
    signal.addEventListener('abort', finish, { once: true });
    preview.src = new URL(src, destination).href;
    if (preview.complete) onLoad();
  });
}

async function preloadDestinationAssets(
  target: Document,
  destination: URL,
  signal: AbortSignal
) {
  const images = [
    ...target.querySelectorAll<HTMLImageElement>(
      '[data-scene-art], [data-library-hall-art], [data-fallback], [data-layer-stack] img[data-src]'
    )
  ];
  await Promise.all(
    images.map((image) => preloadDestinationImage(image, destination, signal))
  );
}

function prepareDestination(target: Document) {
  target.documentElement.dataset.immersiveNavigating = 'true';
  delete target.documentElement.dataset.immersiveArrivalReady;
  target.documentElement.classList.add('is-immersive-arrival-pending');
  target
    .querySelectorAll<HTMLElement>('[data-immersive-loading]')
    .forEach((loading) => {
      loading.setAttribute('data-skip-arrival-reveal', 'true');
      loading.setAttribute('aria-hidden', 'true');
    });
  setCurtain(target, true);
}

export function installImmersiveNavigation() {
  const immersiveWindow = window as ImmersiveNavigationWindow;
  if (immersiveWindow[NAVIGATION_STATE_KEY]) {
    immersiveWindow[NAVIGATION_STATE_KEY].reset();
    return;
  }

  const onBeforePreparation = (rawEvent: Event) => {
    const event = rawEvent as AstroBeforePreparationEvent;
    beginNavigation();
    const load = event.loader;
    event.loader = async () => {
      try {
        await load();
        if (event.signal.aborted) return;
        await preloadDestinationAssets(
          event.newDocument,
          event.to,
          event.signal
        );
        if (event.signal.aborted) return;

        prepareDestination(event.newDocument);
        setCurtain(document, true);
        await waitForCurtain(event.signal);
      } catch (error) {
        resetNavigation();
        throw error;
      }
    };
    event.signal.addEventListener('abort', resetNavigation, { once: true });
  };

  document.addEventListener('astro:before-preparation', onBeforePreparation);
  document.addEventListener(ARRIVAL_READY_EVENT, releaseCurtain);
  document.addEventListener('astro:page-load', awaitImmersiveArrival);
  window.addEventListener('pageshow', resetNavigation);

  immersiveWindow[NAVIGATION_STATE_KEY] = {
    installed: true,
    reset: resetNavigation
  };
  resetNavigation();
}

export function settleImmersiveArrival() {
  const navigating =
    document.documentElement.dataset.immersiveNavigating === 'true';
  if (navigating) {
    document
      .querySelectorAll<HTMLElement>('[data-immersive-loading]')
      .forEach((loading) => {
        loading.setAttribute('data-skip-arrival-reveal', 'true');
        loading.setAttribute('aria-hidden', 'true');
      });
  }
  document.documentElement.classList.remove('is-immersive-arrival-pending');
  document.documentElement.dataset.immersiveArrivalReady = 'true';
  document.dispatchEvent(new Event(ARRIVAL_READY_EVENT));
}

export { NAVIGATION_START_EVENT };
