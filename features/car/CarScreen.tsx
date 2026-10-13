"use client";

import { ChevronLeft, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { btnPrimary, btnQuiet, btnSecondary, errorText, field, label, labelText, sectionTitle } from "@/components/ui/styles";
import { useOpenFuel } from "@/features/shell/AppShell";
import { CompleteForm } from "@/features/terms/CompleteForm";
import { TermEditor } from "@/features/terms/TermEditor";
import { StatusDot, statusText, statusTone } from "@/features/terms/TermLine";
import { useAction, useSnapshot, useToday } from "@/lib/data/hooks";
import { archiveCar, deleteFuel, deleteService, errorMessage, setOdometer, updateCar, withOdometer } from "@/lib/data/mutations";
import type { LocalDate } from "@/lib/domain/dates";
import { fuelStats, formatPer100, pricePerLiter } from "@/lib/domain/fuel";
import { carLabel, type Car, type FuelLog, type Service, type Term } from "@/lib/domain/model";
import { formatMoney } from "@/lib/domain/money";
import { parseKm } from "@/lib/domain/parse";
import { termStatus, termTitle } from "@/lib/domain/terms";
import { formatKm, formatLiters, formatPricePerLiter, formatShortDate } from "@/lib/format";
import { CarFields, carToDraft, draftToCar, type CarDraft } from "./CarFields";
import { ServiceForm } from "./ServiceForm";

type Sheet =
  | { type: "complete"; term: Term }
  | { type: "term"; term?: Term }
  | { type: "service" }
  | { type: "odometer" }
  | { type: "edit" }
  | { type: "fuel-log"; log: FuelLog }
  | { type: "service-log"; service: Service }
  | null;

const HISTORY_STEP = 10;

export function CarScreen({ id }: { id: string }) {
  const { data: snapshot } = useSnapshot();
  const today = useToday(snapshot);
  const openFuel = useOpenFuel();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [fuelShown, setFuelShown] = useState(5);
  const [historyShown, setHistoryShown] = useState(HISTORY_STEP);
  if (!snapshot || !today) return null;

  const car = snapshot.cars.find((c) => c.id === id);
  if (!car) {
    return (
      <main className="flex flex-col gap-4 px-5 pt-10">
        <h1 className="font-serif text-2xl font-semibold">Nie ma takiego auta</h1>
        <Link href="/" className={`${btnSecondary} self-start`}>
          Wróć do garażu
        </Link>
      </main>
    );
  }

  const archived = car.archivedAt !== null;
  const terms = snapshot.terms
    .filter((t) => t.carId === car.id && t.active)
    .map((t) => ({ term: t, status: termStatus(t, today, car.odometerKm) }))
    .sort((a, b) => (a.term.dueOn ?? "9999").localeCompare(b.term.dueOn ?? "9999"));
  const fuel = snapshot.fuel.filter((f) => f.carId === car.id);
  const stats = fuelStats(fuel, today);
  const services = snapshot.services.filter((s) => s.carId === car.id);
  const close = () => setSheet(null);

  return (
    <main className="flex flex-col gap-8 px-5 pt-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-1">
          <Link href="/" aria-label="Wróć do garażu" className="-ml-3 flex h-11 w-11 items-center justify-center">
            <ChevronLeft aria-hidden="true" size={24} />
          </Link>
          <h1 className="min-w-0 flex-1 truncate font-serif text-[32px] font-semibold">{car.name}</h1>
          <button type="button" aria-label="Edytuj auto" onClick={() => setSheet({ type: "edit" })} className="-mr-2 flex h-11 w-11 items-center justify-center text-muted">
            <Pencil aria-hidden="true" size={20} />
          </button>
        </div>
        {carLabel(car) && <p className="text-muted">{carLabel(car)}</p>}
        <button type="button" onClick={() => setSheet({ type: "odometer" })} className="mt-1 flex min-h-11 items-center gap-2 self-start text-left">
          <span className="text-[17px] font-semibold">{car.odometerKm !== null ? formatKm(car.odometerKm) : "Przebieg nieznany"}</span>
          <span className="text-sm text-accent">Zmień</span>
        </button>
        {archived && <p className="rounded-xl bg-surface px-4 py-3 text-sm">To auto jest w archiwum — nie przypominam o jego terminach.</p>}
      </header>

      <section className="flex flex-col gap-2" aria-labelledby="terms">
        <h2 id="terms" className={sectionTitle}>
          Terminy
        </h2>
        {terms.length === 0 && <p className="text-muted">Brak terminów. Dodaj OC, przegląd albo wymianę oleju.</p>}
        <ul className="flex flex-col">
          {terms.map(({ term, status }) => (
            <li key={term.id} className="flex items-center gap-3 border-b border-border py-3">
              <StatusDot status={status} />
              <button type="button" onClick={() => setSheet({ type: "term", term })} className="flex min-w-0 flex-1 flex-col text-left">
                <span className="truncate font-semibold">{termTitle(term)}</span>
                <span className={`text-sm ${statusTone(status)}`}>{statusText(term.dueOn, status, today)}</span>
              </button>
              {!archived && (
                <button
                  type="button"
                  onClick={() => setSheet({ type: "complete", term })}
                  className="inline-flex h-11 shrink-0 items-center rounded-full border-[1.5px] border-control px-4 text-sm font-semibold"
                >
                  Zrobione
                </button>
              )}
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => setSheet({ type: "term" })} className={`${btnQuiet} gap-1.5 self-start px-0`}>
          <Plus aria-hidden="true" size={18} /> Dodaj termin
        </button>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="fuel">
        <div className="flex items-center justify-between">
          <h2 id="fuel" className={sectionTitle}>
            Paliwo
          </h2>
          {!archived && (
            <button type="button" onClick={() => openFuel(car.id)} className={`${btnQuiet} gap-1.5 pr-0 text-accent`}>
              <Plus aria-hidden="true" size={18} /> Tankowanie
            </button>
          )}
        </div>
        {fuel.length === 0 ? (
          <p className="text-muted">Zapisuj tankowania „do pełna”, a policzę średnie spalanie i koszt kilometra.</p>
        ) : (
          <>
            <dl className="grid grid-cols-3 gap-2">
              <Stat label="l/100 km" value={stats.avgPer100 !== null ? formatPer100(stats.avgPer100).replace(" l/100 km", "") : "—"} />
              <Stat label="30 dni" value={formatMoney(stats.cost30Minor, { cents: "never" })} />
              <Stat label="Za 1 km" value={stats.costPerKmMinor !== null ? formatMoney(Math.round(stats.costPerKmMinor), { cents: "always" }) : "—"} />
            </dl>
            {stats.avgPer100 === null && <p className="text-sm text-muted">Spalanie pokażę po drugim tankowaniu do pełna.</p>}
            <ul className="flex flex-col">
              {fuel.slice(0, fuelShown).map((f) => (
                <li key={f.id}>
                  <button type="button" onClick={() => setSheet({ type: "fuel-log", log: f })} className="flex w-full items-center gap-3 border-b border-border py-3 text-left">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-semibold">
                        {formatShortDate(f.filledOn, today)} · {formatLiters(f.liters)}
                        {!f.fullTank && <span className="font-normal text-muted"> · dolewka</span>}
                      </span>
                      <span className="text-sm text-muted">
                        {formatKm(f.odometerKm)} · {formatPricePerLiter(pricePerLiter(f))}
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums">{formatMoney(f.amountMinor)}</span>
                  </button>
                </li>
              ))}
            </ul>
            {fuel.length > fuelShown && (
              <button type="button" onClick={() => setFuelShown((n) => n + 20)} className={`${btnQuiet} self-start px-0`}>
                Pokaż starsze
              </button>
            )}
          </>
        )}
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="history">
        <div className="flex items-center justify-between">
          <h2 id="history" className={sectionTitle}>
            Historia serwisu
          </h2>
          <button type="button" onClick={() => setSheet({ type: "service" })} className={`${btnQuiet} gap-1.5 pr-0 text-accent`}>
            <Plus aria-hidden="true" size={18} /> Wpis
          </button>
        </div>
        {services.length === 0 ? (
          <p className="text-muted">Tu trafi każde „Zrobione” i naprawy, które dopiszesz.</p>
        ) : (
          <ul className="flex flex-col">
            {services.slice(0, historyShown).map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => setSheet({ type: "service-log", service: s })} className="flex w-full items-center gap-3 border-b border-border py-3 text-left">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold">{s.title}</span>
                    <span className="text-sm text-muted">{[formatShortDate(s.doneOn, today), s.odometerKm !== null ? formatKm(s.odometerKm) : null].filter(Boolean).join(" · ")}</span>
                  </span>
                  {s.costMinor !== null && <span className="font-semibold tabular-nums">{formatMoney(s.costMinor)}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        {services.length > historyShown && (
          <button type="button" onClick={() => setHistoryShown((n) => n + HISTORY_STEP)} className={`${btnQuiet} self-start px-0`}>
            Pokaż starsze
          </button>
        )}
      </section>

      <ArchiveToggle car={car} />

      <Modal open={sheet?.type === "complete"} onClose={close} title={sheet?.type === "complete" ? `Zrobione: ${termTitle(sheet.term)}` : ""} subtitle={car.name}>
        {sheet?.type === "complete" && <CompleteForm term={sheet.term} car={car} terms={snapshot.terms} today={today} onDone={close} />}
      </Modal>
      <Modal open={sheet?.type === "term"} onClose={close} title={sheet?.type === "term" && sheet.term ? termTitle(sheet.term) : "Nowy termin"} subtitle={car.name}>
        {sheet?.type === "term" && <TermEditor carId={car.id} term={sheet.term} today={today} onDone={close} />}
      </Modal>
      <Modal open={sheet?.type === "service"} onClose={close} title="Wpis serwisowy" subtitle={car.name}>
        {sheet?.type === "service" && <ServiceForm car={car} today={today} onDone={close} />}
      </Modal>
      <Modal open={sheet?.type === "odometer"} onClose={close} title="Przebieg" subtitle={car.name}>
        {sheet?.type === "odometer" && <OdometerForm car={car} onDone={close} />}
      </Modal>
      <Modal open={sheet?.type === "edit"} onClose={close} title="Edytuj auto">
        {sheet?.type === "edit" && <EditCar car={car} onDone={close} />}
      </Modal>
      <Modal open={sheet?.type === "fuel-log"} onClose={close} title="Tankowanie" subtitle={sheet?.type === "fuel-log" ? formatShortDate(sheet.log.filledOn, today) : undefined}>
        {sheet?.type === "fuel-log" && <FuelDetails log={sheet.log} onDone={close} />}
      </Modal>
      <Modal open={sheet?.type === "service-log"} onClose={close} title={sheet?.type === "service-log" ? sheet.service.title : ""} subtitle={sheet?.type === "service-log" ? formatShortDate(sheet.service.doneOn, today) : undefined}>
        {sheet?.type === "service-log" && <ServiceDetails service={sheet.service} today={today} onDone={close} />}
      </Modal>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl bg-surface px-3 py-3">
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</dt>
      <dd className="text-[15px] font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function OdometerForm({ car, onDone }: { car: Car; onDone: () => void }) {
  const [value, setValue] = useState(car.odometerKm !== null ? String(car.odometerKm) : "");
  const [error, setError] = useState<string | null>(null);
  const save = useAction(setOdometer, withOdometer);
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const km = parseKm(value);
    if (km === null) return setError("Wpisz przebieg w pełnych kilometrach, np. 123 456.");
    save.mutate({ id: car.id, odometerKm: km }, { onSuccess: onDone, onError: (err) => setError(errorMessage(err)) });
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <label className={label}>
        <span className={labelText}>Stan licznika (km)</span>
        <input autoFocus inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} className={field} />
      </label>
      <p className="-mt-2 text-sm text-muted">Tankowania i wpisy serwisowe aktualizują go same.</p>
      {error && <p className={errorText}>{error}</p>}
      <button type="submit" disabled={save.isPending} className={btnPrimary}>
        Zapisz
      </button>
    </form>
  );
}

function EditCar({ car, onDone }: { car: Car; onDone: () => void }) {
  const [draft, setDraft] = useState<CarDraft>(() => carToDraft(car));
  const [error, setError] = useState<string | null>(null);
  const save = useAction(updateCar);
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const form = draftToCar(draft);
    if (typeof form === "string") return setError(form);
    save.mutate({ id: car.id, car: form }, { onSuccess: onDone, onError: (err) => setError(errorMessage(err)) });
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <CarFields draft={draft} onChange={setDraft} />
      {error && <p className={errorText}>{error}</p>}
      <button type="submit" disabled={save.isPending} className={btnPrimary}>
        Zapisz
      </button>
    </form>
  );
}

function ArchiveToggle({ car }: { car: Car }) {
  const router = useRouter();
  const toast = useToast();
  const archive = useAction(archiveCar);
  const archived = car.archivedAt !== null;
  return (
    <section className="flex flex-col gap-2 pb-6">
      {archived ? (
        <button
          type="button"
          disabled={archive.isPending}
          onClick={() => archive.mutate({ id: car.id, archived: false }, { onError: (err) => toast({ message: errorMessage(err) }) })}
          className={`${btnSecondary} self-start`}
        >
          Przywróć z archiwum
        </button>
      ) : (
        <div className="flex flex-col items-start gap-2">
          <ConfirmButton
            label="Przenieś do archiwum"
            confirmLabel="Na pewno? Dotknij ponownie"
            disabled={archive.isPending}
            onConfirm={() =>
              archive.mutate(
                { id: car.id, archived: true },
                {
                  onSuccess: () => {
                    toast({ message: `${car.name} w archiwum` });
                    router.replace("/");
                  },
                  onError: (err) => toast({ message: errorMessage(err) }),
                },
              )
            }
          />
          <p className="text-xs text-muted">Sprzedane albo oddane auto: historia zostaje, przypomnienia znikają.</p>
        </div>
      )}
    </section>
  );
}

function FuelDetails({ log, onDone }: { log: FuelLog; onDone: () => void }) {
  const remove = useAction(deleteFuel);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Detail label="Kwota" value={formatMoney(log.amountMinor)} />
        <Detail label="Litry" value={formatLiters(log.liters)} />
        <Detail label="Cena" value={formatPricePerLiter(pricePerLiter(log))} />
        <Detail label="Przebieg" value={formatKm(log.odometerKm)} />
        <Detail label="Do pełna" value={log.fullTank ? "Tak" : "Nie (dolewka)"} />
        {log.station && <Detail label="Stacja" value={log.station} />}
      </dl>
      {error && <p className={errorText}>{error}</p>}
      <ConfirmButton label="Usuń tankowanie" disabled={remove.isPending} onConfirm={() => remove.mutate(log.id, { onSuccess: onDone, onError: (err) => setError(errorMessage(err)) })} />
    </div>
  );
}

function ServiceDetails({ service, today, onDone }: { service: Service; today: LocalDate; onDone: () => void }) {
  const remove = useAction(deleteService);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Detail label="Kiedy" value={formatShortDate(service.doneOn, today)} />
        {service.odometerKm !== null && <Detail label="Przebieg" value={formatKm(service.odometerKm)} />}
        {service.costMinor !== null && <Detail label="Koszt" value={formatMoney(service.costMinor)} />}
      </dl>
      {service.note && <p className="whitespace-pre-wrap rounded-xl bg-surface px-4 py-3">{service.note}</p>}
      <p className="text-xs text-muted">Usunięcie wpisu nie cofa przesuniętych terminów — popraw je ręcznie, jeśli trzeba.</p>
      {error && <p className={errorText}>{error}</p>}
      <ConfirmButton label="Usuń wpis" disabled={remove.isPending} onConfirm={() => remove.mutate(service.id, { onSuccess: onDone, onError: (err) => setError(errorMessage(err)) })} />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
