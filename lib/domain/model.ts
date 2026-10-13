import type { LocalDate } from "./dates";
import type { Minor } from "./money";

export type FuelType = "petrol" | "diesel" | "lpg" | "hybrid" | "electric";
export const FUEL_LABELS: Record<FuelType, string> = {
  petrol: "Benzyna",
  diesel: "Diesel",
  lpg: "LPG",
  hybrid: "Hybryda",
  electric: "Elektryk",
};

export type TermKind = "insurance" | "inspection" | "oil" | "winter_tires" | "summer_tires" | "other";
export const TERM_KINDS: TermKind[] = ["insurance", "inspection", "oil", "winter_tires", "summer_tires", "other"];

export type Car = {
  id: string;
  name: string;
  make: string | null;
  model: string | null;
  year: number | null;
  plate: string | null;
  fuel: FuelType;
  odometerKm: number | null;
  sortOrder: number;
  archivedAt: string | null;
};

/** Termin: data i/lub przebieg; po wykonaniu przesuwa się o interwał (od terminu albo od dnia wykonania). */
export type Term = {
  id: string;
  carId: string;
  kind: TermKind;
  title: string | null;
  dueOn: LocalDate | null;
  dueKm: number | null;
  intervalMonths: number | null;
  intervalKm: number | null;
  anchor: "due" | "done";
  notifyDays: number;
  lastDoneOn: LocalDate | null;
  active: boolean;
};

export type Service = {
  id: string;
  carId: string;
  doneOn: LocalDate;
  kinds: TermKind[];
  title: string;
  odometerKm: number | null;
  costMinor: Minor | null;
  note: string | null;
};

export type FuelLog = {
  id: string;
  carId: string;
  filledOn: LocalDate;
  odometerKm: number;
  liters: number;
  amountMinor: Minor;
  fullTank: boolean;
  station: string | null;
};

export type Settings = { timezone: string; notifyTime: string };

export function carLabel(car: Car): string {
  const model = [car.make, car.model].filter(Boolean).join(" ");
  return [model || null, car.year ? String(car.year) : null, car.plate].filter(Boolean).join(" · ");
}
