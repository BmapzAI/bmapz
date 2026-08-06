-- Clean up the empty companies created during the migration-021 outage.
--
-- WHY THEY EXIST: GET /api/auth/me auto-provisions a company when it thinks the
-- user has none. It ignored query errors, so while the users lookup was broken
-- every retry minted another empty "…'s Workspace". The backend fix (idempotency
-- guard + no provisioning on a failed lookup) is already deployed, so no NEW
-- ones can appear — this only removes the ones already created.
--
-- ============================================================================
-- STEP 1 — PREVIEW. Run this ALONE first and read the output.
-- Nothing is deleted by this step.
-- ============================================================================

select
  c.id,
  c.name,
  c.created_at,
  (select count(*) from public.users u where u.company_id = c.id)                     as users,
  (select count(*) from public.users u where c.id = any(coalesce(u.accessible_company_ids,'{}'::uuid[]))) as granted_access,
  (select count(*) from public.subscriptions s where s.company_id = c.id)             as subs,
  (select count(*) from public.leads l where l.company_id = c.id)                     as leads,
  (select count(*) from public.ai_outputs o where o.company_id = c.id)                as ai_outputs,
  (select count(*) from public.social_posts p where p.company_id = c.id)              as social_posts,
  case
    when (select count(*) from public.users u where u.company_id = c.id) = 0
     and (select count(*) from public.subscriptions s where s.company_id = c.id) = 0
     and (select count(*) from public.leads l where l.company_id = c.id) = 0
     and (select count(*) from public.ai_outputs o where o.company_id = c.id) = 0
     and (select count(*) from public.social_posts p where p.company_id = c.id) = 0
    then 'SAFE TO DELETE — completely empty'
    else 'KEEP — has data or members'
  end as verdict
from public.companies c
order by verdict desc, c.created_at desc;

-- ============================================================================
-- STEP 2 — DELETE. Only run this after reviewing STEP 1.
-- It deletes ONLY companies that are completely empty: no users, nobody granted
-- access to them, no subscription, no leads, no AI outputs, no social posts.
-- Anything with a single row of real data is left alone.
-- ============================================================================

-- begin;
--
-- delete from public.companies c
-- where (select count(*) from public.users u where u.company_id = c.id) = 0
--   and (select count(*) from public.users u where c.id = any(coalesce(u.accessible_company_ids,'{}'::uuid[]))) = 0
--   and (select count(*) from public.subscriptions s where s.company_id = c.id) = 0
--   and (select count(*) from public.leads l where l.company_id = c.id) = 0
--   and (select count(*) from public.ai_outputs o where o.company_id = c.id) = 0
--   and (select count(*) from public.social_posts p where p.company_id = c.id) = 0;
--
-- -- Check the count looks right BEFORE committing. If it does not, run: rollback;
-- commit;

-- ============================================================================
-- STEP 3 — confirm what is left.
-- ============================================================================
-- select count(*) as companies_remaining from public.companies;
