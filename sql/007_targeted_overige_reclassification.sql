-- Targeted reclassification for remaining "overige" responses
-- This script targets specific patterns found in the remaining 28.8% of "overige" responses

-- First, let's see the current state
select 'BEFORE: Current overige count:' as info;
select count(*) as overige_count
from nps_ai_enrichment 
where 'overige' = ANY(themes);

-- Update themes that should be content_kwaliteit (content quality)
-- Target: informational, news quality, objectivity, reporting quality
update nps_ai_enrichment 
set themes = array_replace(themes, 'overige', 'content_kwaliteit')
where 'overige' = ANY(themes)
  and response_id in (
    select id 
    from nps_response 
    where nps_explanation ilike '%actuele informatie%'
       or nps_explanation ilike '%degelijke informatie%'
       or nps_explanation ilike '%goede informatie%'
       or nps_explanation ilike '%informatief%'
       or nps_explanation ilike '%betrouwbaar%'
       or nps_explanation ilike '%berichtgeving%'
       or nps_explanation ilike '%objectief%'
       or nps_explanation ilike '%duiding%'
       or nps_explanation ilike '%regio%'
       or nps_explanation ilike '%columnisten%'
       or nps_explanation ilike '%progressief%'
       or nps_explanation ilike '%voeten op de grond%'
       or nps_explanation ilike '%fijne informatie%'
       or nps_explanation ilike '%goed berichtgeving%'
  );

-- Update themes that should be tevredenheid (satisfaction)
-- Target: general satisfaction, positive feelings
update nps_ai_enrichment 
set themes = array_replace(themes, 'overige', 'tevredenheid')
where 'overige' = ANY(themes)
  and response_id in (
    select id 
    from nps_response 
    where nps_explanation ilike '%leest aangenaam%'
       or nps_explanation ilike '%leuk blad%'
       or nps_explanation ilike '%tevreden%'
       or nps_explanation ilike '%is goed%'
       or nps_explanation ilike '%prima blad%'
       or nps_explanation ilike '%heel tevreden%'
       or nps_explanation ilike '%goed%'
       or nps_explanation ilike '%leuk%'
       or nps_explanation ilike '%aangenaam%'
  );

-- Update themes that should be aanbeveling (recommendation)
-- Target: recommendation-related responses
update nps_ai_enrichment 
set themes = array_replace(themes, 'overige', 'aanbeveling')
where 'overige' = ANY(themes)
  and response_id in (
    select id 
    from nps_response 
    where nps_explanation ilike '%beveel%'
       or nps_explanation ilike '%aanbevolen%'
       or nps_explanation ilike '%adviseer%'
       or nps_explanation ilike '%bepalen%'
       or nps_explanation ilike '%keuze%'
       or nps_explanation ilike '%zelf%'
       or nps_explanation ilike '%iedereen%'
       or nps_explanation ilike '%niemand%'
  );

-- Update themes that should be content_kwaliteit (regional content)
-- Target: regional, local content references
update nps_ai_enrichment 
set themes = array_replace(themes, 'overige', 'content_kwaliteit')
where 'overige' = ANY(themes)
  and response_id in (
    select id 
    from nps_response 
    where nps_explanation ilike '%weekendeditie%'
       or nps_explanation ilike '%inwoners%'
       or nps_explanation ilike '%regio%'
       or nps_explanation ilike '%lokaal%'
       or nps_explanation ilike '%regionaal%'
  );

-- Update themes that should be content_kwaliteit (puzzle/entertainment content)
-- Target: puzzles, TV programs, entertainment content
update nps_ai_enrichment 
set themes = array_replace(themes, 'overige', 'content_kwaliteit')
where 'overige' = ANY(themes)
  and response_id in (
    select id 
    from nps_response 
    where nps_explanation ilike '%puzzels%'
       or nps_explanation ilike '%tv programma%'
       or nps_explanation ilike '%helemaal%'
       or nps_explanation ilike '%weekend%'
       or nps_explanation ilike '%magazine%'
  );

-- Show the results
select 'AFTER: Updated theme distribution:' as info;
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
select 'AFTER: Overige theme analysis:' as info;
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
