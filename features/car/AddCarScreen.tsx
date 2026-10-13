"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { btnPrimary, btnQuiet, chip, errorText, field, label, labelText, sectionTitle } from "@/components/ui/styles";
import { useAction, useSnapshot, useToday } from "@/lib/data/hooks";
import { addCar, errorMessage, newId, type CarForm, type TermForm } from "@/lib/data/mutations";
import type { LocalDate } from "@/lib/domain/dates";
import type { TermKind } from "@/lib/domain/model";
import { parseKm } from "@/lib/domain/parse";
import { nextSeasonDate, TERM_DEFAULTS } from "@/lib/domain/terms";
import { formatShortDate } from "@/lib/format";
import { CarFields, draftToCar, emptyCar, type CarDraft } from "./CarFields";

type Oil = "inspection" | "separate" | "none";

function term(kind: TermKind, dueOn: LocalDate | null, extra: Partial<TermForm> = {}): TermForm {
  return { kind, title: null, dueOn, dueKm: null, ...TERM_DEFAULTS[kind], ...extra };
}

/** Kreator: 1) dane auta, 2) terminy, które już znasz (wszystko można dodać i później). */
export function AddCarScreen() {
  const { data: snapshot } = useSnapshot();
  const today = useToday(snapshot);
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [draft, setDraft] = useState<CarDraft>(emptyCar);
  const [car, setCar] = useState<CarForm | null>(null);
  const [insurance, setInsurance] = useState("");
  const [inspection, setInspection] = useState("");
  const [oil, setOil] = useState<Oil>("inspection");
  const [oilDate, setOilDate] = useState("");
  const [oilKm, setOilKm] = useState("");
  const [tires, setTires] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const save = useAction(addCar);
  // Stałe id na czas kreatora: ponowne „Dodaj auto” po błędzie sieci nie zdubluje danych
  const [ids] = useState(() => ({ car: newId(), terms: Object.fromEntries(["insurance", "inspection", "oil", "winter_tires", "summer_tires"].map((k) => [k, newId()])) as Record<string, string> }));
  if (!snapshot || !today) return null;

  function next(e: React.FormEvent) {
    e.preventDefault();
    const form = draftToCar(draft);
    if (typeof form === "string") return setError(form);
    setError(null);
    setCar(form);
    setStep(2);
  }

  function finish(e: React.FormEvent) {
    e.preventDefault();
    if (!car || !today || !snapshot) return;
    const terms: TermForm[] = [];
    if (insurance) terms.push(term("insurance", insurance));
    if (inspection) terms.push(term("inspection", inspection));
    if (oil === "inspection" && inspection) terms.push(term("oil", inspection, { intervalKm: null }));
    if (oil === "separate") {
      const km = oilKm.trim() ? parseKm(oilKm) : null;
      if (oilKm.trim() && km === null) return setError("Przebieg wymiany oleju wpisz w pełnych kilometrach.");
      if (!oilDate && km === null) return setError("Olej osobno: podaj datę albo przebieg następnej wymiany.");
      terms.push(term("oil", oilDate || null, { dueKm: km }));
    }
    if (tires) {
      terms.push(term("winter_tires", nextSeasonDate("winter_tires", today)));
      terms.push(term("summer_tires", nextSeasonDate("summer_tires", today)));
    }
    setError(null);
    save.mutate(
      { id: ids.car, car, terms: terms.map((t) => ({ ...t, id: ids.terms[t.kind]! })), sortOrder: snapshot.cars.length },
      { onSuccess: (created) => router.replace(`/cars/${created.id}`), onError: (err) => setError(errorMessage(err)) },
    );
  }

  return (
    <main className="flex flex-col gap-6 px-5 pt-6 pb-8">
      <header className="flex items-center gap-1">
        {step === 1 ? (
          <Link href="/" aria-label="Wróć" className="-ml-3 flex h-11 w-11 items-center justify-center">
            <ChevronLeft aria-hidden="true" size={24} />
          </Link>
        ) : (
          <button type="button" onClick={() => setStep(1)} aria-label="Wróć do danych auta" className="-ml-3 flex h-11 w-11 items-center justify-center">
            <ChevronLeft aria-hidden="true" size={24} />
          </button>
        )}
        <div className="flex flex-col">
          <h1 className="font-serif text-[28px] font-semibold leading-tight">{step === 1 ? "Nowe auto" : `Terminy: ${car?.name}`}</h1>
          <span className="text-sm text-muted">Krok {step} z 2</span>
        </div>
      </header>

      {step === 1 ? (
        <form onSubmit={next} className="flex flex-col gap-5" noValidate>
          <CarFields draft={draft} onChange={setDraft} />
          {error && <p className={errorText}>{error}</p>}
          <button type="submit" className={btnPrimary}>
            Dalej
          </button>
        </form>
      ) : (
        <form onSubmit={finish} className="flex flex-col gap-6" noValidate>
          <p className="text-muted">Wpisz to, co wiesz — resztę dodasz później. Daty są w polisie i w dowodzie rejestracyjnym (pieczątka przeglądu).</p>

          <label className={label}>
            <span className={labelText}>OC ważne do</span>
            <input type="date" value={insurance} onChange={(e) => setInsurance(e.target.value)} className={field} />
          </label>

          <label className={label}>
            <span className={labelText}>Przegląd ważny do</span>
            <input type="date" value={inspection} onChange={(e) => setInspection(e.target.value)} className={field} />
          </label>

          <fieldset className="flex flex-col gap-2">
            <legend className={`${labelText} mb-1.5`}>Wymiana oleju</legend>
            <div className="flex flex-wrap gap-2">
              <button type="button" aria-pressed={oil === "inspection"} onClick={() => setOil("inspection")} className={chip(oil === "inspection")}>
                Przy przeglądzie
              </button>
              <button type="button" aria-pressed={oil === "separate"} onClick={() => setOil("separate")} className={chip(oil === "separate")}>
                Osobno
              </button>
              <button type="button" aria-pressed={oil === "none"} onClick={() => setOil("none")} className={chip(oil === "none")}>
                Pomiń
              </button>
            </div>
            {oil === "inspection" && (
              <p className="text-sm text-muted">
                {inspection ? `Razem z przeglądem — ${formatShortDate(inspection, today)}, potem co rok.` : "Podaj datę przeglądu powyżej, a olej przypomnę razem z nim."}
              </p>
            )}
            {oil === "separate" && (
              <div className="grid grid-cols-2 gap-3">
                <label className={label}>
                  <span className="text-sm text-muted">Następna wymiana</span>
                  <input type="date" value={oilDate} onChange={(e) => setOilDate(e.target.value)} className={field} />
                </label>
                <label className={label}>
                  <span className="text-sm text-muted">albo przy (km)</span>
                  <input inputMode="numeric" value={oilKm} onChange={(e) => setOilKm(e.target.value)} placeholder="np. 150 000" className={field} />
                </label>
              </div>
            )}
          </fieldset>

          <label className="flex min-h-11 items-start gap-3">
            <input type="checkbox" checked={tires} onChange={(e) => setTires(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[var(--accent)]" />
            <span className="flex flex-col">
              <span className="font-semibold">Sezonowa zmiana opon</span>
              <span className="text-sm text-muted">
                Zimowe: {formatShortDate(nextSeasonDate("winter_tires", today), today)}, letnie: {formatShortDate(nextSeasonDate("summer_tires", today), today)}. Odznacz przy oponach całorocznych.
              </span>
            </span>
          </label>

          <h2 className={`${sectionTitle} -mb-4`}>Inne</h2>
          <p className="text-sm text-muted">Rozrząd, winietę, gaśnicę i inne terminy dodasz na stronie auta.</p>

          {error && <p className={errorText}>{error}</p>}
          <button type="submit" disabled={save.isPending} className={btnPrimary}>
            {save.isPending ? "Zapisuję…" : "Dodaj auto"}
          </button>
          <button type="button" onClick={() => setStep(1)} className={`${btnQuiet} -mt-3`}>
            Wróć
          </button>
        </form>
      )}
    </main>
  );
}
