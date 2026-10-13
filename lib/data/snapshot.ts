import type { Supabase } from "@/lib/db/client";
import type { CarRow, FuelLogRow, ServiceRow, TermRow } from "@/lib/db/database.types";
import type { Car, FuelLog, Service, Settings, Term } from "@/lib/domain/model";

/** Wszystko, czego potrzebują ekrany, w jednym obiekcie w cache (IndexedDB). Kilka aut to setki wierszy. */
export type Snapshot = {
  userId: string;
  email: string | null;
  settings: Settings;
  cars: Car[];
  terms: Term[];
  services: Service[];
  fuel: FuelLog[];
};

export function toCar(r: CarRow): Car {
  return {
    id: r.id,
    name: r.name,
    make: r.make,
    model: r.model,
    year: r.year,
    plate: r.plate,
    fuel: r.fuel,
    odometerKm: r.odometer_km,
    sortOrder: r.sort_order,
    archivedAt: r.archived_at,
  };
}

export function toTerm(r: TermRow): Term {
  return {
    id: r.id,
    carId: r.car_id,
    kind: r.kind,
    title: r.title,
    dueOn: r.due_on,
    dueKm: r.due_km,
    intervalMonths: r.interval_months,
    intervalKm: r.interval_km,
    anchor: r.anchor,
    notifyDays: r.notify_days,
    lastDoneOn: r.last_done_on,
    active: r.active,
  };
}

export function toService(r: ServiceRow): Service {
  return {
    id: r.id,
    carId: r.car_id,
    doneOn: r.done_on,
    kinds: r.kinds,
    title: r.title,
    odometerKm: r.odometer_km,
    costMinor: r.cost_minor === null ? null : Number(r.cost_minor),
    note: r.note,
  };
}

export function toFuel(r: FuelLogRow): FuelLog {
  return {
    id: r.id,
    carId: r.car_id,
    filledOn: r.filled_on,
    odometerKm: r.odometer_km,
    liters: Number(r.liters),
    amountMinor: Number(r.amount_minor),
    fullTank: r.full_tank,
    station: r.station,
  };
}

export async function fetchSnapshot(supabase: Supabase): Promise<Snapshot> {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw authError ?? new Error("not_authenticated");

  let settings = await supabase.from("settings").select("*").maybeSingle();
  if (settings.error) throw settings.error;
  if (!settings.data) {
    const boot = await supabase.rpc("bootstrap");
    if (boot.error) throw boot.error;
    settings = await supabase.from("settings").select("*").maybeSingle();
    if (settings.error) throw settings.error;
  }

  const [cars, terms, services, fuel] = await Promise.all([
    supabase.from("cars").select("*").order("sort_order").order("created_at"),
    supabase.from("terms").select("*"),
    supabase.from("services").select("*").order("done_on", { ascending: false }),
    supabase.from("fuel_logs").select("*").order("filled_on", { ascending: false }),
  ]);
  for (const r of [cars, terms, services, fuel]) if (r.error) throw r.error;

  return {
    userId: auth.user.id,
    email: auth.user.email ?? null,
    settings: { timezone: settings.data?.timezone ?? "Europe/Warsaw", notifyTime: (settings.data?.notify_time ?? "09:00").slice(0, 5) },
    cars: (cars.data ?? []).map(toCar),
    terms: (terms.data ?? []).map(toTerm),
    services: (services.data ?? []).map(toService),
    fuel: (fuel.data ?? []).map(toFuel),
  };
}
