"use client";

import { field, label, labelText } from "@/components/ui/styles";
import type { CarForm } from "@/lib/data/mutations";
import { FUEL_LABELS, type Car, type FuelType } from "@/lib/domain/model";
import { parseKm } from "@/lib/domain/parse";

/** Pola formularza auta jako tekst (to, co wpisuje człowiek). */
export type CarDraft = { name: string; make: string; model: string; year: string; plate: string; fuel: FuelType; odometer: string };

export const emptyCar: CarDraft = { name: "", make: "", model: "", year: "", plate: "", fuel: "petrol", odometer: "" };

export function carToDraft(car: Car): CarDraft {
  return {
    name: car.name,
    make: car.make ?? "",
    model: car.model ?? "",
    year: car.year ? String(car.year) : "",
    plate: car.plate ?? "",
    fuel: car.fuel,
    odometer: car.odometerKm !== null ? String(car.odometerKm) : "",
  };
}

/** Szkic → dane do zapisu albo komunikat błędu. */
export function draftToCar(d: CarDraft): CarForm | string {
  const name = d.name.trim() || [d.make, d.model].map((s) => s.trim()).filter(Boolean).join(" ");
  if (!name) return "Nazwij auto (np. „Golf”) albo wpisz markę.";
  if (name.length > 40) return "Nazwa może mieć najwyżej 40 znaków.";
  let year: number | null = null;
  if (d.year.trim()) {
    year = Number(d.year.trim());
    if (!Number.isInteger(year) || year < 1950 || year > 2100) return "Rok produkcji wygląda na błędny.";
  }
  let odometerKm: number | null = null;
  if (d.odometer.trim()) {
    odometerKm = parseKm(d.odometer);
    if (odometerKm === null) return "Przebieg wpisz w pełnych kilometrach, np. 123 456.";
  }
  return { name, make: d.make, model: d.model, year, plate: d.plate.replace(/\s+/g, " "), fuel: d.fuel, odometerKm };
}

export function CarFields({ draft, onChange }: { draft: CarDraft; onChange: (d: CarDraft) => void }) {
  const set = <K extends keyof CarDraft>(key: K, value: CarDraft[K]) => onChange({ ...draft, [key]: value });
  return (
    <div className="flex flex-col gap-4">
      <label className={label}>
        <span className={labelText}>Nazwa</span>
        <input value={draft.name} onChange={(e) => set("name", e.target.value)} maxLength={40} placeholder="np. Golf, auto taty" className={field} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={label}>
          <span className={labelText}>Marka</span>
          <input value={draft.make} onChange={(e) => set("make", e.target.value)} maxLength={40} placeholder="Volkswagen" className={field} />
        </label>
        <label className={label}>
          <span className={labelText}>Model</span>
          <input value={draft.model} onChange={(e) => set("model", e.target.value)} maxLength={40} placeholder="Golf VII" className={field} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className={label}>
          <span className={labelText}>Rok</span>
          <input inputMode="numeric" value={draft.year} onChange={(e) => set("year", e.target.value)} maxLength={4} placeholder="2016" className={field} />
        </label>
        <label className={label}>
          <span className={labelText}>Rejestracja</span>
          <input value={draft.plate} onChange={(e) => set("plate", e.target.value)} maxLength={12} placeholder="KR 12345" className={`${field} uppercase`} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className={label}>
          <span className={labelText}>Paliwo</span>
          <select value={draft.fuel} onChange={(e) => set("fuel", e.target.value as FuelType)} className={field}>
            {(Object.keys(FUEL_LABELS) as FuelType[]).map((f) => (
              <option key={f} value={f}>
                {FUEL_LABELS[f]}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          <span className={labelText}>Przebieg (km)</span>
          <input inputMode="numeric" value={draft.odometer} onChange={(e) => set("odometer", e.target.value)} placeholder="123 456" className={field} />
        </label>
      </div>
    </div>
  );
}
