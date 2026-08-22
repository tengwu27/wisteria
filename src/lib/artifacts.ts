import { marked } from 'marked';
import { getMedia, getResponsiveMedia } from '@/assets/images/placeholders';
import { libraryScene } from '@/data/libraryScene';
import {
  getEntryBodyMarkdown,
  getPublishedBookEntries,
  type ContentCollection
} from '@/lib/content';
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
  sourceCollection: ContentCollection;
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
  const entries = await getPublishedBookEntries();
  const byArtifactId = new Map(
    entries.map((entry) => [entry.data.book.artifactId, entry])
  );
  const placedIds = libraryScene.zones.flatMap((zone) =>
    zone.artifacts.map((artifact) => artifact.artifactId)
  );

  return placedIds.map((artifactId) => {
    const entry = byArtifactId.get(artifactId);
    if (!entry) {
      throw new Error(
        `Library scene references missing published book: ${artifactId}`
      );
    }

    const presentation = entry.data.book;
    const segments = getEntryBodyMarkdown(entry)
      .split(/\n?<!--\s*page\s*-->\n?/i)
      .map((segment) => segment.trim())
      .filter(Boolean);

    if (segments.length !== presentation.pages.length) {
      throw new Error(
        `${artifactId} declares ${presentation.pages.length} pages but contains ${segments.length} Markdown page segments`
      );
    }

    return {
      artifactId,
      sourceCollection: entry.collection,
      sourceSlug: entry.slug,
      title: entry.data.title,
      excerpt: entry.data.excerpt,
      presentation,
      pages: segments.map((segment, index) => {
        const page = presentation.pages[index];
        const responsiveMedia = page.imageKey
          ? getResponsiveMedia(page.imageKey)
          : undefined;
        return {
          index,
          layout: page.layout,
          html: marked.parse(segment, { async: false }),
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
}

export async function getLibraryBook(artifactId: string) {
  return (await getLibraryBooks()).find(
    (book) => book.artifactId === artifactId
  );
}
