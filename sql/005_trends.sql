-- Monthly NPS trends and vector search functions
-- This file contains database objects for trend analysis and similarity search

-- 1. Monthly NPS trends by TITEL (brand)

-- A. Helper view (month buckets from CREATIE_DT)
-- Month-bucketed responses (Dutch-only dataset)
create or replace view v_nps_monthly as
select
  date_trunc('month', created_at)::date as month,
  title_text as title,
  survey_name as survey_type,
  nps_score
from nps_response
where created_at is not null;

-- B. RPC: nps_trend_by_title
create or replace function nps_trend_by_title(
  p_start_date date default null,
  p_end_date   date default null,
  p_survey     text default null,
  p_title      text default null
)
returns table(
  month date,
  title text,
  responses int,
  promoters int,
  passives int,
  detractors int,
  nps numeric
)
language sql
stable
as $$
  with base as (
    select *
    from v_nps_monthly
    where (p_start_date is null or month >= date_trunc('month', p_start_date))
      and (p_end_date   is null or month <= date_trunc('month', p_end_date))
      and (p_survey     is null or survey_type = p_survey)
      and (p_title      is null or title = p_title)
  )
  select
    month,
    title,
    count(*)                                         as responses,
    sum(case when nps_score >= 9 then 1 else 0 end)  as promoters,
    sum(case when nps_score between 7 and 8 then 1 else 0 end) as passives,
    sum(case when nps_score <= 6 then 1 else 0 end)  as detractors,
    round(((sum(case when nps_score >= 9 then 1 else 0 end)
           - sum(case when nps_score <= 6 then 1 else 0 end)) * 100.0)
           / nullif(count(*),0), 1)                  as nps
  from base
  group by month, title
  order by month asc, title asc;
$$;

-- C. RPC: add MoM delta per title
create or replace function nps_trend_by_title_with_mom(
  p_start_date date default null,
  p_end_date   date default null,
  p_survey     text default null,
  p_title      text default null
)
returns table(
  month date,
  title text,
  responses int,
  nps numeric,
  mom_delta numeric
)
language sql
stable
as $$
  with agg as (
    select * from nps_trend_by_title(p_start_date, p_end_date, p_survey, p_title)
  )
  select
    month,
    title,
    responses,
    nps,
    round(nps - lag(nps) over (partition by title order by month), 1) as mom_delta
  from agg
  order by month, title;
$$;

-- 2. Vector search — "similar responses"

-- A. Similar to a free-text query
-- Provide a vector from the app layer (recommended) and pass it as parameter.
-- If you prefer to compute embeddings in-SQL you'll need an extension; keep it app-side.
create or replace function similar_responses_by_vector(
  p_query text, -- JSON array as text until pgvector is enabled
  p_limit int default 10
)
returns table(
  response_id uuid,
  title text,
  survey_type text,
  created_at date,
  nps_score int,
  comment text,
  similarity numeric
)
language sql
stable
as $$
  select
    r.id as response_id,
    r.title,
    r.survey_type,
    r.created_at,
    r.nps_score,
    r.comment,
    0.0::numeric as similarity -- Placeholder until pgvector is enabled
  from nps_response r
  join nps_ai_enrichment e on e.response_id = r.id
  where e.embedded_vector is not null
  order by r.created_at desc -- Placeholder ordering until pgvector is enabled
  limit p_limit;
$$;

-- B. Similar to an existing response (by id)
create or replace function similar_responses_for_response(
  p_response_id uuid,
  p_limit int default 10
)
returns table(
  response_id uuid,
  title text,
  survey_type text,
  created_at date,
  nps_score int,
  comment text,
  similarity numeric
)
language sql
stable
as $$
  with q as (
    select embedded_vector
    from nps_ai_enrichment
    where response_id = p_response_id
  )
  select
    r.id as response_id,
    r.title,
    r.survey_type,
    r.created_at,
    r.nps_score,
    r.comment,
    0.0::numeric as similarity -- Placeholder until pgvector is enabled
  from nps_response r
  join nps_ai_enrichment e on e.response_id = r.id
  where e.embedded_vector is not null
    and r.id <> p_response_id
  order by r.created_at desc -- Placeholder ordering until pgvector is enabled
  limit p_limit;
$$;

-- 3. Performance indexes for trends and vector search
create index if not exists idx_resp_created_month on nps_response(date_trunc('month', created_at));
create index if not exists idx_resp_title on nps_response(title_text);
create index if not exists idx_resp_survey on nps_response(survey_name);

-- Vector similarity index (requires pgvector extension)
-- Note: This index needs to be created after pgvector extension is enabled
-- create index if not exists idx_enrich_vector on nps_ai_enrichment using ivfflat (embedded_vector vector_cosine) with (lists = 100);
