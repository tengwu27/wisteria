import type {
  BookPageLayout,
  BookPagePresentation
} from '@/types/immersive';

export interface PaginatedMarkdownPage {
  markdown: string;
  presentation: BookPagePresentation;
}

const DEFAULT_PAGE_WEIGHT = 900;

function contentWeight(markdown: string) {
  const text = markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' '.repeat(320))
    .replace(/<[^>]+>/g, '')
    .replace(/[#*_`>\-[\]()]/g, '')
    .trim();
  let weight = 0;
  for (const character of text) {
    weight += /[\u3000-\u9fff\uf900-\ufaff]/.test(character) ? 1.8 : 1;
  }
  return weight;
}

function splitOversizedBlock(block: string, budget: number) {
  if (contentWeight(block) <= budget) return [block];
  const sentences = block
    .split(/(?<=[。！？.!?])\s+|(?<=[。！？])/u)
    .map((item) => item.trim())
    .filter(Boolean);
  if (sentences.length <= 1) {
    const words = block.split(/\s+/);
    if (words.length === 1) {
      const chunks: string[] = [];
      let current = '';
      for (const character of [...block]) {
        if (current && contentWeight(current + character) > budget) {
          chunks.push(current);
          current = character;
        } else {
          current += character;
        }
      }
      if (current) chunks.push(current);
      return chunks;
    }
    const chunks: string[] = [];
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && contentWeight(candidate) > budget) {
        chunks.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) chunks.push(current);
    return chunks;
  }
  const chunks: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (current && contentWeight(candidate) > budget) {
      chunks.push(current);
      current = sentence;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function paginateSegment(segment: string, budget: number) {
  const blocks = segment
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean)
    .flatMap((block) => splitOversizedBlock(block, budget));
  const pages: string[] = [];
  let current: string[] = [];
  let weight = 0;
  for (const block of blocks) {
    const blockWeight = contentWeight(block);
    if (current.length && weight + blockWeight > budget) {
      pages.push(current.join('\n\n'));
      current = [];
      weight = 0;
    }
    current.push(block);
    weight += blockWeight;
  }
  if (current.length) pages.push(current.join('\n\n'));
  return pages.length ? pages : [''];
}

export function paginateBookMarkdown(
  markdown: string,
  declaredPages: BookPagePresentation[] = [],
  budget = DEFAULT_PAGE_WEIGHT
): PaginatedMarkdownPage[] {
  const segments = markdown
    .split(/\n?<!--\s*(?:page|page-break)\s*-->\n?/i)
    .map((item) => item.trim())
    .filter(Boolean);
  const sourceSegments = segments.length ? segments : [''];
  return sourceSegments.flatMap((segment, segmentIndex) => {
    const seed = declaredPages[segmentIndex] ?? {
      layout: segmentIndex === 0 ? ('title' as const) : ('prose' as const)
    };
    return paginateSegment(segment, budget).map((page, pageIndex) => ({
      markdown: page,
      presentation:
        pageIndex === 0
          ? seed
          : {
              layout: 'prose' as BookPageLayout
            }
    }));
  });
}
