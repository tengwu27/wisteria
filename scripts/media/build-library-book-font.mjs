import { createHash } from 'node:crypto';
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile
} from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '../..');
const fontPackageRoot = resolve(
  projectRoot,
  'node_modules/lxgw-wenkai-webfont'
);
const outputRoot = resolve(projectRoot, 'public/fonts/library-books');
const contentRoot = resolve(projectRoot, 'src/content');
const notionSnapshot = resolve(
  projectRoot,
  '.wisteria-cache/library-notion.json'
);

const variants = [
  { css: 'lxgwwenkai-regular.css', weight: 400 },
  { css: 'lxgwwenkai-bold.css', weight: 700 }
];

async function readIfPresent(path) {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return '';
    throw error;
  }
}

async function collectEditorialText(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const chunks = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      chunks.push(await collectEditorialText(path));
    } else if (['.md', '.mdx'].includes(extname(entry.name))) {
      chunks.push(await readFile(path, 'utf8'));
    }
  }

  return chunks.join('\n');
}

function parseUnicodeRanges(value) {
  return value.split(',').map((token) => {
    const match = token
      .trim()
      .match(/^U\+([0-9a-f]+)(?:-([0-9a-f]+))?$/i);
    if (!match) {
      throw new Error(`Unsupported LXGW WenKai unicode range: ${token}`);
    }

    const start = Number.parseInt(match[1], 16);
    return [start, Number.parseInt(match[2] ?? match[1], 16)];
  });
}

function faceSupportsContent(face, codePoints) {
  const unicodeRange = face.match(/unicode-range:\s*([^;}]+)/i)?.[1];
  if (!unicodeRange) return false;

  return parseUnicodeRanges(unicodeRange).some(([start, end]) =>
    codePoints.some((codePoint) => codePoint >= start && codePoint <= end)
  );
}

function rewriteFace(face, fileName) {
  return face
    .replace(
      /font-family:\s*'LXGW WenKai'/,
      "font-family: 'LXGW WenKai Books'"
    )
    .replace(`./files/${fileName}`, `./${fileName}`);
}

await mkdir(outputRoot, { recursive: true });

const editorialText = [
  await collectEditorialText(contentRoot),
  await readIfPresent(notionSnapshot)
].join('\n');
const codePoints = [...new Set([...editorialText].map((character) =>
  character.codePointAt(0)
))];
const selectedFaces = [];
const selectedFiles = new Set();

for (const variant of variants) {
  const css = await readFile(resolve(fontPackageRoot, variant.css), 'utf8');
  const faces = css.match(/@font-face\s*\{[^}]+\}/g) ?? [];

  for (const face of faces) {
    if (!faceSupportsContent(face, codePoints)) continue;

    const fileName = face.match(/\.\/files\/([^)'\"]+\.woff2)/)?.[1];
    if (!fileName) {
      throw new Error(`Unable to resolve a font file from ${variant.css}`);
    }

    selectedFaces.push(rewriteFace(face, fileName));
    selectedFiles.add(fileName);
  }
}

if (selectedFaces.length === 0) {
  throw new Error('No LXGW WenKai faces matched the current Library content.');
}

let totalBytes = 0;
for (const fileName of selectedFiles) {
  const source = resolve(fontPackageRoot, 'files', fileName);
  const destination = resolve(outputRoot, fileName);
  await copyFile(source, destination);
  totalBytes += (await stat(destination)).size;
}

const stylesheet = [
  '/* Generated from current local and Notion Library content. */',
  ...selectedFaces,
  ''
].join('\n\n');
await writeFile(resolve(outputRoot, 'font.css'), stylesheet, 'utf8');
await writeFile(
  resolve(outputRoot, 'manifest.json'),
  `${JSON.stringify(
    {
      schemaVersion: 1,
      family: 'LXGW WenKai Books',
      sourceHash: createHash('sha256').update(editorialText).digest('hex'),
      uniqueCodePoints: codePoints.length,
      faces: selectedFaces.length,
      files: [...selectedFiles].sort(),
      totalBytes
    },
    null,
    2
  )}\n`,
  'utf8'
);

console.log(
  `Prepared ${selectedFiles.size} LXGW WenKai book-font shards (${totalBytes} bytes).`
);
