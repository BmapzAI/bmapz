-- CLEANUP STEP 1 of 2 — PREVIEW ONLY. Nothing is deleted by this file.
--
-- Paste this whole file into the Supabase SQL Editor and press Run.
-- Read the `verdict` column in the results before running STEP 2.

select
  c.id,
  c.name,
  c.created_at,
  (select count(*) from public.users u where u.company_id = c.id)          as users,
  (select count(*) from public.subscriptions s where s.company_id = c.id)  as subs,
  (select count(*) from public.leads l where l.company_id = c.id)          as leads,
  (select count(*) from public.ai_outputs o where o.company_id = c.id)     as ai_outputs,
  (select count(*) from public.social_posts p where p.company_id = c.id)   as social_posts,
  case
    when (select count(*) from public.users u where u.company_id = c.id) = 0
     and (select count(*) from public.users u
            where c.id = any(coalesce(u.accessible_company_ids, '{}'::uuid[]))) = 0
     and (select count(*) from public.subscriptions s where s.company_id = c.id) = 0
     and (select count(*) from public.leads l where l.company_id = c.id) = 0
     and (select count(*) from public.ai_outputs o where o.company_id = c.id) = 0
     and (select count(*) from public.social_posts p where p.company_id = c.id) = 0
    then 'SAFE TO DELETE - completely empty'
    else 'KEEP - has data or members'
  end as verdict
from public.companies c
order by verdict asc, c.created_at desc;
