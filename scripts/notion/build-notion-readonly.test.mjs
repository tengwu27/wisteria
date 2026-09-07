import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const packageJson = JSON.parse(
  await readFile(new URL('../../package.json', import.meta.url), 'utf8')
);

test('the Netlify build uses only read-only Notion setup paths', () => {
  const build = packageJson.scripts.build;
  assert.doesNotMatch(build, /ensure-library-inline/);
  assert.doesNotMatch(build, /ensure-library-gallery-views/);
  assert.doesNotMatch(build, /--upsert-approved/);
  assert.match(build, /verify-library-notion/);
  assert.match(build, /ensure-castle-art-catalog/);
});

test('Castle catalog mutation remains an explicit construction command', () => {
  assert.doesNotMatch(packageJson.scripts['notion:castle:ensure-art-catalog'], /--upsert-approved/);
  assert.match(packageJson.scripts['notion:castle:catalog-approved'], /--upsert-approved/);
});
