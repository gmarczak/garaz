import { describe, expect, it } from "vitest";
import { fuelStats, pricePerLiter } from "./fuel";
import type { FuelLog } from "./model";

const log = (id: string, filledOn: string, odometerKm: number, liters: number, amountMinor: number, fullTank = true): FuelLog => ({
  id, carId: "c", filledOn, odometerKm, liters, amountMinor, fullTank, station: null,
});

describe("paliwo", () => {
  it("spalanie metodą do pełna, z tankowaniem częściowym w środku", () => {
    const logs = [
      log("1", "2026-09-01", 150000, 40, 24000),
      log("2", "2026-09-10", 150300, 10, 6000, false),
      log("3", "2026-09-20", 150600, 26, 15600),
      log("4", "2026-10-05", 151100, 33, 20130),
    ];
    const s = fuelStats(logs, "2026-10-13");
    expect(s.avgPer100).toBeCloseTo(((10 + 26 + 33) / 1100) * 100);
    expect(s.lastPer100).toBeCloseTo((33 / 500) * 100);
    expect(s.cost30Minor).toBe(15600 + 20130);
    expect(s.avgPrice30).toBeCloseTo((156 + 201.3) / 59);
    expect(s.costPerKmMinor).toBeCloseTo((6000 + 15600 + 20130) / 1100);
  });

  it("bez dwóch pełnych baków nie ma spalania", () => {
    const s = fuelStats([log("1", "2026-10-01", 150000, 40, 24000)], "2026-10-13");
    expect(s.avgPer100).toBeNull();
    expect(s.cost30Minor).toBe(24000);
  });

  it("cena za litr", () => {
    expect(pricePerLiter({ amountMinor: 25110, liters: 40.5 })).toBeCloseTo(6.2);
  });
});
