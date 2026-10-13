-- Garaż: auta, terminy (OC, przegląd, olej, opony, inne), historia serwisu i tankowania.
-- Osobny schemat `garage` w tej samej bazie i na tym samym koncie co Nawyki i Finanse.
-- Kwoty w groszach (bigint), daty = dzień lokalny, RLS na każdej tabeli.

create schema if not exists garage;

create type garage.fuel_type as enum ('petrol', 'diesel', 'lpg', 'hybrid', 'electric');
create type garage.term_kind as enum ('insurance', 'inspection', 'oil', 'winter_tires', 'summer_tires', 'other');

-- ============ TABELE ============
create table garage.settings (
  user_id      uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  timezone     text not null default 'Europe/Warsaw',
  notify_time  time not null default '09:00',
  created_at   timestamptz not null default now()
);

create table garage.cars (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 40),
  make         text check (char_length(make) <= 40),
  model        text check (char_length(model) <= 40),
  year         smallint check (year between 1950 and 2100),
  plate        text check (char_length(plate) <= 12),
  fuel         garage.fuel_type not null default 'petrol',
  odometer_km  integer check (odometer_km >= 0),
  sort_order   integer not null default 0,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  unique (id, user_id)
);

-- Termin: data i/lub przebieg, po wykonaniu przesuwa się o interwał.
-- anchor = 'due': następny liczony od poprzedniego terminu (OC, opony);
-- anchor = 'done': od dnia wykonania (przegląd, olej).
create table garage.terms (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  car_id           uuid not null,
  kind             garage.term_kind not null,
  title            text check (char_length(btrim(title)) between 1 and 60),
  due_on           date,
  due_km           integer check (due_km >= 0),
  interval_months  smallint check (interval_months between 1 and 120),
  interval_km      integer check (interval_km between 100 and 200000),
  anchor           text not null default 'done' check (anchor in ('due', 'done')),
  notify_days      smallint not null default 14 check (notify_days between 0 and 120),
  last_done_on     date,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  foreign key (car_id, user_id) references garage.cars (id, user_id) on delete cascade,
  check (kind <> 'other' or title is not null),
  check (due_on is not null or due_km is not null)
);

-- Historia: wykonane terminy, naprawy, inne wydatki na auto
create table garage.services (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  car_id        uuid not null,
  done_on       date not null,
  kinds         garage.term_kind[] not null default '{}',
  title         text not null check (char_length(btrim(title)) between 1 and 80),
  odometer_km   integer check (odometer_km >= 0),
  cost_minor    bigint check (cost_minor >= 0),
  note          text check (char_length(note) <= 1000),
  created_at    timestamptz not null default now(),
  foreign key (car_id, user_id) references garage.cars (id, user_id) on delete cascade
);

create table garage.fuel_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  car_id        uuid not null,
  filled_on     date not null,
  odometer_km   integer not null check (odometer_km >= 0),
  liters        numeric(7,2) not null check (liters > 0 and liters < 1000),
  amount_minor  bigint not null check (amount_minor > 0),
  full_tank     boolean not null default true,
  station       text check (char_length(station) <= 60),
  receipt_path  text check (char_length(receipt_path) <= 200),
  created_at    timestamptz not null default now(),
  foreign key (car_id, user_id) references garage.cars (id, user_id) on delete cascade
);

create index terms_car_idx      on garage.terms (car_id);
create index terms_user_due_idx on garage.terms (user_id, due_on) where active;
create index terms_user_idx     on garage.terms (user_id);
create index services_car_idx   on garage.services (car_id, done_on);
create index services_user_idx  on garage.services (user_id);
create index fuel_car_idx       on garage.fuel_logs (car_id, odometer_km);
create index fuel_user_idx      on garage.fuel_logs (user_id);
create index cars_user_idx      on garage.cars (user_id);

-- ============ RLS ============
alter table garage.settings  enable row level security;
alter table garage.cars      enable row level security;
alter table garage.terms     enable row level security;
alter table garage.services  enable row level security;
alter table garage.fuel_logs enable row level security;

-- Jedno miejsce na regułę dostępu (później: auta współdzielone z rodziną)
create function garage.can_access(p_user_id uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
  select p_user_id = (select auth.uid())
$$;

create policy own_rows on garage.settings  for all to authenticated using (garage.can_access(user_id)) with check (garage.can_access(user_id));
create policy own_rows on garage.cars      for all to authenticated using (garage.can_access(user_id)) with check (garage.can_access(user_id));
create policy own_rows on garage.terms     for all to authenticated using (garage.can_access(user_id)) with check (garage.can_access(user_id));
create policy own_rows on garage.services  for all to authenticated using (garage.can_access(user_id)) with check (garage.can_access(user_id));
create policy own_rows on garage.fuel_logs for all to authenticated using (garage.can_access(user_id)) with check (garage.can_access(user_id));

-- ============ TRIGGERY ============
-- Przebieg auta = największy znany (z tankowań i serwisu)
create function garage.bump_odometer() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.odometer_km is not null then
    update garage.cars set odometer_km = greatest(coalesce(odometer_km, 0), new.odometer_km) where id = new.car_id;
  end if;
  return new;
end $$;

create trigger services_odometer after insert or update of odometer_km on garage.services
  for each row execute function garage.bump_odometer();
create trigger fuel_odometer after insert or update of odometer_km on garage.fuel_logs
  for each row execute function garage.bump_odometer();

-- ============ FUNKCJE (RPC) ============
create function garage.bootstrap() returns void
language sql security invoker set search_path = '' as $$
  insert into garage.settings (user_id) values ((select auth.uid())) on conflict (user_id) do nothing;
$$;

-- Wykonanie terminu (i opcjonalnie innych tego auta, np. olej przy przeglądzie):
-- wpis w historii + przesunięcie terminów. p_id nadaje klient: powtórka (offline) nic nie dubluje.
create function garage.complete_terms(
  p_id uuid, p_term_ids uuid[], p_done_on date, p_odometer_km integer default null,
  p_cost_minor bigint default null, p_note text default null, p_title text default null
) returns garage.services
language plpgsql security invoker set search_path = '' as $$
declare
  v_service garage.services;
  v_car uuid;
  v_kinds garage.term_kind[];
  v_title text;
begin
  select * into v_service from garage.services where id = p_id;
  if found then return v_service; end if;

  if coalesce(array_length(p_term_ids, 1), 0) = 0 then
    raise exception 'no_terms' using errcode = '22023';
  end if;
  select min(t.car_id::text)::uuid, array_agg(distinct t.kind)
    into v_car, v_kinds
    from garage.terms t where t.id = any(p_term_ids);
  if v_car is null or (select count(*) from garage.terms t where t.id = any(p_term_ids)) <> array_length(p_term_ids, 1) then
    raise exception 'term_not_found' using errcode = 'P0002';
  end if;
  if (select count(distinct t.car_id) from garage.terms t where t.id = any(p_term_ids)) > 1 then
    raise exception 'terms_of_different_cars' using errcode = '22023';
  end if;

  v_title := coalesce(nullif(btrim(p_title), ''),
    (select string_agg(case t.kind
        when 'insurance' then 'OC'
        when 'inspection' then 'Przegląd'
        when 'oil' then 'Wymiana oleju'
        when 'winter_tires' then 'Opony zimowe'
        when 'summer_tires' then 'Opony letnie'
        else t.title end, ' + ' order by t.kind)
     from garage.terms t where t.id = any(p_term_ids)));

  insert into garage.services (id, car_id, done_on, kinds, title, odometer_km, cost_minor, note)
  values (p_id, v_car, p_done_on, v_kinds, v_title, p_odometer_km, p_cost_minor, nullif(btrim(p_note), ''))
  returning * into v_service;

  update garage.terms t set
    last_done_on = p_done_on,
    due_on = case
      when t.interval_months is null then t.due_on
      when t.anchor = 'due' and t.due_on is not null then (t.due_on + make_interval(months => t.interval_months))::date
      else (p_done_on + make_interval(months => t.interval_months))::date
    end,
    due_km = case
      when t.interval_km is not null and p_odometer_km is not null then p_odometer_km + t.interval_km
      else t.due_km
    end,
    -- termin jednorazowy (bez interwału) po wykonaniu znika z listy
    active = (t.interval_months is not null or (t.interval_km is not null and p_odometer_km is not null))
  where t.id = any(p_term_ids);

  return v_service;
end $$;

-- ============ UPRAWNIENIA ============
grant usage on schema garage to authenticated, service_role;
grant select, insert, update, delete on all tables in schema garage to authenticated;
grant all on all tables in schema garage to service_role;
grant usage on all sequences in schema garage to authenticated, service_role;
grant execute on all functions in schema garage to authenticated, service_role;
