-- Schéma initial : un utilisateur ne voit et ne modifie que ses propres données.

create table if not exists public.days (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day        text not null check (day ~ '^\d{4}-\d{2}-\d{2}$'),
  tasks      jsonb not null default '[]'::jsonb,   -- tâches, sous-tâches et tags du jour
  note       text  not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

create table if not exists public.settings (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  tags       jsonb not null default '[]'::jsonb,   -- liste des tags et couleurs
  prefs      jsonb not null default '{}'::jsonb,   -- thème, vue, jours affichés…
  updated_at timestamptz not null default now()
);

alter table public.days     enable row level security;
alter table public.settings enable row level security;

create policy "days: lecture perso"     on public.days     for select using (auth.uid() = user_id);
create policy "days: ajout perso"       on public.days     for insert with check (auth.uid() = user_id);
create policy "days: modification perso" on public.days    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "days: suppression perso" on public.days     for delete using (auth.uid() = user_id);

create policy "settings: lecture perso"      on public.settings for select using (auth.uid() = user_id);
create policy "settings: ajout perso"        on public.settings for insert with check (auth.uid() = user_id);
create policy "settings: modification perso" on public.settings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "settings: suppression perso"  on public.settings for delete using (auth.uid() = user_id);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger days_touch     before update on public.days     for each row execute function public.touch_updated_at();
create trigger settings_touch before update on public.settings for each row execute function public.touch_updated_at();
