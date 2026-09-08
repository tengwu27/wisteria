import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

test('Notion is the only Library editorial content source', async () => {
  const [ledger, packageJson, artifactsSource] = await Promise.all([
    readFile('world/structures/library/construction-ledger.json', 'utf8').then(JSON.parse),
    readFile('package.json', 'utf8').then(JSON.parse),
    readFile('src/lib/artifacts.ts', 'utf8')
  ]);
  const items = ledger.records.filter((record) => record.entityKind === 'item');
  const retiredPackage = ['@', 'supa', 'base/', 'supa', 'base-js'].join('');
  const retiredDirectory = ['supa', 'base'].join('');
  assert.ok(items.length > 0);
  for (const item of items) {
    assert.match(item.notionPageId, /^[0-9a-f-]{36}$/i);
  }
  assert.equal(packageJson.dependencies?.[retiredPackage], undefined);
  assert.doesNotMatch(artifactsSource, new RegExp(`${retiredDirectory}|src/content`, 'i'));
  assert.equal(await exists('src/content'), false);
  assert.equal(await exists(retiredDirectory), false);
});
