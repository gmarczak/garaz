-- Testy zachowania schematu garage: RLS, ograniczenia, RPC. Uruchamiane po auth_stub.sql i migracjach.
-- Linie z „ok_” mają zwrócić t; linie pod „oczekiwane bledy” mają się wywalić (ON_ERROR_STOP wyłączone).
\set ON_ERROR_STOP 0
insert into auth.users(id,email) values ('11111111-1111-1111-1111-111111111111','a@x'),('22222222-2222-2222-2222-222222222222','b@x');
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);

\echo '-- bootstrap i auto'
select garage.bootstrap();
select garage.bootstrap();
select count(*) = 1 as ok_settings from garage.settings;
insert into garage.cars(name, make, model, year, plate, fuel, odometer_km) values ('Corolla','Toyota','Corolla',2016,'KR 12345','petrol',150000);
select id as car from garage.cars where name = 'Corolla' \gset

\echo '-- terminy'
insert into garage.terms(car_id, kind, due_on, interval_months, anchor, notify_days) values (:'car','insurance','2026-11-20',12,'due',30);
insert into garage.terms(car_id, kind, due_on, interval_months, anchor) values (:'car','inspection','2026-11-05',12,'done');
insert into garage.terms(car_id, kind, due_on, interval_months, interval_km, anchor) values (:'car','oil','2026-11-05',12,15000,'done');
insert into garage.terms(car_id, kind, title, due_on) values (:'car','other','Wymiana wycieraczek','2026-10-30');
select id as oc from garage.terms where kind = 'insurance' \gset
select id as insp from garage.terms where kind = 'inspection' \gset
select id as oil from garage.terms where kind = 'oil' \gset
select id as other from garage.terms where kind = 'other' \gset

\echo '-- przegląd z olejem: wpis w historii, przesunięcie od dnia wykonania, przebieg auta'
select title = 'Przegląd + Wymiana oleju' and kinds = '{inspection,oil}' as ok_service
  from garage.complete_terms('aaaaaaaa-0000-0000-0000-000000000001', array[:'insp', :'oil']::uuid[], '2026-10-28', 151200, 45000, 'u Marka');
select garage.complete_terms('aaaaaaaa-0000-0000-0000-000000000001', array[:'insp', :'oil']::uuid[], '2026-10-28', 151200, 45000, 'u Marka') is not null as ok_idempotent;
select count(*) = 1 as ok_one_service from garage.services;
select due_on = '2027-10-28' as ok_insp_next from garage.terms where id = :'insp';
select due_on = '2027-10-28' and due_km = 166200 as ok_oil_next from garage.terms where id = :'oil';
select odometer_km = 151200 as ok_odometer from garage.cars where id = :'car';

\echo '-- OC przesuwa się od poprzedniego terminu, jednorazowy znika'
select garage.complete_terms(gen_random_uuid(), array[:'oc']::uuid[], '2026-11-10', null, 98000);
select due_on = '2027-11-20' as ok_oc_next from garage.terms where id = :'oc';
select garage.complete_terms(gen_random_uuid(), array[:'other']::uuid[], '2026-10-29');
select not active as ok_other_done from garage.terms where id = :'other';

\echo '-- termin tylko co km (rozrząd): stara data znika, przebieg przesuwa się'
insert into garage.terms(car_id, kind, title, due_on, due_km, interval_km) values (:'car','other','Rozrząd','2026-01-01',150000,90000);
select id as belt from garage.terms where title = 'Rozrząd' \gset
select garage.complete_terms(gen_random_uuid(), array[:'belt']::uuid[], '2026-10-29', 151300);
select active and due_on is null and due_km = 241300 as ok_km_only from garage.terms where id = :'belt';

\echo '-- tankowanie podbija przebieg tylko w górę'
insert into garage.fuel_logs(car_id, filled_on, odometer_km, liters, amount_minor) values (:'car','2026-10-30',151700,40.5,25110);
insert into garage.fuel_logs(car_id, filled_on, odometer_km, liters, amount_minor) values (:'car','2026-10-01',150900,38,23000);
select odometer_km = 151700 as ok_odometer_max from garage.cars where id = :'car';

\echo '-- oczekiwane bledy (6):'
insert into garage.terms(car_id, kind) values (:'car','insurance');                          -- bez daty i przebiegu
insert into garage.terms(car_id, kind, due_on) values (:'car','other','2026-12-01');           -- inne bez tytułu
insert into garage.fuel_logs(car_id, filled_on, odometer_km, liters, amount_minor) values (:'car','2026-10-30',100,0,100); -- 0 litrów
select garage.complete_terms(gen_random_uuid(), array[]::uuid[], '2026-10-30');               -- brak terminów
insert into garage.cars(name) values ('   ');                                                   -- pusta nazwa
insert into garage.cars(name, year) values ('Stary', 1800);                                     -- zły rocznik

\echo '-- RLS: użytkownik B'
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
select (select count(*) from garage.cars) = 0 and (select count(*) from garage.terms) = 0 and (select count(*) from garage.fuel_logs) = 0 as ok_b_isolated;
\echo '-- oczekiwane bledy RLS (3):'
select garage.complete_terms(gen_random_uuid(), array[:'oc']::uuid[], '2026-10-30');           -- cudzy termin
insert into garage.terms(car_id, kind, due_on) values (:'car','insurance','2027-01-01');      -- cudze auto (FK złożony)
insert into garage.cars(user_id, name) values ('11111111-1111-1111-1111-111111111111','Podrzucone'); -- with check
reset role;
select due_on = '2027-11-20' as ok_untouched from garage.terms where id = :'oc';

\echo '-- kasowanie konta czyści wszystko'
delete from auth.users where email = 'a@x';
select (select count(*) from garage.cars) = 0 and (select count(*) from garage.terms) = 0 and (select count(*) from garage.services) = 0 as ok_cascade;
