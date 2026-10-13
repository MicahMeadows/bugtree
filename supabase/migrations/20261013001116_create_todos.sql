-- Shared hello-world demo: all visitors intentionally share the same todos.
create table public.todos (
  id bigint generated always as identity primary key,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  completed boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.todos enable row level security;
revoke all on public.todos from anon, authenticated;
grant select, delete on public.todos to anon, authenticated;
grant insert (title), update (completed) on public.todos to anon, authenticated;
grant usage on sequence public.todos_id_seq to anon, authenticated;
create policy "Shared demo read" on public.todos for select to anon, authenticated using (true);
create policy "Shared demo add" on public.todos for insert to anon, authenticated with check (true);
create policy "Shared demo complete" on public.todos for update to anon, authenticated using (true) with check (true);
create policy "Shared demo delete" on public.todos for delete to anon, authenticated using (true);
