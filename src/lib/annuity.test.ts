import { describe, it, expect } from "vitest";
import { calcAnnuityDueDate, campaignStartDate, todaySaoPaulo } from "./annuity";

describe("vencimento da anuidade (D+5, sex/sáb/dom → segunda)", () => {
  const cases: [string, string][] = [
    ["2026-12-10", "2026-12-15"], ["2026-12-11", "2026-12-16"], ["2026-12-12", "2026-12-17"],
    ["2026-12-13", "2026-12-21"], ["2026-12-14", "2026-12-21"], ["2026-12-15", "2026-12-21"],
    ["2026-12-16", "2026-12-21"],
  ];
  it.each(cases)("emissão %s → %s", (e, v) => expect(calcAnnuityDueDate(e)).toBe(v));
  it("virada de ano", () => {
    expect(calcAnnuityDueDate("2026-12-28")).toBe("2027-01-04"); // 02/01 sábado → segunda 04
    expect(calcAnnuityDueDate("2026-12-29")).toBe("2027-01-04"); // 03/01 domingo
  });
  it("virada de mês", () => expect(calcAnnuityDueDate("2027-11-27")).toBe("2027-12-02"));
  it("início dinâmico por exercício", () => {
    expect(campaignStartDate(2026)).toBe("2026-12-10");
    expect(campaignStartDate(2028)).toBe("2028-12-10");
  });
  it("perto da meia-noite usa data de São Paulo", () => {
    expect(todaySaoPaulo(new Date("2026-12-11T02:30:00Z"))).toBe("2026-12-10");
  });
});
