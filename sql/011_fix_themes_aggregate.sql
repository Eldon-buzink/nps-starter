-- Fix themes_aggregate to use normalized themes instead of raw AI themes
-- This ensures consistency between theme classification and sample quotes

-- Drop the old function
drop function if exists themes_aggregate(date, date, text, text, text);

-- Create new function using normalized themes
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
    select 
      tan.canonical_theme as theme,
      tan.response_id,
      r.created_at,
      r.survey_name as survey_type,
      r.title_text as title,
      r.nps_score,
      e.sentiment_score as sentiment
    from v_theme_assignments_normalized tan
    join nps_response r on r.id = tan.response_id
    join nps_ai_enrichment e on e.response_id = r.id
    where (p_start_date is null or r.created_at >= p_start_date)
      and (p_end_date   is null or r.created_at <  p_end_date + interval '1 day')
      and (p_survey     is null or r.survey_name = p_survey)
      and (p_title      is null or r.title_text = p_title)
      and (
        p_nps_bucket is null
        or (p_nps_bucket = 'promoter'  and r.nps_score >= 9)
        or (p_nps_bucket = 'passive'   and r.nps_score between 7 and 8)
        or (p_nps_bucket = 'detractor' and r.nps_score <= 6)
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
