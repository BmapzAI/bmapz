-- 022: Make GDPR / platform data-deletion requests actionable
--
-- data_deletion_requests has existed since 001 and the public endpoint stores
-- rows, but nothing ever displayed or actioned them — requests arrived into a
-- void. Platform review (Meta requires a working data deletion callback) and
-- GDPR both need a real, auditable outcome per request.

alter table public.data_deletion_requests
  add column if not exists handled_by text,
  add column if not exists handled_at timestamptz,
  add column if not exists deletion_report jsonb,
  add column if not exists notes text;

-- 'rejected' is a legitimate outcome (e.g. no matching data, or the requester
-- could not be verified) and the original CHECK constraint did not allow it.
alter table public.data_deletion_requests
  drop constraint if exists data_deletion_requests_status_check;

alter table public.data_deletion_requests
  add constraint data_deletion_requests_status_check
  check (status in ('pending', 'processing', 'completed', 'rejected'));

create index if not exists idx_ddr_status on public.data_deletion_requests(status);
create index if not exists idx_ddr_created on public.data_deletion_requests(created_at desc);

comment on column public.data_deletion_requests.deletion_report is
  'What was actually erased when the request was executed: counts per table plus the identifiers matched. Kept as the audit trail proving the request was honoured.';
