export const MATCHED_FRAME_ASPECT_TOLERANCE = 0.005;
export const MATCHED_FRAME_MIN_SHORT_SIDE = 96;

function positiveFinite(value, label) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive finite number.`);
  }
  return value;
}

export function aspectRatioError(aperture, source) {
  const apertureWidth = positiveFinite(aperture.width, 'Aperture width');
  const apertureHeight = positiveFinite(aperture.height, 'Aperture height');
  const sourceWidth = positiveFinite(source.width, 'Source width');
  const sourceHeight = positiveFinite(source.height, 'Source height');
  const sourceRatio = sourceWidth / sourceHeight;
  return Math.abs(apertureWidth / apertureHeight - sourceRatio) / sourceRatio;
}

export function containsBounds(outer, inner, epsilon = 1e-9) {
  return (
    inner.x + epsilon >= outer.x &&
    inner.y + epsilon >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width + epsilon &&
    inner.y + inner.height <= outer.y + outer.height + epsilon
  );
}

export function fitMatchedAperture({
  sourceWidth,
  sourceHeight,
  maxWidth,
  maxHeight,
  minShortSide = MATCHED_FRAME_MIN_SHORT_SIDE,
  aspectTolerance = MATCHED_FRAME_ASPECT_TOLERANCE
}) {
  positiveFinite(sourceWidth, 'Source width');
  positiveFinite(sourceHeight, 'Source height');
  positiveFinite(maxWidth, 'Maximum aperture width');
  positiveFinite(maxHeight, 'Maximum aperture height');
  positiveFinite(minShortSide, 'Minimum aperture short side');

  const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
  const candidates = [];
  const idealWidth = sourceWidth * scale;
  const idealHeight = sourceHeight * scale;
  for (let width = Math.max(1, Math.floor(idealWidth) - 2); width <= Math.ceil(idealWidth) + 2; width += 1) {
    for (let height = Math.max(1, Math.floor(idealHeight) - 2); height <= Math.ceil(idealHeight) + 2; height += 1) {
      if (width > maxWidth || height > maxHeight) continue;
      const error = aspectRatioError(
        { width, height },
        { width: sourceWidth, height: sourceHeight }
      );
      candidates.push({ width, height, error, area: width * height });
    }
  }
  candidates.sort((a, b) => a.error - b.error || b.area - a.area);
  const best = candidates[0];
  if (!best) throw new Error('No aperture fits inside the supplied bounds.');

  const shortSide = Math.min(best.width, best.height);
  const executable = best.error <= aspectTolerance && shortSide >= minShortSide;
  return {
    ...best,
    shortSide,
    executable,
    reason: executable
      ? null
      : shortSide < minShortSide
        ? `The exact-ratio frame would have a ${shortSide}px short side; choose a larger or different wall placement.`
        : `The frame ratio differs from the source by ${(best.error * 100).toFixed(3)}%; rebuild its geometry.`
  };
}

export function validateMatchedFrameGeometry({
  source,
  aperture,
  frame,
  envelope,
  minShortSide = MATCHED_FRAME_MIN_SHORT_SIDE,
  aspectTolerance = MATCHED_FRAME_ASPECT_TOLERANCE
}) {
  const errors = [];
  const ratioError = aspectRatioError(aperture, source);
  if (ratioError > aspectTolerance) {
    errors.push(
      `Aperture/source aspect-ratio error ${(ratioError * 100).toFixed(3)}% exceeds ${(aspectTolerance * 100).toFixed(3)}%.`
    );
  }
  if (Math.min(aperture.width, aperture.height) < minShortSide) {
    errors.push(`Aperture short side must be at least ${minShortSide}px.`);
  }
  if (!containsBounds(frame, aperture)) errors.push('Artwork aperture must remain inside the active frame bounds.');
  if (!containsBounds(envelope, frame)) errors.push('Active frame must remain inside its registered wall envelope.');
  return { errors, ratioError };
}
