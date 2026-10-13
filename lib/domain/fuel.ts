import { addDays, type LocalDate } from "./dates";
import type { FuelLog } from "./model";
import type { Minor } from "./money";

export type FuelStats = {
  /** średnie spalanie l/100 km z odcinków pełny bak → pełny bak; null bez danych */
  avgPer100: number | null;
  /** spalanie z ostatniego odcinka */
  lastPer100: number | null;
  /** koszt paliwa w ostatnich 30 dniach */
  cost30Minor: Minor;
  /** średnia cena za litr z ostatnich 30 dni */
  avgPrice30: number | null;
  /** koszt paliwa na 1 km z odcinków (grosze) */
  costPerKmMinor: number | null;
};

/**
 * Spalanie metodą „do pełna”: między dwoma tankowaniami do pełna liczymy litry z tankowań po pierwszym
 * (włącznie z tym drugim, także częściowe pomiędzy) i dzielimy przez przejechane km.
 */
export function fuelStats(logs: readonly FuelLog[], today: LocalDate): FuelStats {
  const sorted = [...logs].sort((a, b) => a.odometerKm - b.odometerKm || (a.filledOn < b.filledOn ? -1 : 1));
  let liters = 0;
  let km = 0;
  let cost = 0;
  let lastPer100: number | null = null;
  let start: FuelLog | null = null;
  let segLiters = 0;
  let segCost = 0;
  for (const log of sorted) {
    if (start) {
      segLiters += log.liters;
      segCost += log.amountMinor;
    }
    if (log.fullTank) {
      if (start && log.odometerKm > start.odometerKm) {
        const dist = log.odometerKm - start.odometerKm;
        liters += segLiters;
        km += dist;
        cost += segCost;
        lastPer100 = (segLiters / dist) * 100;
      }
      start = log;
      segLiters = 0;
      segCost = 0;
    }
  }
  const since = addDays(today, -29);
  const recent = logs.filter((l) => l.filledOn >= since && l.filledOn <= today);
  const cost30 = recent.reduce((s, l) => s + l.amountMinor, 0);
  const liters30 = recent.reduce((s, l) => s + l.liters, 0);
  return {
    avgPer100: km > 0 ? (liters / km) * 100 : null,
    lastPer100,
    cost30Minor: cost30,
    avgPrice30: liters30 > 0 ? cost30 / 100 / liters30 : null,
    costPerKmMinor: km > 0 ? cost / km : null,
  };
}

export function pricePerLiter(log: Pick<FuelLog, "amountMinor" | "liters">): number {
  return log.amountMinor / 100 / log.liters;
}

/** „6,4 l/100 km” */
export function formatPer100(value: number): string {
  return `${value.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} l/100 km`;
}
