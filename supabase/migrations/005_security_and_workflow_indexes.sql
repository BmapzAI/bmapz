-- Security advisor cleanup and indexes for the workflow/integration runtime.
-- This migration contains no customer data or secrets.

begin;

-- These functions are used by database triggers, not as public RPC endpoints.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to service_role;
alter function public.update_updated_at() set search_path = public;

-- Foreign-key indexes reported by the Supabase advisor, plus the due-run query
-- used by the background workflow worker.
create index if not exists idx_ai_outputs_company on public.ai_outputs(company_id);
create index if not exists idx_ai_outputs_lead on public.ai_outputs(lead_id);
create index if not exists idx_billing_purchases_company on public.billing_purchases(company_id);
create index if not exists idx_blog_posts_company on public.blog_posts(company_id);
create index if not exists idx_brand_scans_company on public.brand_scans(company_id);
create index if not exists idx_companies_account on public.companies(account_id);
create index if not exists idx_credit_transactions_company on public.credit_transactions(company_id);
create index if not exists idx_credit_transactions_subscription on public.credit_transactions(subscription_id);
create index if not exists idx_dashboard_configs_company on public.dashboard_configs(company_id);
create index if not exists idx_dashboard_configs_user on public.dashboard_configs(user_id);
create index if not exists idx_funnels_company on public.funnels(company_id);
create index if not exists idx_lead_lists_company on public.lead_lists(company_id);
create index if not exists idx_message_templates_company on public.message_templates(company_id);
create index if not exists idx_node_templates_company on public.node_templates(company_id);
create index if not exists idx_seo_analyses_company on public.seo_analyses(company_id);
create index if not exists idx_users_account on public.users(account_id);
create index if not exists idx_workflow_runs_company on public.workflow_runs(company_id);
create index if not exists idx_workflow_runs_workflow on public.workflow_runs(workflow_id);
create index if not exists idx_workflow_runs_lead on public.workflow_runs(lead_id);
create index if not exists idx_workflows_company on public.workflows(company_id);
create index if not exists idx_workflows_created_by on public.workflows(created_by);
create index if not exists idx_workflow_runs_due on public.workflow_runs(status, next_action_at);

commit;
