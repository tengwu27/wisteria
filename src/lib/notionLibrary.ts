import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { LibraryNotionEntry } from '@/types/libraryFramework';

interface LibraryNotionSnapshot {
  schemaVersion: 3;
  generatedAt: string;
  entries: LibraryNotionEntry[];
}

function isSnapshot(value: unknown): value is LibraryNotionSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as Partial<LibraryNotionSnapshot>;
  return snapshot.schemaVersion === 3 && Array.isArray(snapshot.entries);
}

export async function getNotionLibraryEntries() {
  const snapshotPath = path.join(
    process.cwd(),
    '.wisteria-cache/library-notion.json'
  );
  try {
    const value: unknown = JSON.parse(await readFile(snapshotPath, 'utf8'));
    if (!isSnapshot(value)) {
      throw new Error('Library Notion snapshot has an unsupported schema.');
    }
    return value.entries;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}
