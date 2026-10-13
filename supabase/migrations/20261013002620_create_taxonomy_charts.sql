create table public.taxonomy_charts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  description text not null default '' check (char_length(description) <= 2000),
  nodes jsonb not null check (jsonb_typeof(nodes) = 'array' and jsonb_array_length(nodes) between 1 and 200),
  node_count integer generated always as (jsonb_array_length(nodes)) stored,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index taxonomy_charts_recent_idx on public.taxonomy_charts (updated_at desc) where deleted_at is null;
alter table public.taxonomy_charts enable row level security;
revoke all on public.taxonomy_charts from public, anon, authenticated;
grant all on public.taxonomy_charts to service_role;
-- Photos are private; the authenticated site backend issues temporary URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('taxonomy-photos', 'taxonomy-photos', false, 1048576, array['image/jpeg', 'image/png', 'image/webp']);
