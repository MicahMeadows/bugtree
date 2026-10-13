-- Credentials and sessions are accessible only to the backend service role.
create table public.site_credentials (
  id integer primary key check (id = 1),
  salt text not null,
  password_hash text not null,
  iterations integer not null
);
create table public.site_sessions (
  token_hash text primary key,
  expires_at timestamptz not null default (now() + interval '7 days')
);
create index site_sessions_expiry_idx on public.site_sessions (expires_at);
create table public.site_login_limits (
  bucket text primary key,
  attempts integer not null,
  expires_at timestamptz not null
);
alter table public.site_credentials enable row level security;
alter table public.site_sessions enable row level security;
alter table public.site_login_limits enable row level security;
revoke all on public.site_credentials, public.site_sessions, public.site_login_limits from public, anon, authenticated;
grant all on public.site_credentials, public.site_sessions, public.site_login_limits to service_role;
insert into public.site_credentials values (1, '69f83a07e30bbeef69ec90844b4040a1', 'd152ab0bb8dd29ac27e3bc894d3c3a893426df4e1191a950a8957fff7027e4ee', 600000);
create function public.check_site_login_limit(p_bucket text) returns boolean
language sql security invoker set search_path = '' as $$
  insert into public.site_login_limits as limits (bucket, attempts, expires_at)
  values (p_bucket, 1, now() + interval '15 minutes')
  on conflict (bucket) do update set
    attempts = case when limits.expires_at < now() then 1 else limits.attempts + 1 end,
    expires_at = case when limits.expires_at < now() then now() + interval '15 minutes' else limits.expires_at end
  returning attempts <= 20;
$$;
revoke all on function public.check_site_login_limit(text) from public, anon, authenticated;
grant execute on function public.check_site_login_limit(text) to service_role;
-- Remove the original public demo access, including column grants.
revoke all on public.todos from anon, authenticated;
revoke insert (title), update (completed) on public.todos from anon, authenticated;
revoke usage on sequence public.todos_id_seq from anon, authenticated;
drop policy "Shared demo read" on public.todos;
drop policy "Shared demo add" on public.todos;
drop policy "Shared demo complete" on public.todos;
drop policy "Shared demo delete" on public.todos;
grant all on public.todos to service_role;
grant usage on sequence public.todos_id_seq to service_role;
