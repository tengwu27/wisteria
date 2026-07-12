import { getCollection, type CollectionEntry } from 'astro:content';
import { marked } from 'marked';
import { createClient } from '@supabase/supabase-js';

export type ContentCollection = 'art' | 'lifestyle' | 'travel';

export type ArtEntry = CollectionEntry<'art'> | RemoteContentEntry<'art', CollectionEntry<'art'>['data']>;
export type LifestyleEntry = CollectionEntry<'lifestyle'> | RemoteContentEntry<'lifestyle', CollectionEntry<'lifestyle'>['data']>;
export type TravelEntry = CollectionEntry<'travel'> | RemoteContentEntry<'travel', CollectionEntry<'travel'>['data']>;
export type AnyContentEntry = ArtEntry | LifestyleEntry | TravelEntry;

type EntryByCollection = {
  art: ArtEntry;
  lifestyle: LifestyleEntry;
  travel: TravelEntry;
};

type DataByCollection = {
  art: CollectionEntry<'art'>['data'];
  lifestyle: CollectionEntry<'lifestyle'>['data'];
  travel: CollectionEntry<'travel'>['data'];
};

interface RemoteContentEntry<Collection extends ContentCollection, Data> {
  id: string;
  collection: Collection;
  slug: string;
  data: Data;
  bodyHtml: string;
  source: 'supabase';
}

interface SupabaseContentRow {
  slug: string;
  data: Record<string, unknown>;
  body_markdown: string | null;
  body_html: string | null;
}

const supabaseUrl = import.meta.env.SUPABASE_URL ?? process.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false
      }
    })
  : undefined;

export async function getPublishedEntries<Collection extends ContentCollection>(
  collection: Collection
): Promise<EntryByCollection[Collection][]> {
  if (!supabase) {
    const localEntries = await getCollection(collection);
    return localEntries.filter((entry) => entry.data.published) as EntryByCollection[Collection][];
  }

  const { data, error } = await supabase
    .from('content_entries')
    .select('slug,data,body_markdown,body_html')
    .eq('collection', collection)
    .eq('published', true);

  if (error) {
    throw new Error(`Unable to load ${collection} content from Supabase: ${error.message}`);
  }

  return (data ?? []).map((row) => createRemoteEntry(collection, row)) as unknown as EntryByCollection[Collection][];
}

function createRemoteEntry<Collection extends ContentCollection>(
  collection: Collection,
  row: SupabaseContentRow
): RemoteContentEntry<Collection, DataByCollection[Collection]> {
  return {
    id: `${collection}/${row.slug}`,
    collection,
    slug: row.slug,
    data: normalizeEntryData(collection, row.data),
    bodyHtml: row.body_html ?? marked.parse(row.body_markdown ?? '', { async: false }),
    source: 'supabase'
  };
}

function normalizeEntryData<Collection extends ContentCollection>(
  collection: Collection,
  data: Record<string, unknown>
): DataByCollection[Collection] {
  const normalized = { ...data };

  if (collection === 'art' || collection === 'lifestyle') {
    normalized.date = new Date(String(normalized.date));
  }

  if (collection === 'travel') {
    normalized.startDate = new Date(String(normalized.startDate));
    normalized.endDate = normalized.endDate ? new Date(String(normalized.endDate)) : undefined;
  }

  return normalized as DataByCollection[Collection];
}
