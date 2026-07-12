create table if not exists public.content_entries (
  id uuid primary key default gen_random_uuid(),
  collection text not null check (collection in ('art', 'lifestyle', 'travel')),
  slug text not null,
  published boolean not null default true,
  data jsonb not null default '{}'::jsonb,
  body_markdown text,
  body_html text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (collection, slug)
);

create index if not exists content_entries_collection_published_idx
  on public.content_entries (collection, published);

alter table public.content_entries enable row level security;

drop policy if exists "Published content is publicly readable" on public.content_entries;

create policy "Published content is publicly readable"
  on public.content_entries
  for select
  using (published = true);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_content_entries_updated_at on public.content_entries;

create trigger set_content_entries_updated_at
  before update on public.content_entries
  for each row
  execute function public.set_updated_at();
