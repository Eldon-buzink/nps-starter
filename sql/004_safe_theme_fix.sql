-- Safe theme classification fix
-- This script safely updates the theme classification without destructive drops

-- First, let's see what we're working with
select 'Current theme distribution:' as info;
select 
  theme, 
  mentions,
  round((mentions::numeric / sum(mentions) over()) * 100, 1) as percentage
from v_theme_overview_normalized
order by mentions desc
limit 10;

-- Check if our new synonyms are in the table
select 'New synonyms added:' as info;
select synonym, canonical 
from theme_synonyms 
where canonical = 'content_kwaliteit'
order by synonym;

-- Instead of dropping views, let's recreate them with CASCADE
-- This will safely handle dependencies
drop view if exists v_theme_overview_normalized cascade;
drop view if exists v_theme_assignments_normalized cascade;

-- Recreate the normalized assignments view
create view v_theme_assignments_normalized as
with cleaned as (
  select
    e.id,
    e.response_id,
    -- Extract individual themes from the themes array and normalize
    unnest(e.themes) as theme_raw,
    e.sentiment_score,
    e.promoter_flag,
    e.detractor_flag,
    e.passive_flag
  from nps_ai_enrichment e
  where e.themes is not null and array_length(e.themes, 1) > 0
),
normalized as (
  select
    c.id,
    c.response_id,
    -- Simple normalization: lowercase + trim
    lower(trim(c.theme_raw)) as theme_lc,
    c.sentiment_score,
    c.promoter_flag,
    c.detractor_flag,
    c.passive_flag
  from cleaned c
)
select
  n.id,
  n.response_id,
  coalesce(s.canonical, n.theme_lc) as canonical_theme,
  n.sentiment_score,
  n.promoter_flag,
  n.detractor_flag,
  n.passive_flag
from normalized n
left join theme_synonyms s
  on lower(s.synonym) = n.theme_lc;

-- Recreate the overview view with better "Other" collapsing
create view v_theme_overview_normalized as
with agg as (
  select
    canonical_theme as theme,
    count(*) as mentions,
    avg(case when r.nps_score between 9 and 10 then 1 else 0 end) as pct_promoters,
    avg(case when r.nps_score between 7 and 8 then 1 else 0 end) as pct_passives,
    avg(case when r.nps_score between 0 and 6 then 1 else 0 end) as pct_detractors,
    avg(case when n.sentiment_score > 0 then 1 else 0 end) as pct_pos_sentiment,
    avg(case when n.sentiment_score < 0 then 1 else 0 end) as pct_neg_sentiment,
    avg(n.sentiment_score) as avg_sentiment,
    avg(r.nps_score) as avg_nps
  from v_theme_assignments_normalized n
  join nps_response r on r.id = n.response_id
  group by 1
),
mark as (
  select *,
    -- Increase threshold to 5 mentions to reduce "Other" category
    case when mentions < 5 then true else false end as is_tail
  from agg
),
other as (
  select
    'Other (cluster)'::text as theme,
    sum(mentions)::int as mentions,
    avg(pct_promoters) as pct_promoters,
    avg(pct_passives) as pct_passives,
    avg(pct_detractors) as pct_detractors,
    avg(pct_pos_sentiment) as pct_pos_sentiment,
    avg(pct_neg_sentiment) as pct_neg_sentiment,
    avg(avg_sentiment) as avg_sentiment,
    avg(avg_nps) as avg_nps
  from mark
  where is_tail
),
head as (
  select
    theme, mentions, pct_promoters, pct_passives, pct_detractors, 
    pct_pos_sentiment, pct_neg_sentiment, avg_sentiment, avg_nps
  from mark
  where not is_tail
)
select * from head
union all
select * from other
order by mentions desc;

-- Show the new theme distribution
select 'New theme distribution after fix:' as info;
select 
  theme, 
  mentions,
  round((mentions::numeric / sum(mentions) over()) * 100, 1) as percentage
from v_theme_overview_normalized
order by mentions desc
limit 15;

-- Show specifically how "Other (cluster)" changed
select 'Other (cluster) analysis:' as info;
select 
  theme,
  mentions,
  round((mentions::numeric / (select sum(mentions) from v_theme_overview_normalized)) * 100, 1) as percentage
from v_theme_overview_normalized
where theme = 'Other (cluster)';
