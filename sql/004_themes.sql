-- Themes analysis views and functions
-- This file contains database objects for theme analysis

-- 1. Helper view: explode themes per response
-- One row per (response_id, theme)
create or replace view v_nps_response_themes as
with exploded as (
  select
    r.id as response_id,
    r.created_at,
    r.survey_name as survey_type,
    r.title_text as title,
    r.nps_score,
    e.sentiment,
    e.themes
  from nps_response r
  join nps_ai_enrichment e on e.response_id = r.id
  where e.themes is not null
)
select
  response_id,
  created_at,
  survey_type,
  title,
  nps_score,
  sentiment,
  unnest(themes) as theme
from exploded;

-- 2. RPC: themes_aggregate (filters + metrics)
-- Aggregates per theme with optional filters.
-- Pass NULL to skip a filter.
-- nps_bucket: 'promoter' | 'passive' | 'detractor' | NULL
create or replace function themes_aggregate(
  p_start_date date default null,
  p_end_date   date default null,
  p_survey     text default null,
  p_title      text default null,
  p_nps_bucket text default null
)
returns table(
  theme text,
  count_responses bigint,
  share_pct numeric,
  avg_sentiment numeric,
  avg_nps numeric
)
language sql
stable
as $$
  with base as (
    select *
    from v_nps_response_themes t
    where (p_start_date is null or t.created_at >= p_start_date)
      and (p_end_date   is null or t.created_at <  p_end_date + interval '1 day')
      and (p_survey     is null or t.survey_type = p_survey)
      and (p_title      is null or t.title = p_title)
      and (
        p_nps_bucket is null
        or (p_nps_bucket = 'promoter'  and t.nps_score >= 9)
        or (p_nps_bucket = 'passive'   and t.nps_score between 7 and 8)
        or (p_nps_bucket = 'detractor' and t.nps_score <= 6)
      )
  ),
  by_theme as (
    select
      theme,
      count(distinct response_id) as count_responses,     -- count unique responses mentioning theme
      avg(nullif(sentiment, null)) as avg_sentiment,      -- ignores null sentiment
      avg(nps_score::numeric) as avg_nps
    from base
    group by theme
  ),
  totals as (
    select sum(count_responses) as total_cnt from by_theme
  )
  select
    bt.theme,
    bt.count_responses,
    case when coalesce(t.total_cnt,0) = 0 then 0
         else round( (bt.count_responses::numeric * 100) / t.total_cnt, 1)
    end as share_pct,
    round(bt.avg_sentiment::numeric, 3) as avg_sentiment,
    round(bt.avg_nps::numeric, 1)       as avg_nps
  from by_theme bt
  cross join totals t
  order by bt.count_responses desc, bt.theme asc;
$$;

-- 3. RPC for Promoters vs Detractors per theme
-- Handy for comparison bar chart
create or replace function themes_promoter_detractor(
  p_start_date date default null,
  p_end_date   date default null,
  p_survey     text default null,
  p_title      text default null
)
returns table(
  theme text,
  promoters bigint,
  detractors bigint
)
language sql
stable
as $$
  with base as (
    select *
    from v_nps_response_themes t
    where (p_start_date is null or t.created_at >= p_start_date)
      and (p_end_date   is null or t.created_at <  p_end_date + interval '1 day')
      and (p_survey     is null or t.survey_type = p_survey)
      and (p_title      is null or t.title = p_title)
  )
  select
    theme,
    count(distinct case when nps_score >= 9 then response_id end) as promoters,
    count(distinct case when nps_score <= 6 then response_id end) as detractors
  from base
  group by theme
  order by (promoters + detractors) desc, theme asc;
$$;

-- 4. Performance indexes
create index if not exists idx_resp_created      on nps_response(created_at);
create index if not exists idx_resp_title        on nps_response(title_text);
create index if not exists idx_resp_survey       on nps_response(survey_name);
create index if not exists idx_enrich_themes_gin on nps_ai_enrichment using gin (themes);
