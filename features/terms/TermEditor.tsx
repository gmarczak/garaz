"use client";

import { useState } from "react";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { btnPrimary, errorText, field, label, labelText } from "@/components/ui/styles";
import { useAction } from "@/lib/data/hooks";
import { addTerm, deleteTerm, errorMessage, updateTerm, type TermForm } from "@/lib/data/mutations";
import type { LocalDate } from "@/lib/domain/dates";
import { TERM_KINDS, type Term, type TermKind } from "@/lib/domain/model";
import { parseKm } from "@/lib/domain/parse";
import { nextSeasonDate, TERM_DEFAULTS, TERM_LABELS } from "@/lib/domain/terms";

const MONTHS = [null, 1, 3, 6, 12, 24, 36];
const NOTIFY = [3, 7, 14, 30, 60];
const usesKm = (kind: TermKind) => kind === "oil" || kind === "other";

function initialDue(kind: TermKind, today: LocalDate): LocalDate | null {
  return kind === "winter_tires" || kind === "summer_tires" ? nextSeasonDate(kind, today) : null;
}

/** Dodawanie i edycja terminu (OC, przegląd, olej, opony, inny). */
export function TermEditor({ carId, term, today, onDone }: { carId: string; term?: Term; today: LocalDate; onDone: () => void }) {
  const [kind, setKind] = useState<TermKind>(term?.kind ?? "insurance");
  const [title, setTitle] = useState(term?.title ?? "");
  const [dueOn, setDueOn] = useState<string>(term ? (term.dueOn ?? "") : "");
  const [dueKm, setDueKm] = useState(term?.dueKm != null ? String(term.dueKm) : "");
  const [months, setMonths] = useState<number | null>(term ? term.intervalMonths : TERM_DEFAULTS.insurance.intervalMonths);
  const [intervalKm, setIntervalKm] = useState(term?.intervalKm != null ? String(term.intervalKm) : "");
  const [notify, setNotify] = useState(term?.notifyDays ?? TERM_DEFAULTS.insurance.notifyDays);
  const [error, setError] = useState<string | null>(null);
  const add = useAction(addTerm);
  const update = useAction(updateTerm);
  const remove = useAction(deleteTerm);
  const pending = add.isPending || update.isPending || remove.isPending;

  function pickKind(k: TermKind) {
    const d = TERM_DEFAULTS[k];
    setKind(k);
    setMonths(d.intervalMonths);
    setIntervalKm(d.intervalKm !== null ? String(d.intervalKm) : "");
    setNotify(d.notifyDays);
    setDueOn(initialDue(k, today) ?? "");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const km = usesKm(kind) && dueKm.trim() ? parseKm(dueKm) : null;
    const everyKm = usesKm(kind) && intervalKm.trim() ? parseKm(intervalKm) : null;
    if (kind === "other" && !title.trim()) return setError("Nazwij termin, np. „Rozrząd” albo „Winieta”.");
    if (usesKm(kind) && dueKm.trim() && km === null) return setError("Przebieg wpisz w pełnych kilometrach.");
    if (usesKm(kind) && intervalKm.trim() && (everyKm === null || everyKm < 100)) return setError("Co ile km — najmniej 100.");
    if (!dueOn && km === null) return setError(usesKm(kind) ? "Podaj datę albo przebieg." : "Podaj datę.");
    setError(null);
    const form: TermForm = {
      kind,
      title: kind === "other" ? title : null,
      dueOn: dueOn || null,
      dueKm: km,
      intervalMonths: months,
      intervalKm: everyKm,
      anchor: term?.anchor ?? TERM_DEFAULTS[kind].anchor,
      notifyDays: notify,
    };
    const opts = { onSuccess: onDone, onError: (err: Error) => setError(errorMessage(err)) };
    if (term) update.mutate({ id: term.id, carId, term: form }, opts);
    else add.mutate({ carId, term: form }, opts);
  }

  const dueLabel = kind === "insurance" ? "OC ważne do" : kind === "inspection" ? "Przegląd ważny do" : kind.endsWith("_tires") ? "Zmiana opon" : "Termin";

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {!term && (
        <label className={label}>
          <span className={labelText}>Rodzaj</span>
          <select value={kind} onChange={(e) => pickKind(e.target.value as TermKind)} className={field}>
            {TERM_KINDS.map((k) => (
              <option key={k} value={k}>
                {TERM_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
      )}
      {kind === "other" && (
        <label className={label}>
          <span className={labelText}>Nazwa</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="np. Rozrząd, Winieta, Gaśnica" className={field} />
        </label>
      )}
      <div className={usesKm(kind) ? "grid grid-cols-2 gap-3" : ""}>
        <label className={label}>
          <span className={labelText}>{dueLabel}</span>
          <input type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} className={field} />
        </label>
        {usesKm(kind) && (
          <label className={label}>
            <span className={labelText}>albo przy (km)</span>
            <input inputMode="numeric" value={dueKm} onChange={(e) => setDueKm(e.target.value)} placeholder="np. 150 000" className={field} />
          </label>
        )}
      </div>
      <div className={usesKm(kind) ? "grid grid-cols-2 gap-3" : ""}>
        <label className={label}>
          <span className={labelText}>Powtarzaj co</span>
          <select value={months ?? ""} onChange={(e) => setMonths(e.target.value ? Number(e.target.value) : null)} className={field}>
            {MONTHS.map((m) => (
              <option key={m ?? "none"} value={m ?? ""}>
                {m === null ? "Jednorazowo" : m === 1 ? "miesiąc" : m < 12 ? `${m} mies.` : m === 12 ? "rok" : `${m / 12} lata`}
              </option>
            ))}
          </select>
        </label>
        {usesKm(kind) && (
          <label className={label}>
            <span className={labelText}>albo co (km)</span>
            <input inputMode="numeric" value={intervalKm} onChange={(e) => setIntervalKm(e.target.value)} placeholder="np. 15 000" className={field} />
          </label>
        )}
      </div>
      <label className={label}>
        <span className={labelText}>Przypomnij</span>
        <select value={notify} onChange={(e) => setNotify(Number(e.target.value))} className={field}>
          {(NOTIFY.includes(notify) ? NOTIFY : [...NOTIFY, notify].sort((a, b) => a - b)).map((d) => (
            <option key={d} value={d}>
              {d} dni wcześniej
            </option>
          ))}
        </select>
      </label>
      {error && <p className={errorText}>{error}</p>}
      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "Zapisuję…" : term ? "Zapisz" : "Dodaj termin"}
      </button>
      {term && (
        <ConfirmButton label="Usuń termin" disabled={pending} onConfirm={() => remove.mutate(term.id, { onSuccess: onDone, onError: (err) => setError(errorMessage(err)) })} />
      )}
    </form>
  );
}
