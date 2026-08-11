-- CLEANUP STEP 2 of 2 — THE ACTUAL DELETE.
--
-- Run CLEANUP_STEP1_PREVIEW.sql first and read its verdict column.
--
-- Then paste this whole file in and press Run. NOTHING needs uncommenting.
-- It deletes only companies that are completely empty: no members, nobody
-- granted access to them, no subscription, no leads, no AI outputs, no social
-- posts. Anything holding a single row of real data is left alone.
--
-- There is no BEGIN/COMMIT here on purpose: the Supabase SQL Editor runs each
-- Run as its own transaction, so a single statement either fully applies or
-- fully fails. That removes the possibility of leaving a transaction half-open.
--
-- The RETURNING clause prints exactly which companies were removed.

delete from public.companies c
where (select count(*) from public.users u where u.company_id = c.id) = 0
  and (select count(*) from public.users u
         where c.id = any(coalesce(u.accessible_company_ids, '{}'::uuid[]))) = 0
  and (select count(*) from public.subscriptions s where s.company_id = c.id) = 0
  and (select count(*) from public.leads l where l.company_id = c.id) = 0
  and (select count(*) from public.ai_outputs o where o.company_id = c.id) = 0
  and (select count(*) from public.social_posts p where p.company_id = c.id) = 0
returning id, name, created_at;
