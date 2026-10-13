"use client";

import { useState } from "react";
import { btnPrimary, errorText, field, label, labelText } from "@/components/ui/styles";
import { newId, type FuelDraft } from "@/lib/data/mutations";
import type { Snapshot } from "@/lib/data/snapshot";
import type { LocalDate } from "@/lib/domain/dates";
import { parseAmount } from "@/lib/domain/money";
import { parseKm, parseLiters } from "@/lib/domain/parse";
import { formatKm, formatPricePerLiter } from "@/lib/format";

/** Domyślne auto: wskazane, inaczej to tankowane ostatnio, inaczej pierwsze. */
function defaultCar(snapshot: Snapshot, carId?: string): string {
  const active = snapshot.cars.filter((c) => c.archivedAt === null);
  if (carId && active.some((c) => c.id === carId)) return carId;
  const last = snapshot.fuel.find((f) => active.some((c) => c.id === f.carId));
  return last?.carId ?? active[0]?.id ?? "";
}

export function FuelForm({
  snapshot,
  today,
  carId,
  onSave,
}: {
  snapshot: Snapshot;
  today: LocalDate;
  carId?: string;
  /** Zapis w tle (kolejka offline) — formularz zamyka się od razu. */
  onSave: (draft: FuelDraft) => void;
}) {
  const cars = snapshot.cars.filter((c) => c.archivedAt === null);
  const [car, setCar] = useState(() => defaultCar(snapshot, carId));
  const [date, setDate] = useState(today);
  const [odometer, setOdometer] = useState("");
  const [liters, setLiters] = useState("");
  const [amount, setAmount] = useState("");
  const [fullTank, setFullTank] = useState(true);
  const [station, setStation] = useState("");
  const [error, setError] = useState<string | null>(null);

  const current = cars.find((c) => c.id === car);
  const lastKm = current?.odometerKm ?? null;
  const km = parseKm(odometer);
  const l = parseLiters(liters);
  const minor = parseAmount(amount);
  const price = l && minor && minor > 0 ? minor / 100 / l : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!current) return setError("Wybierz auto.");
    if (km === null) return setError("Wpisz przebieg z licznika.");
    if (l === null) return setError("Wpisz litry, np. 42,5.");
    if (minor === null || minor <= 0) return setError("Wpisz kwotę z paragonu.");
    setError(null);
    onSave({ id: newId(), carId: current.id, filledOn: date, odometerKm: km, liters: l, amountMinor: minor, fullTank, station: station || null });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {cars.length > 1 && (
        <label className={label}>
          <span className={labelText}>Auto</span>
          <select value={car} onChange={(e) => setCar(e.target.value)} className={field}>
            {cars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className={label}>
          <span className={labelText}>Data</span>
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} className={field} />
        </label>
        <label className={label}>
          <span className={labelText}>Przebieg</span>
          <input
            inputMode="numeric"
            value={odometer}
            onChange={(e) => setOdometer(e.target.value)}
            placeholder={lastKm !== null ? String(lastKm) : "km"}
            className={field}
          />
        </label>
      </div>
      {km !== null && lastKm !== null && km < lastKm && (
        <p className="-mt-2 text-sm text-warn-text">Mniej niż ostatnio zapisany przebieg ({formatKm(lastKm)}) — to starsze tankowanie?</p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className={label}>
          <span className={labelText}>Litry</span>
          <input inputMode="decimal" value={liters} onChange={(e) => setLiters(e.target.value)} placeholder="np. 42,5" className={field} />
        </label>
        <label className={label}>
          <span className={labelText}>Kwota (zł)</span>
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="np. 260,40" className={field} />
        </label>
      </div>
      <p className="-mt-2 h-5 text-sm text-muted">{price ? formatPricePerLiter(price) : ""}</p>
      <label className="flex min-h-11 items-center gap-3">
        <input type="checkbox" checked={fullTank} onChange={(e) => setFullTank(e.target.checked)} className="h-5 w-5 accent-[var(--accent)]" />
        <span>
          Do pełna <span className="text-sm text-muted">— potrzebne do liczenia spalania</span>
        </span>
      </label>
      <label className={label}>
        <span className={labelText}>Stacja (opcjonalnie)</span>
        <input value={station} onChange={(e) => setStation(e.target.value)} maxLength={60} placeholder="np. Orlen Wadowicka" className={field} />
      </label>
      {error && <p className={errorText}>{error}</p>}
      <button type="submit" className={btnPrimary}>
        Zapisz
      </button>
      <p className="-mt-2 text-center text-xs text-muted">Działa też bez internetu — wyśle się, gdy wróci zasięg.</p>
    </form>
  );
}
