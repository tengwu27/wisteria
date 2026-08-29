import { marked } from 'marked';
import { getMedia, getResponsiveMedia } from '@/assets/images/placeholders';
import { libraryScene } from '@/data/libraryScene';
import {
  getEntryBodyMarkdown,
  getPublishedBookEntries,
  type ContentCollection
} from '@/lib/content';
import { paginateBookMarkdown } from '@/lib/libraryPagination';
import { getNotionLibraryEntries } from '@/lib/notionLibrary';
import type {
  ArtifactKind,
  BookPageLayout,
  BookPresentation
} from '@/types/immersive';

export interface LibraryBookPage {
  index: number;
  layout: BookPageLayout;
  html: string;
  imageSrc?: string;
  imageSrcset?: string;
  imageAlt?: string;
  imageCaption?: string;
}

export interface LibraryBook {
  artifactId: string;
  sourceCollection: ContentCollection | 'notion';
  sourceSlug: string;
  title: string;
  excerpt: string;
  presentation: BookPresentation;
  pages: LibraryBookPage[];
}

export const artifactInspectorRegistry = {
  book: {
    routePrefix: '/collection',
    supportsPagedReading: true
  }
} satisfies Partial<
  Record<
    ArtifactKind,
    { routePrefix: string; supportsPagedReading: boolean }
  >
>;

export async function getLibraryBooks(): Promise<LibraryBook[]> {
  const [entries, notionEntries] = await Promise.all([
    getPublishedBookEntries(),
    getNotionLibraryEntries()
  ]);
  const byArtifactId = new Map(
    entries.map((entry) => [entry.data.book.artifactId, entry])
  );
  const placedIds = libraryScene.zones.flatMap((zone) =>
    zone.artifacts.map((artifact) => artifact.artifactId)
  );

  const localBooks = placedIds.map((artifactId) => {
    const entry = byArtifactId.get(artifactId);
    if (!entry) {
      throw new Error(
        `Library scene references missing published book: ${artifactId}`
      );
    }

    const presentation = entry.data.book;
    const paginated = paginateBookMarkdown(
      getEntryBodyMarkdown(entry),
      presentation.pages
    );

    return {
      artifactId,
      sourceCollection: entry.collection,
      sourceSlug: entry.slug,
      title: entry.data.title,
      excerpt: entry.data.excerpt,
      presentation: {
        ...presentation,
        pages: paginated.map((page) => page.presentation)
      },
      pages: paginated.map((item, index) => {
        const page = item.presentation;
        const responsiveMedia = page.imageKey
          ? getResponsiveMedia(page.imageKey)
          : undefined;
        return {
          index,
          layout: page.layout,
          html: marked.parse(item.markdown, { async: false }),
          imageSrc: page.imageKey
            ? responsiveMedia?.at(-1)?.src ?? getMedia(page.imageKey)
            : undefined,
          imageSrcset: responsiveMedia
            ?.map((asset) => `${asset.src} ${asset.width}w`)
            .join(', '),
          imageAlt: page.imageAlt,
          imageCaption: page.imageCaption
        };
      })
    };
  });

  const notionBooks = notionEntries.map((entry): LibraryBook => {
    const paginated = paginateBookMarkdown(entry.bodyMarkdown);
    const coverColor =
      entry.sceneId === 'west-shelf' ? '#244f58' : '#6f2f3c';
    return {
      artifactId: entry.wisteriaId,
      sourceCollection: 'notion',
      sourceSlug: entry.wisteriaId,
      title: entry.title,
      excerpt: entry.bodyMarkdown
        .replace(/[#*_`>\-[\]()]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 180),
      presentation: {
        artifactId: entry.wisteriaId,
        kind: 'book',
        fixture: false,
        noindex: entry.status !== 'Alive',
        cover: {
          titleZh: entry.title,
          titleEn: entry.title.toUpperCase(),
          emblem: entry.sceneId === 'west-shelf' ? 'wave' : 'wisteria',
          color: coverColor,
          foil: '#d3ad62'
        },
        pages: paginated.map((page) => page.presentation)
      },
      pages: paginated.map((page, index) => ({
        index,
        layout: page.presentation.layout,
        html: marked.parse(page.markdown, { async: false })
      }))
    };
  });

  const duplicate = notionBooks.find((book) =>
    byArtifactId.has(book.artifactId)
  );
  if (duplicate) {
    throw new Error(
      `Duplicate local and Notion artifact: ${duplicate.artifactId}`
    );
  }
  return [...localBooks, ...notionBooks];
}

export async function getLibraryBook(artifactId: string) {
  return (await getLibraryBooks()).find(
    (book) => book.artifactId === artifactId
  );
}
