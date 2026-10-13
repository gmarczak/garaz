"use client";

import { useState } from "react";
import { btnPrimary, errorText, field, label, labelText } from "@/components/ui/styles";
import { useAction } from "@/lib/data/hooks";
import { completeTerms, errorMessage, newId, withCompleted } from "@/lib/data/mutations";
import type { LocalDate } from "@/lib/domain/dates";
import type { Car, Term } from "@/lib/domain/model";
import { parseAmount } from "@/lib/domain/money";
import { parseKm } from "@/lib/domain/parse";
import { nextAfterDone, termTitle } from "@/lib/domain/terms";
import { formatKm, formatLongDate } from "@/lib/format";

/**
 * „Zrobione”: zapisuje wpis w historii i przesuwa terminy.
 * Przy przeglądzie od razu zaznaczony jest też olej (wymieniany razem z przeglądem) — można odznaczyć.
 */
export function CompleteForm({ term, car, terms, today, onDone }: { term: Term; car: Car; terms: Term[]; today: LocalDate; onDone: () => void }) {
  const others = terms.filter((t) => t.active && t.carId === car.id && t.id !== term.id);
  const [checked, setChecked] = useState<Set<string>>(() => {
    const s = new Set([term.id]);
    if (term.kind === "inspection") for (const t of others) if (t.kind === "oil") s.add(t.id);
    return s;
  });
  const [date, setDate] = useState(today);
  const [odometer, setOdometer] = useState(car.odometerKm !== null ? String(car.odometerKm) : "");
  const [cost, setCost] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const save = useAction(completeTerms, withCompleted);

  const km = odometer.trim() ? parseKm(odometer) : null;
  const chosen = [term, ...others].filter((t) => checked.has(t.id));

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (chosen.length === 0) return setError("Zaznacz, co zostało zrobione.");
    if (odometer.trim() && km === null) return setError("Przebieg wpisz w pełnych kilometrach.");
    const costMinor = cost.trim() ? parseAmount(cost) : null;
    if (cost.trim() && (costMinor === null || costMinor < 0)) return setError("Koszt wygląda na błędny, np. 250 albo 99,90.");
    setError(null);
    save.mutate(
      { id: newId(), termIds: chosen.map((t) => t.id), doneOn: date, odometerKm: km, costMinor, note: note || null },
      { onSuccess: onDone, onError: (err) => setError(errorMessage(err)) },
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <fieldset className="flex flex-col">
        <legend className={`${labelText} mb-1`}>Co zostało zrobione</legend>
        {[term, ...others].map((t) => {
          const after = checked.has(t.id) ? nextAfterDone(t, date, km) : null;
          return (
            <label key={t.id} className="flex min-h-12 items-center gap-3 border-b border-border py-2">
              <input type="checkbox" checked={checked.has(t.id)} onChange={() => toggle(t.id)} className="h-5 w-5 accent-[var(--accent)]" />
              <span className="flex flex-col">
                <span className="font-semibold">{termTitle(t)}</span>
                {after && (
                  <span className="text-sm text-muted">
                    {after.active
                      ? `Następny: ${[after.dueOn ? formatLongDate(after.dueOn) : null, after.dueKm !== null ? formatKm(after.dueKm) : null].filter(Boolean).join(" albo ")}`
                      : "Jednorazowy — zniknie z listy"}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </fieldset>
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
        <input inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="np. 149" className={field} />
      </label>
      <label className={label}>
        <span className={labelText}>Notatka (opcjonalnie)</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="np. olej 5W30, ubezpieczyciel" className={field} />
      </label>
      {error && <p className={errorText}>{error}</p>}
      <button type="submit" disabled={save.isPending} className={btnPrimary}>
        {save.isPending ? "Zapisuję…" : "Zapisz"}
      </button>
    </form>
  );
}
