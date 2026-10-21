-- Demandes d'accès envoyées depuis l'écran de connexion.
-- N'importe qui peut AJOUTER une demande (rôle anon), mais personne ne peut les LIRE depuis le site :
-- tu les consultes dans Supabase → Table Editor → access_requests.
create table if not exists public.access_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text not null check (length(email) between 5 and 200 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  name text check (length(name) <= 60),
  why text check (length(why) <= 120),
  usage text check (length(usage) <= 60),
  device text check (length(device) <= 60),
  message text check (length(message) <= 500),
  status text not null default 'nouvelle' check (status in ('nouvelle','ajouté','refusé'))
);

-- une seule demande par adresse
create unique index if not exists access_requests_email_key on public.access_requests (lower(email));

alter table public.access_requests enable row level security;

drop policy if exists "demande publique" on public.access_requests;
create policy "demande publique" on public.access_requests
  for insert to anon, authenticated
  with check (status = 'nouvelle');

grant insert on public.access_requests to anon, authenticated;
