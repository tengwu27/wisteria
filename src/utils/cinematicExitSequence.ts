import {
  loadDeferredVideo,
  releaseDeferredVideo
} from '@/utils/cinematicMediaLoader';

export type CinematicEnvironment = 'day' | 'night';

interface CinematicExitOptions {
  overlay: HTMLElement;
  reduceMotion: MediaQueryList;
  signal: AbortSignal;
  onComplete: () => void | Promise<void>;
}

export interface CinematicExitController {
  start: (environment: CinematicEnvironment) => void;
  reset: () => void;
  pause: () => void;
}

const RETURN_SESSION_KEY = 'wisteria-village-return';
const RETURN_DOCUMENT_CLASS = 'is-returning-to-village';

export function createCinematicExitSequence({
  overlay,
  reduceMotion,
  signal,
  onComplete
}: CinematicExitOptions): CinematicExitController {
  const video = overlay.querySelector<HTMLVideoElement>('[data-exit-video]');

  let currentVideo: HTMLVideoElement | null = null;
  let running = false;
  let fallbackTimer = 0;
  let navigationTimer = 0;

  const clearTimers = () => {
    window.clearTimeout(fallbackTimer);
    window.clearTimeout(navigationTimer);
  };

  const pause = () => {
    if (video) releaseDeferredVideo(video);
  };

  const setReturnHandoff = () => {
    document.documentElement.classList.add(RETURN_DOCUMENT_CLASS);
    try {
      window.sessionStorage.setItem(RETURN_SESSION_KEY, '1');
    } catch {
      // The opaque document veil still protects the client-side handoff.
    }
  };

  const finish = () => {
    if (!running) return;
    clearTimers();
    if (currentVideo) {
      releaseDeferredVideo(currentVideo, { keepPoster: true });
    }
    overlay.classList.remove('is-playing');
    overlay.classList.add('is-closing');
    setReturnHandoff();
    navigationTimer = window.setTimeout(
      () => void onComplete(),
      reduceMotion.matches ? 1 : 300
    );
  };

  const playCurrent = (video: HTMLVideoElement) => {
    if (!running) return;
    video.currentTime = 0;
    video.classList.add('is-active');
    overlay.classList.add('is-playing');
    const duration = Number.isFinite(video.duration) && video.duration > 0
      ? video.duration * 1000
      : 5000;
    fallbackTimer = window.setTimeout(finish, duration + 1200);
    const playback = video.play();
    playback?.catch(() => {
      window.setTimeout(finish, 260);
    });
  };

  if (video) {
    video.addEventListener('ended', () => {
      if (video === currentVideo) finish();
    }, { signal });
    video.addEventListener('error', () => {
      if (running && video === currentVideo) finish();
    }, { signal });
  }

  overlay.addEventListener('pointerdown', (event) => {
    if (!running || overlay.classList.contains('is-closing')) return;
    event.preventDefault();
    event.stopPropagation();
    finish();
  }, { signal });

  document.addEventListener('visibilitychange', () => {
    if (!running || !currentVideo) return;
    if (document.hidden) {
      currentVideo.pause();
    } else if (!overlay.classList.contains('is-closing')) {
      currentVideo.play().catch(finish);
    }
  }, { signal });

  const start = (environment: CinematicEnvironment) => {
    if (running) return;
    running = true;
    currentVideo = video;
    overlay.setAttribute('aria-hidden', 'false');
    overlay.classList.add('is-active');

    if (reduceMotion.matches || !currentVideo) {
      requestAnimationFrame(finish);
      return;
    }

    const src = currentVideo.dataset[`${environment}Src`];
    const poster = currentVideo.dataset[`${environment}Poster`];
    if (!src) {
      requestAnimationFrame(finish);
      return;
    }
    loadDeferredVideo(currentVideo, { src, poster });

    requestAnimationFrame(() => {
      if (currentVideo) playCurrent(currentVideo);
    });
  };

  const reset = () => {
    clearTimers();
    running = false;
    currentVideo = null;
    if (video) {
      video.classList.remove('is-active');
      releaseDeferredVideo(video);
    }
    overlay.classList.remove(
      'is-active',
      'is-playing',
      'is-closing'
    );
    overlay.setAttribute('aria-hidden', 'true');
  };

  return { start, reset, pause };
}
