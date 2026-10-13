-- complete_terms: po wykonaniu wymiar bez interwału (data albo przebieg) jest czyszczony,
-- żeby stary termin nie wisiał „po terminie” na zawsze; tytuł wpisu przycięty do 80 znaków.
-- Ta sama reguła co nextAfterDone w lib/domain/terms.ts.

create or replace function garage.complete_terms(
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

  v_title := left(coalesce(nullif(btrim(p_title), ''),
    (select string_agg(case t.kind
        when 'insurance' then 'OC'
        when 'inspection' then 'Przegląd'
        when 'oil' then 'Wymiana oleju'
        when 'winter_tires' then 'Opony zimowe'
        when 'summer_tires' then 'Opony letnie'
        else t.title end, ' + ' order by t.kind)
     from garage.terms t where t.id = any(p_term_ids))), 80);

  insert into garage.services (id, car_id, done_on, kinds, title, odometer_km, cost_minor, note)
  values (p_id, v_car, p_done_on, v_kinds, v_title, p_odometer_km, p_cost_minor, nullif(btrim(p_note), ''))
  returning * into v_service;

  with calc as (
    select t.id,
      case
        when t.interval_months is null then t.due_on
        when t.anchor = 'due' and t.due_on is not null then (t.due_on + make_interval(months => t.interval_months))::date
        else (p_done_on + make_interval(months => t.interval_months))::date
      end as next_on,
      case
        when t.interval_km is not null and p_odometer_km is not null then p_odometer_km + t.interval_km
        else t.due_km
      end as next_km,
      (t.interval_months is not null or (t.interval_km is not null and p_odometer_km is not null)) as still_active,
      t.interval_months, t.interval_km
    from garage.terms t where t.id = any(p_term_ids)
  )
  update garage.terms t set
    last_done_on = p_done_on,
    due_on = case when c.still_active and c.interval_months is null then null else c.next_on end,
    due_km = case when c.still_active and c.interval_km is null then null else c.next_km end,
    active = c.still_active
  from calc c
  where t.id = c.id;

  return v_service;
end $$;
