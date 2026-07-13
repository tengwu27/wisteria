import artPaperStudy from './art/paper-study.svg?url';
import artWindowLight from './art/window-light.svg?url';
import artRetroStudio from './art/retro-studio.png?url';
import heroStillness from './hero/hero-stillness.svg?url';
import heroRetroTown from './hero/retro-town-hero.png?url';
import lifestyleShelf from './lifestyle/shelf-notes.svg?url';
import lifestyleTable from './lifestyle/table-light.svg?url';
import lifestyleRetroMorning from './lifestyle/retro-morning.png?url';
import portraitPlaceholder from './portrait/portrait-placeholder.svg?url';
import travelCoast from './travel/coast-memory.svg?url';
import travelGarden from './travel/garden-path.svg?url';
import travelRetroCoast from './travel/retro-coast-train.png?url';

export const mediaLibrary = {
  heroStillness,
  heroRetroTown,
  artPaperStudy,
  artWindowLight,
  artRetroStudio,
  lifestyleTable,
  lifestyleShelf,
  lifestyleRetroMorning,
  travelCoast,
  travelGarden,
  travelRetroCoast,
  portraitPlaceholder
} as const;

export type MediaKey = keyof typeof mediaLibrary;

export function getMedia(key: MediaKey) {
  return mediaLibrary[key];
}
