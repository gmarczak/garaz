import { describe, expect, it } from "vitest";
import { parseKm, parseLiters } from "./parse";

describe("parseKm", () => {
  it("przyjmuje spacje i jednostkę", () => {
    expect(parseKm("123 456")).toBe(123456);
    expect(parseKm("98000 km")).toBe(98000);
    expect(parseKm("0")).toBe(0);
  });
  it("odrzuca ułamki, minus i puste", () => {
    expect(parseKm("12,5")).toBeNull();
    expect(parseKm("-5")).toBeNull();
    expect(parseKm("")).toBeNull();
    expect(parseKm("12345678")).toBeNull();
  });
});

describe("parseLiters", () => {
  it("przecinek i kropka", () => {
    expect(parseLiters("45,32")).toBe(45.32);
    expect(parseLiters("40.5")).toBe(40.5);
    expect(parseLiters("38")).toBe(38);
  });
  it("odrzuca zero, 3 miejsca po przecinku i śmieci", () => {
    expect(parseLiters("0")).toBeNull();
    expect(parseLiters("4,123")).toBeNull();
    expect(parseLiters("abc")).toBeNull();
    expect(parseLiters("1000")).toBeNull();
  });
});
