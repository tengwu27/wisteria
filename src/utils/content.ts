import type { CollectionEntry } from 'astro:content';

export function byNewest<T extends { data: { date?: Date; startDate?: Date; order?: number } }>(a: T, b: T) {
  const aDate = a.data.date ?? a.data.startDate;
  const bDate = b.data.date ?? b.data.startDate;

  if (aDate && bDate) {
    return bDate.getTime() - aDate.getTime();
  }

  return (a.data.order ?? 0) - (b.data.order ?? 0);
}

export function byOrder<T extends { data: { order?: number } }>(a: T, b: T) {
  return (a.data.order ?? 0) - (b.data.order ?? 0);
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
}

export function findPreviousNext<T extends CollectionEntry<'art' | 'lifestyle' | 'travel'>>(items: T[], slug: string) {
  const currentIndex = items.findIndex((item) => item.slug === slug);

  return {
    previous: currentIndex > 0 ? items[currentIndex - 1] : undefined,
    next: currentIndex >= 0 && currentIndex < items.length - 1 ? items[currentIndex + 1] : undefined
  };
}
