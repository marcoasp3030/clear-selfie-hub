create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (char_length(first_name) between 1 and 100),
  last_name text not null check (char_length(last_name) between 1 and 100),
  phone text not null check (char_length(phone) between 8 and 20),
  photo_path text not null,
  created_at timestamptz not null default now()
);

alter table public.registrations enable row level security;

create policy "Public can insert registrations"
on public.registrations
for insert
to anon, authenticated
with check (true);

insert into storage.buckets (id, name, public)
values ('registration-photos', 'registration-photos', false)
on conflict (id) do nothing;

create policy "Public can upload registration photos"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'registration-photos');