import { marked } from 'marked';
import { getMedia, getResponsiveMedia } from '@/assets/images/placeholders';
import { getRegisteredBookPresentation } from '@/data/libraryBookPresentations';
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
  const notionEntries = await getNotionLibraryEntries();
  return notionEntries.map((entry): LibraryBook => {
    const registeredPresentation = getRegisteredBookPresentation(
      entry.wisteriaId,
      entry.title
    );
    const paginated = paginateBookMarkdown(
      entry.bodyMarkdown,
      registeredPresentation?.pages
    );
    const coverColor =
      entry.sceneId === 'west-shelf' ? '#244f58' : '#6f2f3c';
    const presentation: BookPresentation = registeredPresentation ?? {
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
    };
    return {
      artifactId: entry.wisteriaId,
      sourceSlug: entry.wisteriaId,
      title: entry.title,
      excerpt: entry.bodyMarkdown
        .replace(/[#*_`>\-[\]()]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 180),
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
}

export async function getLibraryBook(artifactId: string) {
  return (await getLibraryBooks()).find(
    (book) => book.artifactId === artifactId
  );
}
