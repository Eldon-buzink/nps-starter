-- Simple theme reclassification for "Other" category
-- This script directly updates themes based on response content

-- First, let's see the current state
select 'BEFORE: Current overige count:' as info;
select count(*) as overige_count
from nps_ai_enrichment 
where 'overige' = ANY(themes);

-- Update themes that should be content_kwaliteit
-- Look for responses that contain content-related keywords
update nps_ai_enrichment 
set themes = array_replace(themes, 'overige', 'content_kwaliteit')
where 'overige' = ANY(themes)
  and response_id in (
    select id 
    from nps_response 
    where nps_explanation ilike '%nieuws%'
       or nps_explanation ilike '%artikel%'
       or nps_explanation ilike '%kwaliteit%'
       or nps_explanation ilike '%inhoud%'
       or nps_explanation ilike '%journalistiek%'
       or nps_explanation ilike '%bias%'
       or nps_explanation ilike '%objectiviteit%'
       or nps_explanation ilike '%verslaggeving%'
       or nps_explanation ilike '%lokaal%'
       or nps_explanation ilike '%regionaal%'
       or nps_explanation ilike '%politiek%'
       or nps_explanation ilike '%actualiteit%'
       or nps_explanation ilike '%krant%'
       or nps_explanation ilike '%magazine%'
       or nps_explanation ilike '%content%'
       or nps_explanation ilike '%redactie%'
       or nps_explanation ilike '%schrijven%'
       or nps_explanation ilike '%diepgang%'
       or nps_explanation ilike '%onderzoek%'
       or nps_explanation ilike '%feiten%'
       or nps_explanation ilike '%waarheidsgetrouwheid%'
  );

-- Show how many were updated for content
select 'Content kwaliteit updates:' as info;
select count(*) as updated_count
from nps_ai_enrichment 
where 'content_kwaliteit' = ANY(themes);

-- Update themes that should be bezorging (delivery)
update nps_ai_enrichment 
set themes = array_replace(themes, 'overige', 'bezorging')
where 'overige' = ANY(themes)
  and response_id in (
    select id 
    from nps_response 
    where nps_explanation ilike '%bezorging%'
       or nps_explanation ilike '%levering%'
       or nps_explanation ilike '%laat%'
       or nps_explanation ilike '%vertraging%'
       or nps_explanation ilike '%delivery%'
       or nps_explanation ilike '%verzending%'
       or nps_explanation ilike '%post%'
       or nps_explanation ilike '%bezorg%'
  );

-- Update themes that should be klantenservice (customer service)
update nps_ai_enrichment 
set themes = array_replace(themes, 'overige', 'klantenservice')
where 'overige' = ANY(themes)
  and response_id in (
    select id 
    from nps_response 
    where nps_explanation ilike '%klantenservice%'
       or nps_explanation ilike '%support%'
       or nps_explanation ilike '%hulp%'
       or nps_explanation ilike '%service%'
       or nps_explanation ilike '%helpdesk%'
       or nps_explanation ilike '%klantendienst%'
       or nps_explanation ilike '%assistentie%'
  );

-- Update themes that should be pricing
update nps_ai_enrichment 
set themes = array_replace(themes, 'overige', 'pricing')
where 'overige' = ANY(themes)
  and response_id in (
    select id 
    from nps_response 
    where nps_explanation ilike '%prijs%'
       or nps_explanation ilike '%duur%'
       or nps_explanation ilike '%kosten%'
       or nps_explanation ilike '%abonnement%'
       or nps_explanation ilike '%pricing%'
       or nps_explanation ilike '%euro%'
       or nps_explanation ilike '%€%'
  );

-- Update themes that should be app_ux (user experience)
update nps_ai_enrichment 
set themes = array_replace(themes, 'overige', 'app_ux')
where 'overige' = ANY(themes)
  and response_id in (
    select id 
    from nps_response 
    where nps_explanation ilike '%website%'
       or nps_explanation ilike '%app%'
       or nps_explanation ilike '%online%'
       or nps_explanation ilike '%digitale%'
       or nps_explanation ilike '%gebruiksvriendelijk%'
       or nps_explanation ilike '%navigatie%'
       or nps_explanation ilike '%interface%'
       or nps_explanation ilike '%inloggen%'
       or nps_explanation ilike '%login%'
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
