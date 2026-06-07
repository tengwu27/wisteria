import artPaperStudy from './art/paper-study.svg?url';
import artWindowLight from './art/window-light.svg?url';
import heroStillness from './hero/hero-stillness.svg?url';
import lifestyleShelf from './lifestyle/shelf-notes.svg?url';
import lifestyleTable from './lifestyle/table-light.svg?url';
import portraitPlaceholder from './portrait/portrait-placeholder.svg?url';
import travelCoast from './travel/coast-memory.svg?url';
import travelGarden from './travel/garden-path.svg?url';

export const mediaLibrary = {
  heroStillness,
  artPaperStudy,
  artWindowLight,
  lifestyleTable,
  lifestyleShelf,
  travelCoast,
  travelGarden,
  portraitPlaceholder
} as const;

export type MediaKey = keyof typeof mediaLibrary;

export function getMedia(key: MediaKey) {
  return mediaLibrary[key];
}
