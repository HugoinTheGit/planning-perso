-- Jeton de renouvellement Google (jamais lisible depuis le navigateur : aucune policy, seule la clé service y accède)
create table if not exists public.google_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);
alter table public.google_tokens enable row level security;
