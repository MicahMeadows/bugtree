alter table public.taxonomy_charts
  add column default_color text not null default 'lavender'
  constraint taxonomy_charts_default_color_check
  check (default_color in ('rose', 'sage', 'sand', 'sky', 'lavender'));
