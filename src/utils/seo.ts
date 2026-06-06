import { site } from '@/data/site';

export type SeoInput = {
  title?: string;
  description?: string;
  path?: string;
};

export function createSeo({ title, description, path = '/' }: SeoInput = {}) {
  return {
    title: title ? `${title} | ${site.name}` : site.seo.title,
    description: description ?? site.seo.description,
    canonical: new URL(path, site.url).toString()
  };
}
