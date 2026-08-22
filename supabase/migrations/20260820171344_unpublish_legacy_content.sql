-- Retire visitor-facing placeholder records after the immersive library launch.
-- Keep the rows for editorial history; public RLS hides them once unpublished.
update public.content_entries
set published = false,
    updated_at = now()
where (collection, slug) in (
  values
    ('art', 'quiet-window-study'),
    ('art', 'soft-geometry'),
    ('lifestyle', 'a-found-essay'),
    ('lifestyle', 'morning-table-notes'),
    ('travel', 'garden-walk'),
    ('travel', 'winter-coastline'),
    ('travel', 'supabase-test-trip')
);
