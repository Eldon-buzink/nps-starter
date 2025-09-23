-- Winners/Losers analysis with MoM moves and theme drivers
-- This file contains database objects for identifying top movers and their drivers

-- 1. Ensure we have the required view and function
-- Month-bucketed responses (Dutch-only dataset)
create or replace view v_nps_monthly as
select
  date_trunc('month', created_at)::date as month,
  title_text as title,
  survey_name as survey_type,
  nps_score
from nps_response
where created_at is not null;

-- 2. Ensure we have the required nps_trend_by_title_with_mom function
-- (This function should already exist from sql/005_trends.sql, but including it here for completeness)
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
  with base as (
    select *
    from v_nps_monthly
    where (p_start_date is null or month >= date_trunc('month', p_start_date))
      and (p_end_date   is null or month <= date_trunc('month', p_end_date))
      and (p_survey     is null or survey_type = p_survey)
      and (p_title      is null or title = p_title)
  ),
  agg as (
    select
      month,
      title,
      count(*)                                         as responses,
      round(((sum(case when nps_score >= 9 then 1 else 0 end)
           -  sum(case when nps_score <= 6 then 1 else 0 end)) * 100.0)
           / nullif(count(*),0), 1)                   as nps
    from base
    group by month, title
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

-- 3. RPC: Top MoM movers (Winners/Losers) for a given period
-- This function computes the last two available months within your filter window, 
-- then returns the top K up and top K down titles (by absolute MoM change).
-- It also requires a minimum response threshold so you don't highlight noise.
create or replace function top_title_mom_moves(
  p_start_date date default null,
  p_end_date   date default null,
  p_survey     text default null,
  p_min_responses int default 30,    -- minimum responses in the latest month
  p_top_k int default 5              -- how many up/down to return
)
returns table(
  month date,
  title text,
  responses int,
  nps numeric,
  mom_delta numeric,
  move text                         -- 'up' or 'down'
)
language sql
stable
as $$
  -- 1) compute MoM series
  with series as (
    select * from nps_trend_by_title_with_mom(p_start_date, p_end_date, p_survey, null)
  ),
  -- 2) focus on the latest month present in series
  latest as (
    select max(month) as latest_month from series
  ),
  latest_rows as (
    select s.*
    from series s
    join latest l on s.month = l.latest_month
    where s.responses >= p_min_responses     -- quality gate
  ),
  ranked_up as (
    select *
    from latest_rows
    where mom_delta is not null
    order by mom_delta desc, responses desc
    limit p_top_k
  ),
  ranked_down as (
    select *
    from latest_rows
    where mom_delta is not null
    order by mom_delta asc, responses desc
    limit p_top_k
  )
  -- 3) union winners and losers with a label
  select
    month, title, responses, nps, mom_delta, 'up'::text as move
  from ranked_up
  union all
  select
    month, title, responses, nps, mom_delta, 'down'::text as move
  from ranked_down
  order by move asc, mom_delta desc, title asc;
$$;

-- 4. RPC: Top drivers of change for a single title
-- This one explains why a title moved, by showing which themes grew/shrank 
-- (share change) between the latest month and previous month.
create or replace function title_theme_share_mom(
  p_title text,
  p_survey text default null
)
returns table(
  month date,
  theme text,
  count_responses bigint,
  share_pct numeric,
  mom_share_delta numeric
)
language sql
stable
as $$
  with base as (
    select
      t.title,
      t.theme,
      date_trunc('month', t.created_at)::date as month,
      t.response_id
    from v_nps_response_themes t
    where t.title = p_title
      and (p_survey is null or t.survey_type = p_survey)
  ),
  counts as (
    select month, theme, count(distinct response_id) as cnt
    from base
    group by month, theme
  ),
  totals as (
    select month, sum(cnt) as total_cnt
    from counts
    group by month
  ),
  shares as (
    select
      c.month, c.theme, c.cnt as count_responses,
      case when t.total_cnt = 0 then 0
           else round(c.cnt::numeric * 100 / t.total_cnt, 2) end as share_pct
    from counts c
    join totals t using (month)
  )
  select
    s.month, s.theme, s.count_responses, s.share_pct,
    round(s.share_pct - lag(s.share_pct) over (partition by s.theme order by s.month), 2) as mom_share_delta
  from shares s
  order by s.month asc, s.theme asc;
$$;

-- 5. Additional indexes for performance (if not already created)
create index if not exists idx_resp_created      on nps_response(created_at);
create index if not exists idx_resp_title        on nps_response(title_text);
create index if not exists idx_resp_survey       on nps_response(survey_name);
create index if not exists idx_enrich_themes_gin on nps_ai_enrichment using gin (themes);
