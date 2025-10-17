-- Dynamic themes normalization with synonym mapping and "Other (cluster)" collapsing
-- This script creates views to normalize AI-discovered themes and collapse the long tail

-- Synonym map table for theme normalization
create table if not exists theme_synonyms (
  id bigserial primary key,
  synonym text not null,
  canonical text not null,
  constraint uniq_syn unique (synonym)
);

-- Seed common synonyms for Dutch NPS feedback
insert into theme_synonyms(synonym, canonical)
values
  -- Pricing related
  ('prijs','pricing'),
  ('pricing','pricing'),
  ('te duur','pricing'),
  ('duur','pricing'),
  ('korting','pricing'),
  ('prijzen','pricing'),
  ('kosten','pricing'),
  ('abonnement','pricing'),
  ('subscription','pricing'),

  -- Delivery/Shipping related
  ('levering','bezorging'),
  ('delivery','bezorging'),
  ('bezorging','bezorging'),
  ('verzending','bezorging'),
  ('shipping','bezorging'),
  ('laat','bezorging'),
  ('vertraging','bezorging'),

  -- Support/Service related
  ('support','klantenservice'),
  ('klantenservice','klantenservice'),
  ('service','klantenservice'),
  ('helpdesk','klantenservice'),
  ('hulp','klantenservice'),
  ('assistentie','klantenservice'),

  -- Technical/Stability related
  ('bug','stability'),
  ('crash','stability'),
  ('performance','stability'),
  ('traag','stability'),
  ('langzaam','stability'),
  ('stabiliteit','stability'),
  ('technisch','stability'),

  -- UX/Usability related
  ('gebruiksvriendelijkheid','app_ux'),
  ('usability','app_ux'),
  ('ui','app_ux'),
  ('design','app_ux'),
  ('navigatie','app_ux'),
  ('interface','app_ux'),
  ('gebruik','app_ux'),

  -- Content Quality related
  ('content','content_kwaliteit'),
  ('kwaliteit','content_kwaliteit'),
  ('inhoud','content_kwaliteit'),
  ('artikelen','content_kwaliteit'),
  ('verhalen','content_kwaliteit'),
  ('journalistiek','content_kwaliteit'),
  ('nieuws','content_kwaliteit'),
  ('actualiteit','content_kwaliteit'),
  ('lokaal nieuws','content_kwaliteit'),
  ('limited local news','content_kwaliteit'),
  ('politieke bias','content_kwaliteit'),
  ('political bias','content_kwaliteit'),
  ('bias','content_kwaliteit'),
  ('objectiviteit','content_kwaliteit'),
  ('onpartijdigheid','content_kwaliteit'),
  ('verslaggeving','content_kwaliteit'),
  ('reportage','content_kwaliteit'),
  ('artikel kwaliteit','content_kwaliteit'),
  ('quality of articles','content_kwaliteit'),
  ('kwaliteit artikelen','content_kwaliteit'),
  ('redactie','content_kwaliteit'),
  ('schrijven','content_kwaliteit'),
  ('schrijfstijl','content_kwaliteit'),
  ('diepgang','content_kwaliteit'),
  ('onderzoek','content_kwaliteit'),
  ('feiten','content_kwaliteit'),
  ('waarheidsgetrouwheid','content_kwaliteit'),

  -- Brand Trust related
  ('vertrouwen','merkvertrouwen'),
  ('betrouwbaarheid','merkvertrouwen'),
  ('reputatie','merkvertrouwen'),
  ('geloofwaardigheid','merkvertrouwen'),

  -- Other/Miscellaneous
  ('overige','overige'),
  ('anders','overige'),
  ('misc','overige')
on conflict (synonym) do nothing;

-- Helper view: normalized themes from nps_ai_enrichment
create or replace view v_theme_assignments_normalized as
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

-- Aggregated overview with "other" collapsing
-- Threshold: themes with < 3 mentions go into "Other (cluster)"
create or replace view v_theme_overview_normalized as
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
    case when mentions < 3 then true else false end as is_tail
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
order by mentions desc nulls last;

-- View to get the breakdown of "Other (cluster)" contents
create or replace view v_other_breakdown as
with agg as (
  select
    canonical_theme as theme,
    count(*) as mentions
  from v_theme_assignments_normalized
  group by 1
)
select theme, mentions
from agg
where mentions < 3
order by mentions desc, theme asc;

-- Grant permissions for the views to be accessible by the frontend
grant select on theme_synonyms to anon, authenticated;
grant select on v_theme_assignments_normalized to anon, authenticated;
grant select on v_theme_overview_normalized to anon, authenticated;
grant select on v_other_breakdown to anon, authenticated;
