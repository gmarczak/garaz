import type { Supabase } from "@/lib/db/client";
import type { LocalDate } from "@/lib/domain/dates";
import type { FuelLog, FuelType, Term, TermKind } from "@/lib/domain/model";
import type { Minor } from "@/lib/domain/money";
import { nextAfterDone } from "@/lib/domain/terms";
import type { Snapshot } from "./snapshot";

export function newId(): string {
  return crypto.randomUUID();
}

const NETWORK = /Failed to fetch|NetworkError|network|Load failed|fetch failed/i;

/** Błąd sieci (brak zasięgu), a nie odmowa serwera. */
export function isNetworkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String(error.message) : String(error);
  return NETWORK.test(message);
}

/** Komunikat dla człowieka z błędu Supabase/RPC. */
export function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String(error.message) : String(error);
  if (NETWORK.test(message)) return "Brak połączenia. Spróbuj, gdy wróci internet.";
  if (/check constraint|violates/i.test(message)) return "Któraś wartość jest poza zakresem — sprawdź pola formularza.";
  if (/term_not_found/.test(message)) return "Nie znaleziono terminu — odśwież aplikację.";
  return message;
}

function check<T extends { error: { message: string } | null }>(result: T): T {
  if (result.error) throw result.error;
  return result;
}

// ============ AUTA ============

export type CarForm = {
  name: string;
  make: string | null;
  model: string | null;
  year: number | null;
  plate: string | null;
  fuel: FuelType;
  odometerKm: number | null;
};

export type TermForm = {
  kind: TermKind;
  title: string | null;
  dueOn: LocalDate | null;
  dueKm: number | null;
  intervalMonths: number | null;
  intervalKm: number | null;
  anchor: "due" | "done";
  notifyDays: number;
};

const clean = (s: string | null) => (s && s.trim() ? s.trim() : null);

function carRow(f: CarForm) {
  return { name: f.name.trim(), make: clean(f.make), model: clean(f.model), year: f.year, plate: clean(f.plate)?.toUpperCase() ?? null, fuel: f.fuel, odometer_km: f.odometerKm };
}

function termRow(carId: string, f: TermForm) {
  return {
    car_id: carId,
    kind: f.kind,
    title: f.kind === "other" ? clean(f.title) : null,
    due_on: f.dueOn,
    due_km: f.dueKm,
    interval_months: f.intervalMonths,
    interval_km: f.intervalKm,
    anchor: f.anchor,
    notify_days: f.notifyDays,
  };
}

/**
 * Nowe auto z terminami (z kreatora). Id nadaje klient, więc ponowienie po zerwanym połączeniu
 * nie tworzy drugiego auta ani zdublowanych terminów.
 */
export async function addCar(
  supabase: Supabase,
  input: { id: string; car: CarForm; terms: (TermForm & { id: string })[]; sortOrder: number },
): Promise<{ id: string }> {
  check(await supabase.from("cars").upsert({ id: input.id, ...carRow(input.car), sort_order: input.sortOrder }, { onConflict: "id", ignoreDuplicates: true }));
  if (input.terms.length > 0) {
    check(await supabase.from("terms").upsert(input.terms.map((t) => ({ id: t.id, ...termRow(input.id, t) })), { onConflict: "id", ignoreDuplicates: true }));
  }
  return { id: input.id };
}

export async function updateCar(supabase: Supabase, input: { id: string; car: CarForm }): Promise<void> {
  check(await supabase.from("cars").update(carRow(input.car)).eq("id", input.id));
}

export async function archiveCar(supabase: Supabase, input: { id: string; archived: boolean }): Promise<void> {
  // eslint-disable-next-line no-restricted-syntax -- znacznik czasu, nie dzień
  check(await supabase.from("cars").update({ archived_at: input.archived ? new Date().toISOString() : null }).eq("id", input.id));
}

// ============ TERMINY ============

export async function addTerm(supabase: Supabase, input: { carId: string; term: TermForm }): Promise<void> {
  check(await supabase.from("terms").insert(termRow(input.carId, input.term)));
}

export async function updateTerm(supabase: Supabase, input: { id: string; carId: string; term: TermForm }): Promise<void> {
  check(await supabase.from("terms").update(termRow(input.carId, input.term)).eq("id", input.id));
}

export async function deleteTerm(supabase: Supabase, id: string): Promise<void> {
  check(await supabase.from("terms").delete().eq("id", id));
}

export type CompleteInput = {
  id: string;
  termIds: string[];
  doneOn: LocalDate;
  odometerKm: number | null;
  costMinor: Minor | null;
  note: string | null;
};

export async function completeTerms(supabase: Supabase, input: CompleteInput): Promise<void> {
  check(
    await supabase.rpc("complete_terms", {
      p_id: input.id,
      p_term_ids: input.termIds,
      p_done_on: input.doneOn,
      p_odometer_km: input.odometerKm,
      p_cost_minor: input.costMinor,
      p_note: clean(input.note),
    }),
  );
}

/** Natychmiastowy podgląd po „Zrobione” (serwer potwierdzi i odświeży). */
export function withCompleted(snapshot: Snapshot, input: CompleteInput): Snapshot {
  const done = new Set(input.termIds);
  const terms: Term[] = snapshot.terms.map((t) => (done.has(t.id) ? { ...t, ...nextAfterDone(t, input.doneOn, input.odometerKm) } : t));
  return { ...snapshot, terms };
}

// ============ SERWIS (wpis bez terminu: naprawa, inne) ============

export async function addService(
  supabase: Supabase,
  input: { id: string; carId: string; doneOn: LocalDate; title: string; odometerKm: number | null; costMinor: Minor | null; note: string | null },
): Promise<void> {
  const { error } = await supabase.from("services").insert({
    id: input.id,
    car_id: input.carId,
    done_on: input.doneOn,
    title: input.title.trim(),
    odometer_km: input.odometerKm,
    cost_minor: input.costMinor,
    note: clean(input.note),
  });
  if (error && error.code !== "23505") throw error;
}

export async function deleteService(supabase: Supabase, id: string): Promise<void> {
  check(await supabase.from("services").delete().eq("id", id));
}

// ============ TANKOWANIA (działa offline: id nadaje klient, powtórka nic nie dubluje) ============

export type FuelDraft = Omit<FuelLog, "station"> & { station: string | null };

export async function saveFuel(supabase: Supabase, draft: FuelDraft): Promise<void> {
  const { error } = await supabase.from("fuel_logs").insert({
    id: draft.id,
    car_id: draft.carId,
    filled_on: draft.filledOn,
    odometer_km: draft.odometerKm,
    liters: draft.liters,
    amount_minor: draft.amountMinor,
    full_tank: draft.fullTank,
    station: clean(draft.station),
  });
  if (error && error.code !== "23505") throw error; // 23505: już zapisane (powtórka po utracie sieci)
}

export function withFuel(snapshot: Snapshot, draft: FuelDraft): Snapshot {
  const fuel = [draft, ...snapshot.fuel.filter((f) => f.id !== draft.id)];
  const cars = snapshot.cars.map((c) => (c.id === draft.carId ? { ...c, odometerKm: Math.max(c.odometerKm ?? 0, draft.odometerKm) } : c));
  return { ...snapshot, fuel, cars };
}

export async function deleteFuel(supabase: Supabase, id: string): Promise<void> {
  check(await supabase.from("fuel_logs").delete().eq("id", id));
}

// ============ USTAWIENIA ============

export async function saveSettings(supabase: Supabase, input: { notifyTime?: string; timezone?: string }): Promise<void> {
  const row: { notify_time?: string; timezone?: string } = {};
  if (input.notifyTime !== undefined) row.notify_time = input.notifyTime;
  if (input.timezone !== undefined) row.timezone = input.timezone;
  const { data: auth } = await supabase.auth.getUser();
  check(await supabase.from("settings").update(row).eq("user_id", auth.user?.id ?? ""));
}

/** Ręczna korekta przebiegu (licznik w aucie). */
export async function setOdometer(supabase: Supabase, input: { id: string; odometerKm: number }): Promise<void> {
  check(await supabase.from("cars").update({ odometer_km: input.odometerKm }).eq("id", input.id));
}

export function withOdometer(snapshot: Snapshot, input: { id: string; odometerKm: number }): Snapshot {
  return { ...snapshot, cars: snapshot.cars.map((c) => (c.id === input.id ? { ...c, odometerKm: input.odometerKm } : c)) };
}
