create table if not exists public.camera_diagnostics_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  likely_cause text,
  results jsonb not null,
  platform text,
  browser text,
  in_app_browser boolean not null default false,
  in_iframe boolean not null default false,
  is_secure_context boolean not null default true,
  device_id uuid,
  user_agent text
);

create index if not exists camera_diagnostics_reports_created_at_idx
  on public.camera_diagnostics_reports (created_at desc);
create index if not exists camera_diagnostics_reports_likely_cause_idx
  on public.camera_diagnostics_reports (likely_cause);

alter table public.camera_diagnostics_reports enable row level security;

create policy "Anyone can submit diagnostics reports"
  on public.camera_diagnostics_reports
  for insert
  to anon, authenticated
  with check (true);

create policy "Admins can view diagnostics reports"
  on public.camera_diagnostics_reports
  for select
  to authenticated
  using (public.is_admin());

create policy "Admins can delete diagnostics reports"
  on public.camera_diagnostics_reports
  for delete
  to authenticated
  using (public.is_admin());