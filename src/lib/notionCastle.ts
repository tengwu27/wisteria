import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { LibraryNotionEntry } from '@/types/libraryFramework';

interface CastleNotionSnapshot {
  schemaVersion: 3;
  structureId: 'castle';
  entries: LibraryNotionEntry[];
}

function isSnapshot(value: unknown): value is CastleNotionSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as Partial<CastleNotionSnapshot>;
  return snapshot.schemaVersion === 3 && snapshot.structureId === 'castle' && Array.isArray(snapshot.entries);
}

export async function getNotionCastleEntries() {
  const snapshotPath = path.join(process.cwd(), '.wisteria-cache/castle-notion.json');
  try {
    const value: unknown = JSON.parse(await readFile(snapshotPath, 'utf8'));
    if (!isSnapshot(value)) throw new Error('Castle Notion snapshot has an unsupported schema.');
    return value.entries;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}
