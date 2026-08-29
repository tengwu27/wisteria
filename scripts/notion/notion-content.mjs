import path from 'node:path';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import {
  MEDIA_ROOT,
  richTextToMarkdown,
  sha256,
  slugify
} from './library-framework.mjs';

const CONTENT_TYPE_EXTENSION = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
  ['image/svg+xml', 'svg'],
  ['application/pdf', 'pdf'],
  ['text/plain', 'txt']
]);

const ALLOWED_TYPES = new Set(CONTENT_TYPE_EXTENSION.keys());

export function mediaPublicPath(wisteriaId, digest, contentType) {
  const extension = CONTENT_TYPE_EXTENSION.get(contentType);
  if (!extension) throw new Error(`Unsupported media type ${contentType}.`);
  return `/media/notion/library/${slugify(wisteriaId)}/${digest.slice(0, 20)}.${extension}`;
}

function blockRichText(block) {
  return block[block.type]?.rich_text ?? [];
}

async function blockChildrenMarkdown(block, context) {
  if (!block.children?.length) return '';
  const value = await blocksToMarkdown(block.children, context);
  return value
    .split('\n')
    .map((line) => (line ? `  ${line}` : line))
    .join('\n');
}

export async function blocksToMarkdown(blocks, context) {
  const sections = [];
  for (const block of blocks) {
    const text = richTextToMarkdown(blockRichText(block));
    const children = await blockChildrenMarkdown(block, context);
    let markdown = '';
    switch (block.type) {
      case 'paragraph':
        markdown = text;
        break;
      case 'heading_1':
        markdown = `# ${text}`;
        break;
      case 'heading_2':
        markdown = `## ${text}`;
        break;
      case 'heading_3':
      case 'heading_4':
        markdown = `### ${text}`;
        break;
      case 'bulleted_list_item':
        markdown = `- ${text}`;
        break;
      case 'numbered_list_item':
        markdown = `1. ${text}`;
        break;
      case 'quote':
        markdown = `> ${text}`;
        break;
      case 'callout':
        markdown = `> ${text}`;
        break;
      case 'to_do':
        markdown = `- [${block.to_do?.checked ? 'x' : ' '}] ${text}`;
        break;
      case 'code':
        markdown = `\`\`\`${block.code?.language ?? ''}\n${text}\n\`\`\``;
        break;
      case 'divider':
        markdown = '<!-- page-break -->';
        break;
      case 'bookmark':
      case 'embed': {
        const url = block[block.type]?.url;
        markdown = url ? `[${text || url}](${url})` : '';
        break;
      }
      case 'image':
      case 'file': {
        const value = block[block.type];
        const sourceUrl =
          value?.type === 'external'
            ? value.external?.url
            : value?.file?.url;
        if (!sourceUrl) break;
        const caption = richTextToMarkdown(value.caption ?? []);
        const media = await mirrorMedia({
          notionBlockId: block.id,
          kind: block.type,
          sourceUrl,
          filename: value.name ?? '',
          alt: caption || context.title,
          caption
        }, context);
        context.media.push(media);
        markdown =
          block.type === 'image'
            ? `![${media.alt ?? ''}](${media.publicPath})${
                media.caption ? `\n\n*${media.caption}*` : ''
              }`
            : `[${media.caption || media.filename}](${media.publicPath})`;
        break;
      }
      case 'toggle':
        markdown = `**${text}**`;
        break;
      default:
        markdown = text;
    }
    if (children) markdown = `${markdown}\n${children}`.trim();
    if (markdown) sections.push(markdown);
  }
  return sections.join('\n\n').trim();
}

export async function mirrorMedia(attachment, context) {
  const source = new URL(attachment.sourceUrl);
  if (source.protocol !== 'https:') {
    throw new Error(`Media must use HTTPS: ${attachment.sourceUrl}`);
  }
  const response = await fetch(source);
  if (!response.ok) {
    throw new Error(`Unable to download media (${response.status}): ${source}`);
  }
  const declaredLength = Number(response.headers.get('content-length') ?? 0);
  if (declaredLength > context.maxMediaBytes) {
    throw new Error(`Media exceeds ${context.maxMediaBytes} bytes: ${source}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > context.maxMediaBytes) {
    throw new Error(`Media exceeds ${context.maxMediaBytes} bytes: ${source}`);
  }
  const contentType = (response.headers.get('content-type') ?? '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (!ALLOWED_TYPES.has(contentType)) {
    throw new Error(`Unsupported media type ${contentType || 'unknown'}: ${source}`);
  }
  const digest = sha256(buffer);
  const extension = CONTENT_TYPE_EXTENSION.get(contentType);
  const entryDirectory = path.join(MEDIA_ROOT, slugify(context.wisteriaId));
  const diskPath = path.join(entryDirectory, `${digest.slice(0, 20)}.${extension}`);
  await mkdir(entryDirectory, { recursive: true });
  try {
    await stat(diskPath);
  } catch {
    await writeFile(diskPath, buffer);
  }
  return {
    notionBlockId: attachment.notionBlockId,
    kind: attachment.kind,
    filename: attachment.filename || `${digest.slice(0, 12)}.${extension}`,
    sha256: digest,
    publicPath: mediaPublicPath(context.wisteriaId, digest, contentType),
    contentType,
    byteLength: buffer.length,
    alt: attachment.alt || undefined,
    caption: attachment.caption || undefined
  };
}
