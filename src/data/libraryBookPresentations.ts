import type {
  BookPagePresentation,
  BookPresentation
} from '@/types/immersive';

interface LibraryBookPresentationProfile {
  fixture: boolean;
  noindex: boolean;
  cover: Omit<BookPresentation['cover'], 'titleZh'>;
  pages: BookPagePresentation[];
}

const registeredBookPresentations: Record<string, LibraryBookPresentationProfile> = {
  'wisteria-field-notes': {
    fixture: true,
    noindex: true,
    cover: {
      titleEn: 'WISTERIA FIELD NOTES',
      emblem: 'wisteria',
      color: '#6f2f3c',
      foil: '#d3ad62'
    },
    pages: [
      { layout: 'title' },
      {
        layout: 'prose-image',
        imageKey: 'lifestyleRetroMorning',
        imageAlt: '晨光照在桌面、杯子和手记上',
        imageCaption: '清晨九点，阅览室的灯仍然亮着。'
      },
      { layout: 'prose' },
      { layout: 'prose' }
    ]
  },
  'atlas-of-tides': {
    fixture: true,
    noindex: true,
    cover: {
      titleEn: 'ATLAS OF TIDES',
      emblem: 'wave',
      color: '#244f58',
      foil: '#d1ad62'
    },
    pages: [
      { layout: 'title' },
      {
        layout: 'image',
        imageKey: 'travelRetroCoast',
        imageAlt: '沿着海湾行驶的复古列车与远处帆船',
        imageCaption: '示例图版 · 北岸慢车与午后潮线'
      },
      { layout: 'prose' },
      { layout: 'prose' }
    ]
  },
  'collected-glimmers': {
    fixture: true,
    noindex: true,
    cover: {
      titleEn: 'COLLECTED GLIMMERS',
      emblem: 'sun',
      color: '#6b3940',
      foil: '#d9b66c'
    },
    pages: [
      {
        layout: 'prose-image',
        imageKey: 'artRetroStudio',
        imageAlt: '暖色灯光下摆放画架与纸张的复古工作室',
        imageCaption: '示例图版 · 光停在纸面上的几分钟'
      },
      { layout: 'prose' }
    ]
  }
};

export function getRegisteredBookPresentation(
  artifactId: string,
  title: string
): BookPresentation | undefined {
  const profile = registeredBookPresentations[artifactId];
  if (!profile) return undefined;
  return {
    artifactId,
    kind: 'book',
    fixture: profile.fixture,
    noindex: profile.noindex,
    cover: { titleZh: title, ...profile.cover },
    pages: profile.pages
  };
}
