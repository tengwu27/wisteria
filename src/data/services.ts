export type HomeChapter = {
  title: 'Art' | 'Lifestyle' | 'Travel';
  href: string;
  imageKey: 'artPaperStudy' | 'lifestyleTable' | 'travelCoast';
  description: string;
};

export const homeChapters: HomeChapter[] = [
  {
    title: 'Art',
    href: '/art',
    imageKey: 'artPaperStudy',
    description: 'A visual portfolio of paintings, studies, photographs, experiments, and quiet works in progress.'
  },
  {
    title: 'Lifestyle',
    href: '/lifestyle',
    imageKey: 'lifestyleTable',
    description: 'Notes on daily life, objects, books, meals, music, and meaningful things found along the way.'
  },
  {
    title: 'Travel',
    href: '/travel',
    imageKey: 'travelCoast',
    description: 'A chronological journey through places, seasons, and the small details that made them stay with us.'
  }
];
