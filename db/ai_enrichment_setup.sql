-- One-time setup: tables, constraints, cleanup, RPCs (idempotent)

begin;

-- THEMES (canonical names for dynamic discovery)
create table if not exists public.themes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create unique index if not exists themes_slug_uidx on public.themes (slug);

-- ENRICHMENT table (make sure all columns exist with sane defaults)
create table if not exists public.nps_ai_enrichment (
  response_id uuid primary key,
  model text,
  themes text[] default array[]::text[],
  primary_theme text,
  sentiment text,
  confidence numeric,
  raw jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Keep confidence within [0,1]
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'nps_ai_enrichment_conf_ck'
      and conrelid = 'public.nps_ai_enrichment'::regclass
  ) then
    alter table public.nps_ai_enrichment
      add constraint nps_ai_enrichment_conf_ck
      check (confidence >= 0 and confidence <= 1) not valid;
    alter table public.nps_ai_enrichment validate constraint nps_ai_enrichment_conf_ck;
  end if;
end$$;

-- Clean orphans (rows whose response_id has no parent) and any accidental null ids
delete from public.nps_ai_enrichment e
where e.response_id is null
   or not exists (select 1 from public.nps_response r where r.id = e.response_id);

-- Deduplicate by response_id (keep newest)
with dups as (
  select response_id, ctid,
         row_number() over (partition by response_id order by created_at desc, ctid desc) rn
  from public.nps_ai_enrichment
)
delete from public.nps_ai_enrichment e
using dups d
where e.ctid = d.ctid and d.rn > 1;

-- Enforce PK and FK (FK cascades on delete)
alter table public.nps_ai_enrichment
  drop constraint if exists nps_ai_enrichment_pkey;
alter table public.nps_ai_enrichment
  add constraint nps_ai_enrichment_pkey primary key (response_id);

alter table public.nps_ai_enrichment
  drop constraint if exists nps_ai_enrichment_response_id_fkey;
alter table public.nps_ai_enrichment
  add constraint nps_ai_enrichment_response_id_fkey
  foreign key (response_id) references public.nps_response(id)
  on delete cascade;

-- Batching RPC: keyset pagination of unenriched responses (with text)
create or replace function public.get_unenriched_batch(p_limit int, p_after uuid default null)
returns table (id uuid, nps_explanation text)
language sql
as $$
  select r.id, r.nps_explanation
  from public.nps_response r
  where r.nps_explanation is not null
    and (p_after is null or r.id > p_after)
    and not exists (
      select 1 from public.nps_ai_enrichment e
      where e.response_id = r.id
    )
  order by r.id
  limit greatest(p_limit, 1);
$$;

-- FK-safe UPSERT RPC (only writes if parent exists; upsert on response_id)
create or replace function public.upsert_nps_ai_enrichment_if_exists(
  p_response_id uuid,
  p_model text,
  p_themes text[],
  p_primary_theme text,
  p_sentiment text,
  p_confidence numeric,
  p_raw jsonb
) returns void
language sql
as $$
  insert into public.nps_ai_enrichment
    (response_id, model, themes, primary_theme, sentiment, confidence, raw)
  select p_response_id, p_model, p_themes, p_primary_theme, p_sentiment, p_confidence, p_raw
  where exists (select 1 from public.nps_response r where r.id = p_response_id)
  on conflict (response_id) do update
  set model = excluded.model,
      themes = excluded.themes,
      primary_theme = excluded.primary_theme,
      sentiment = excluded.sentiment,
      confidence = excluded.confidence,
      raw = excluded.raw;
$$;

commit;

-- If running in Supabase SQL editor, refresh PostgREST cache:
select pg_notify('pgrst','reload schema');

-- End of file