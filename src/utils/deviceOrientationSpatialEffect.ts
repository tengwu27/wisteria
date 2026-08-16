const SPATIAL_SESSION_KEY = 'wisteria-spatial-effect-enabled';
const DEAD_ZONE_DEGREES = 1.5;
const FULL_RESPONSE_DEGREES = 14;
const MAXIMUM_FOCUS = 0.65;
const CALIBRATION_SAMPLE_COUNT = 5;
const SENSOR_TIMEOUT_MS = 2500;

export type SpatialEffectState =
  | 'unsupported'
  | 'idle'
  | 'requesting'
  | 'calibrating'
  | 'enabled'
  | 'denied'
  | 'no-sensor-data'
  | 'disabled';

export interface SpatialFocus {
  x: number;
  y: number;
}

interface DeviceOrientationEventConstructorWithPermission {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

interface SpatialWindow extends Window {
  DeviceOrientationEvent?: typeof DeviceOrientationEvent &
    DeviceOrientationEventConstructorWithPermission;
  __wisteriaSpatialPermissionGranted?: boolean;
}

interface DeviceOrientationSpatialEffectOptions {
  button: HTMLButtonElement;
  signal: AbortSignal;
  axes?: 'horizontal' | 'both';
  isInteractive?: () => boolean;
  onFocus: (focus: SpatialFocus) => void;
  onStatus?: (message: string, state: SpatialEffectState) => void;
}

export interface DeviceOrientationSpatialEffectController {
  getState: () => SpatialEffectState;
  recalibrate: () => void;
  setSuspended: (suspended: boolean, immediate?: boolean) => void;
  destroy: () => void;
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export function projectOrientationToScreen(
  beta: number,
  gamma: number,
  screenAngle: number
) {
  const radians = screenAngle * Math.PI / 180;
  return {
    x: gamma * Math.cos(radians) + beta * Math.sin(radians),
    y: beta * Math.cos(radians) - gamma * Math.sin(radians)
  };
}

export function normalizeSpatialTilt(delta: number) {
  const magnitude = Math.abs(delta);
  if (magnitude <= DEAD_ZONE_DEGREES) return 0;
  const normalized =
    (magnitude - DEAD_ZONE_DEGREES) /
    (FULL_RESPONSE_DEGREES - DEAD_ZONE_DEGREES);
  return Math.sign(delta) * clamp(normalized, 0, 1) * MAXIMUM_FOCUS;
}

function getScreenAngle() {
  const modernAngle = window.screen.orientation?.angle;
  const legacyAngle = (window as Window & { orientation?: number }).orientation;
  return typeof modernAngle === 'number'
    ? modernAngle
    : typeof legacyAngle === 'number'
      ? legacyAngle
      : 0;
}

function readSessionPreference() {
  try {
    return window.sessionStorage.getItem(SPATIAL_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

function writeSessionPreference(enabled: boolean) {
  try {
    if (enabled) window.sessionStorage.setItem(SPATIAL_SESSION_KEY, '1');
    else window.sessionStorage.removeItem(SPATIAL_SESSION_KEY);
  } catch {
    // The in-memory permission flag still carries through client navigation.
  }
}

export function createDeviceOrientationSpatialEffect({
  button,
  signal,
  axes = 'horizontal',
  isInteractive = () => true,
  onFocus,
  onStatus = () => undefined
}: DeviceOrientationSpatialEffectOptions): DeviceOrientationSpatialEffectController {
  const spatialWindow = window as SpatialWindow;
  const coarsePointer = window.matchMedia('(pointer: coarse)');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const label = button.querySelector<HTMLElement>('[data-spatial-effect-label]');

  let state: SpatialEffectState = 'idle';
  let enabled = false;
  let suspended = true;
  let listening = false;
  let destroyed = false;
  let sensorTimer = 0;
  let calibrationSamples: SpatialFocus[] = [];
  let baseline: SpatialFocus | null = null;

  const isCapable = () =>
    window.isSecureContext &&
    typeof spatialWindow.DeviceOrientationEvent !== 'undefined' &&
    (coarsePointer.matches || navigator.maxTouchPoints > 0) &&
    !reduceMotion.matches;

  const announce = (message: string, next: SpatialEffectState) => {
    state = next;
    button.dataset.spatialState = next;
    onStatus(message, next);
  };

  const setNeutral = () => onFocus({ x: 0, y: 0 });

  const updateButton = () => {
    const capable = isCapable();
    button.hidden = !capable;
    const busy = state === 'requesting' || state === 'calibrating';
    button.disabled = !capable || suspended || busy || !isInteractive();
    button.setAttribute('aria-pressed', String(enabled));

    const preferred = readSessionPreference();
    const visibleLabel = enabled
      ? '已开启'
      : preferred && !spatialWindow.__wisteriaSpatialPermissionGranted
        ? '恢复空间感'
        : state === 'no-sensor-data' || state === 'denied'
          ? '重试空间感'
          : '空间感';
    if (label) label.textContent = visibleLabel;
    button.setAttribute(
      'aria-label',
      enabled
        ? '关闭手机空间感'
        : preferred
          ? '恢复手机空间感'
          : '开启手机空间感'
    );
  };

  const clearSensorTimer = () => {
    window.clearTimeout(sensorTimer);
    sensorTimer = 0;
  };

  const stopListening = () => {
    if (!listening) return;
    window.removeEventListener('deviceorientation', handleOrientation);
    listening = false;
    clearSensorTimer();
  };

  const handleOrientation = (event: DeviceOrientationEvent) => {
    if (
      destroyed ||
      suspended ||
      !enabled ||
      !isInteractive() ||
      document.hidden ||
      typeof event.beta !== 'number' ||
      typeof event.gamma !== 'number' ||
      !Number.isFinite(event.beta) ||
      !Number.isFinite(event.gamma) ||
      Math.abs(event.beta) > 180 ||
      Math.abs(event.gamma) > 90
    ) return;

    const projected = projectOrientationToScreen(
      event.beta,
      event.gamma,
      getScreenAngle()
    );

    if (!baseline) {
      calibrationSamples.push(projected);
      if (calibrationSamples.length < CALIBRATION_SAMPLE_COUNT) return;
      baseline = calibrationSamples.reduce(
        (sum, sample) => ({ x: sum.x + sample.x, y: sum.y + sample.y }),
        { x: 0, y: 0 }
      );
      baseline.x /= calibrationSamples.length;
      baseline.y /= calibrationSamples.length;
      clearSensorTimer();
      announce('手机空间感已开启', 'enabled');
      updateButton();
      setNeutral();
      return;
    }

    const focusX = normalizeSpatialTilt(projected.x - baseline.x);
    const focusY = axes === 'both'
      ? normalizeSpatialTilt(projected.y - baseline.y)
      : 0;
    onFocus({ x: focusX, y: focusY });
  };

  const startListening = () => {
    if (listening || !enabled || suspended || !isInteractive()) return;
    listening = true;
    window.addEventListener('deviceorientation', handleOrientation);
    if (!baseline) {
      announce('正在校准手机姿态', 'calibrating');
      sensorTimer = window.setTimeout(() => {
        stopListening();
        enabled = false;
        baseline = null;
        calibrationSamples = [];
        writeSessionPreference(false);
        setNeutral();
        announce('没有收到手机方向数据，空间感未开启', 'no-sensor-data');
        updateButton();
      }, SENSOR_TIMEOUT_MS);
    }
  };

  const syncListening = () => {
    if (
      destroyed ||
      !isCapable() ||
      !enabled ||
      suspended ||
      !isInteractive() ||
      document.hidden
    ) {
      stopListening();
      setNeutral();
    } else {
      startListening();
    }
    updateButton();
  };

  const recalibrate = () => {
    baseline = null;
    calibrationSamples = [];
    setNeutral();
    if (enabled && !suspended) {
      stopListening();
      startListening();
    }
  };

  const disable = () => {
    enabled = false;
    writeSessionPreference(false);
    stopListening();
    baseline = null;
    calibrationSamples = [];
    setNeutral();
    announce('手机空间感已关闭', 'disabled');
    updateButton();
  };

  const requestEnable = async () => {
    if (!isCapable() || state === 'requesting') return;
    announce('正在请求动作与方向权限', 'requesting');
    updateButton();

    try {
      const permissionRequest =
        spatialWindow.DeviceOrientationEvent?.requestPermission;
      if (typeof permissionRequest === 'function') {
        const permission = await permissionRequest.call(
          spatialWindow.DeviceOrientationEvent
        );
        if (permission !== 'granted') {
          enabled = false;
          spatialWindow.__wisteriaSpatialPermissionGranted = false;
          writeSessionPreference(false);
          announce('没有获得动作与方向权限', 'denied');
          updateButton();
          return;
        }
      }

      spatialWindow.__wisteriaSpatialPermissionGranted = true;
      writeSessionPreference(true);
      enabled = true;
      baseline = null;
      calibrationSamples = [];
      startListening();
      updateButton();
    } catch {
      enabled = false;
      spatialWindow.__wisteriaSpatialPermissionGranted = false;
      writeSessionPreference(false);
      announce('无法开启动作与方向权限', 'denied');
      updateButton();
    }
  };

  const setSuspended = (next: boolean, immediate = false) => {
    suspended = next;
    if (next) {
      stopListening();
      if (immediate) {
        baseline = null;
        calibrationSamples = [];
      }
    }
    syncListening();
  };

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    stopListening();
    setNeutral();
  };

  button.addEventListener('click', () => {
    if (enabled) disable();
    else void requestEnable();
  }, { signal });

  const handleCapabilityChange = () => {
    if (!isCapable()) {
      stopListening();
      setNeutral();
      announce('', 'unsupported');
    }
    updateButton();
  };
  coarsePointer.addEventListener('change', handleCapabilityChange, { signal });
  reduceMotion.addEventListener('change', handleCapabilityChange, { signal });
  window.addEventListener('orientationchange', recalibrate, { signal });
  window.screen.orientation?.addEventListener('change', recalibrate, { signal });
  document.addEventListener('visibilitychange', syncListening, { signal });
  signal.addEventListener('abort', destroy, { once: true });

  const preferred = readSessionPreference();
  if (
    preferred &&
    spatialWindow.__wisteriaSpatialPermissionGranted === true &&
    isCapable()
  ) {
    enabled = true;
    state = 'calibrating';
  } else if (!isCapable()) {
    state = 'unsupported';
  }
  updateButton();

  return {
    getState: () => state,
    recalibrate,
    setSuspended,
    destroy
  };
}
