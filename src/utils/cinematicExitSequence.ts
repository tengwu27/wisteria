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
  const videos = Array.from(
    overlay.querySelectorAll<HTMLVideoElement>(
      '[data-exit-environment]'
    )
  );

  videos.forEach((video) => {
    video.muted = true;
    video.load();
  });

  let currentVideo: HTMLVideoElement | null = null;
  let running = false;
  let fallbackTimer = 0;
  let navigationTimer = 0;

  const clearTimers = () => {
    window.clearTimeout(fallbackTimer);
    window.clearTimeout(navigationTimer);
  };

  const pause = () => {
    videos.forEach((video) => video.pause());
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
    currentVideo?.pause();
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
    videos.forEach((candidate) => {
      const active = candidate === video;
      candidate.classList.toggle('is-active', active);
      if (!active) {
        candidate.pause();
        candidate.currentTime = 0;
      }
    });

    video.currentTime = 0;
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

  videos.forEach((video) => {
    video.addEventListener('ended', () => {
      if (video === currentVideo) finish();
    }, { signal });
    video.addEventListener('error', () => {
      if (running && video === currentVideo) finish();
    }, { signal });
  });

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
    currentVideo =
      videos.find(
        (video) => video.dataset.exitEnvironment === environment
      ) ?? null;
    overlay.setAttribute('aria-hidden', 'false');
    overlay.classList.add('is-active');

    if (reduceMotion.matches || !currentVideo) {
      requestAnimationFrame(finish);
      return;
    }

    requestAnimationFrame(() => {
      if (currentVideo) playCurrent(currentVideo);
    });
  };

  const reset = () => {
    clearTimers();
    running = false;
    currentVideo = null;
    pause();
    videos.forEach((video) => {
      video.currentTime = 0;
      video.classList.remove('is-active');
    });
    overlay.classList.remove(
      'is-active',
      'is-playing',
      'is-closing'
    );
    overlay.setAttribute('aria-hidden', 'true');
  };

  return { start, reset, pause };
}
