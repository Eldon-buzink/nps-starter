-- Direct theme reclassification for "Other" category
-- This script directly updates the nps_ai_enrichment table to reclassify themes

-- First, let's see what themes are currently in the "overige" category
select 'Current overige themes:' as info;
select 
  themes,
  count(*) as count
from nps_ai_enrichment 
where 'overige' = ANY(themes)
group by themes
order by count desc
limit 10;

-- Update themes that should be content_kwaliteit
-- Look for themes that contain content-related keywords
update nps_ai_enrichment 
set themes = array_replace(themes, 'overige', 'content_kwaliteit')
where 'overige' = ANY(themes)
  and response_id in (
    select r.id 
    from nps_response r
    where r.nps_explanation ilike '%nieuws%'
       or r.nps_explanation ilike '%artikel%'
       or r.nps_explanation ilike '%kwaliteit%'
       or r.nps_explanation ilike '%inhoud%'
       or r.nps_explanation ilike '%journalistiek%'
       or r.nps_explanation ilike '%bias%'
       or r.nps_explanation ilike '%objectiviteit%'
       or r.nps_explanation ilike '%verslaggeving%'
       or r.nps_explanation ilike '%lokaal%'
       or r.nps_explanation ilike '%regionaal%'
       or r.nps_explanation ilike '%politiek%'
       or r.nps_explanation ilike '%actualiteit%'
  );

-- Update themes that should be bezorging (delivery)
update nps_ai_enrichment 
set themes = array_replace(themes, 'overige', 'bezorging')
where 'overige' = ANY(themes)
  and response_id in (
    select r.id 
    from nps_response r
    where r.nps_explanation ilike '%bezorging%'
       or r.nps_explanation ilike '%levering%'
       or r.nps_explanation ilike '%laat%'
       or r.nps_explanation ilike '%vertraging%'
       or r.nps_explanation ilike '%delivery%'
       or r.nps_explanation ilike '%verzending%'
  );

-- Update themes that should be klantenservice (customer service)
update nps_ai_enrichment 
set themes = array_replace(themes, 'overige', 'klantenservice')
where 'overige' = ANY(themes)
  and response_id in (
    select r.id 
    from nps_response r
    where r.nps_explanation ilike '%klantenservice%'
       or r.nps_explanation ilike '%support%'
       or r.nps_explanation ilike '%hulp%'
       or r.nps_explanation ilike '%service%'
       or r.nps_explanation ilike '%helpdesk%'
  );

-- Update themes that should be pricing
update nps_ai_enrichment 
set themes = array_replace(themes, 'overige', 'pricing')
where 'overige' = ANY(themes)
  and response_id in (
    select r.id 
    from nps_response r
    where r.nps_explanation ilike '%prijs%'
       or r.nps_explanation ilike '%duur%'
       or r.nps_explanation ilike '%kosten%'
       or r.nps_explanation ilike '%abonnement%'
       or r.nps_explanation ilike '%pricing%'
  );

-- Show the results
select 'Updated theme distribution:' as info;
select 
  theme,
  count(*) as mentions,
  round((count(*)::numeric / sum(count(*)) over()) * 100, 1) as percentage
from (
  select unnest(themes) as theme
  from nps_ai_enrichment
) t
group by theme
order by mentions desc
limit 15;

-- Show specifically how "overige" changed
select 'Overige theme analysis:' as info;
select 
  theme,
  count(*) as mentions,
  round((count(*)::numeric / (select count(*) from nps_ai_enrichment)) * 100, 1) as percentage
from (
  select unnest(themes) as theme
  from nps_ai_enrichment
) t
where theme = 'overige'
group by theme;
