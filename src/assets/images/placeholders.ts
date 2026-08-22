import artPaperStudy from './art/paper-study.svg?url';
import artWindowLight from './art/window-light.svg?url';
import artRetroStudio720 from './art/retro-studio-720.webp?url';
import artRetroStudio1448 from './art/retro-studio-1448.webp?url';
import heroStillness from './hero/hero-stillness.svg?url';
import heroRetroTown from './hero/retro-town-hero.png?url';
import lifestyleShelf from './lifestyle/shelf-notes.svg?url';
import lifestyleTable from './lifestyle/table-light.svg?url';
import lifestyleRetroMorning720 from './lifestyle/retro-morning-720.webp?url';
import lifestyleRetroMorning1448 from './lifestyle/retro-morning-1448.webp?url';
import portraitPlaceholder from './portrait/portrait-placeholder.svg?url';
import travelCoast from './travel/coast-memory.svg?url';
import travelGarden from './travel/garden-path.svg?url';
import travelRetroCoast720 from './travel/retro-coast-train-720.webp?url';
import travelRetroCoast1448 from './travel/retro-coast-train-1448.webp?url';

export const mediaLibrary = {
  heroStillness,
  heroRetroTown,
  artPaperStudy,
  artWindowLight,
  artRetroStudio: artRetroStudio1448,
  lifestyleTable,
  lifestyleShelf,
  lifestyleRetroMorning: lifestyleRetroMorning1448,
  travelCoast,
  travelGarden,
  travelRetroCoast: travelRetroCoast1448,
  portraitPlaceholder
} as const;

export type MediaKey = keyof typeof mediaLibrary;

const responsiveMediaLibrary = {
  artRetroStudio: [
    { src: artRetroStudio720, width: 720 },
    { src: artRetroStudio1448, width: 1448 }
  ],
  lifestyleRetroMorning: [
    { src: lifestyleRetroMorning720, width: 720 },
    { src: lifestyleRetroMorning1448, width: 1448 }
  ],
  travelRetroCoast: [
    { src: travelRetroCoast720, width: 720 },
    { src: travelRetroCoast1448, width: 1448 }
  ]
} as const satisfies Partial<
  Record<MediaKey, readonly { src: string; width: number }[]>
>;

export function getMedia(key: MediaKey) {
  return mediaLibrary[key];
}

export function getResponsiveMedia(key: MediaKey) {
  return responsiveMediaLibrary[
    key as keyof typeof responsiveMediaLibrary
  ] as readonly { src: string; width: number }[] | undefined;
}
