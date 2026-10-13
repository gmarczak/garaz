"use client";

import { useState } from "react";
import { btnPrimary, errorText, field, label, labelText } from "@/components/ui/styles";
import { useAction } from "@/lib/data/hooks";
import { addService, errorMessage, newId } from "@/lib/data/mutations";
import type { LocalDate } from "@/lib/domain/dates";
import type { Car } from "@/lib/domain/model";
import { parseAmount } from "@/lib/domain/money";
import { parseKm } from "@/lib/domain/parse";

/** Wpis w historii bez terminu: naprawa, klocki, akumulator, myjnia… */
export function ServiceForm({ car, today, onDone }: { car: Car; today: LocalDate; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today);
  const [odometer, setOdometer] = useState(car.odometerKm !== null ? String(car.odometerKm) : "");
  const [cost, setCost] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const save = useAction(addService);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Co było robione? Np. „Wymiana klocków”.");
    const km = odometer.trim() ? parseKm(odometer) : null;
    if (odometer.trim() && km === null) return setError("Przebieg wpisz w pełnych kilometrach.");
    const costMinor = cost.trim() ? parseAmount(cost) : null;
    if (cost.trim() && (costMinor === null || costMinor < 0)) return setError("Koszt wygląda na błędny, np. 250 albo 99,90.");
    setError(null);
    save.mutate(
      { id: newId(), carId: car.id, doneOn: date, title, odometerKm: km, costMinor, note: note || null },
      { onSuccess: onDone, onError: (err) => setError(errorMessage(err)) },
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <label className={label}>
        <span className={labelText}>Co było robione</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="np. Wymiana klocków, akumulator" className={field} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={label}>
          <span className={labelText}>Kiedy</span>
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} className={field} />
        </label>
        <label className={label}>
          <span className={labelText}>Przebieg</span>
          <input inputMode="numeric" value={odometer} onChange={(e) => setOdometer(e.target.value)} placeholder="km" className={field} />
        </label>
      </div>
      <label className={label}>
        <span className={labelText}>Koszt (zł, opcjonalnie)</span>
        <input inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="np. 350" className={field} />
      </label>
      <label className={label}>
        <span className={labelText}>Notatka (opcjonalnie)</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="np. warsztat, numer części" className={field} />
      </label>
      {error && <p className={errorText}>{error}</p>}
      <button type="submit" disabled={save.isPending} className={btnPrimary}>
        {save.isPending ? "Zapisuję…" : "Zapisz"}
      </button>
    </form>
  );
}
