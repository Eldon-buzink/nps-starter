-- THEMES: store canonical theme names (for dynamic discovery)
create table if not exists public.themes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

-- A little help to keep slugs unique even under concurrency
create unique index if not exists themes_slug_uidx on public.themes (slug);

-- ENRICHMENT: one row per NPS response
create table if not exists public.nps_ai_enrichment (
  response_id uuid primary key,
  model text not null,
  themes text[] not null,           -- canonical display names from `themes`
  primary_theme text not null,      -- canonical display name from `themes`
  sentiment text not null,          -- 'promoter' | 'passive' | 'detractor' | 'neutral'
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  raw jsonb not null,
  created_at timestamptz not null default now()
);

-- Fast lookup of "what's left to enrich"
create index if not exists nps_unenriched_quick
on public.nps_response (id)
where nps_explanation is not null;
