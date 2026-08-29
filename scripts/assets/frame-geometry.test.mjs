import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MATCHED_FRAME_ASPECT_TOLERANCE,
  aspectRatioError,
  fitMatchedAperture,
  validateMatchedFrameGeometry
} from './frame-geometry.mjs';

test('fits the 4:3 Wisteria still life exactly into the center aperture envelope', () => {
  const result = fitMatchedAperture({
    sourceWidth: 1448,
    sourceHeight: 1086,
    maxWidth: 406,
    maxHeight: 267
  });
  assert.deepEqual(
    { width: result.width, height: result.height, executable: result.executable },
    { width: 356, height: 267, executable: true }
  );
  assert.equal(result.error, 0);
});

test('accepts matched geometry inside its registered wall envelope', () => {
  const result = validateMatchedFrameGeometry({
    source: { width: 1448, height: 1086 },
    aperture: { x: 658, y: 292, width: 356, height: 267 },
    frame: { x: 636, y: 272, width: 400, height: 288 },
    envelope: { x: 612, y: 272, width: 450, height: 288 }
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.ratioError, 0);
});

test('rejects aspect drift beyond the construction tolerance', () => {
  const error = aspectRatioError(
    { width: 406, height: 267 },
    { width: 1448, height: 1086 }
  );
  assert.ok(error > MATCHED_FRAME_ASPECT_TOLERANCE);
});

test('pauses an extreme-ratio artwork when its exact frame would be unreadable', () => {
  const result = fitMatchedAperture({
    sourceWidth: 3200,
    sourceHeight: 400,
    maxWidth: 406,
    maxHeight: 267
  });
  assert.equal(result.executable, false);
  assert.match(result.reason, /larger or different wall placement/);
  assert.ok(result.shortSide < 96);
});

test('rejects a frame that escapes its fixed wall envelope', () => {
  const result = validateMatchedFrameGeometry({
    source: { width: 1448, height: 1086 },
    aperture: { x: 658, y: 292, width: 356, height: 267 },
    frame: { x: 600, y: 272, width: 462, height: 288 },
    envelope: { x: 612, y: 272, width: 450, height: 288 }
  });
  assert.ok(result.errors.includes('Active frame must remain inside its registered wall envelope.'));
});
