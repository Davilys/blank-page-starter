import { describe, it, expect } from "vitest";
import { isExigencia1621, isRegistro699, regraAcordo, businessHourBRT, primeiraParcelaAuto, dayBRT } from "../../../supabase/functions/_shared/reguaElegibilidade";
import { buildWhatsApp, buildEmailHtml, buildSubject, TIPOS_LEMBRETE } from "../../../supabase/functions/_shared/lembreteTemplates";

describe("regra de acordo automático", () => {
  it("exigência 1621 = 5x com 10% (1783,10 / 356,62)", () => {
    const r = regraAcordo(1621, "Exigência INPI - marca X")!;
    expect(r).toEqual({ numParcelas: 5, jurosPct: 10, total: 1783.1, parcela: 356.62 });
  });
  it("registro 699 = 3x com 10% (768,90 / 256,30)", () => {
    const r = regraAcordo(699, "Registro de marca - WebMarcas")!;
    expect(r).toEqual({ numParcelas: 3, jurosPct: 10, total: 768.9, parcela: 256.3 });
  });
  it("outros valores/serviços/parcelas/acordos não entram", () => {
    expect(regraAcordo(700, "Registro de marca")).toBeNull();
    expect(regraAcordo(1621, "Taxa qualquer")).toBeNull();
    expect(regraAcordo(699, "Parcela 1/3 - registro de marca")).toBeNull();
    expect(regraAcordo(699, "Acordo registro de marca")).toBeNull();
    expect(regraAcordo(1621, "Acordo exigência INPI")).toBeNull();
    expect(regraAcordo(699, "Exigência registro de marca")).toBeNull();
    expect(isExigencia1621(1621.01, "exigencia inpi")).toBe(false);
    expect(isRegistro699(699, null)).toBe(false);
  });
});

describe("datas BRT", () => {
  it("primeira parcela = hoje+7 em BRT (virada de mês e fuso)", () => {
    expect(primeiraParcelaAuto(new Date("2026-10-24T15:00:00Z"))).toBe("2026-10-31");
    expect(primeiraParcelaAuto(new Date("2026-10-28T12:00:00Z"))).toBe("2026-11-04");
    // 01:00Z do dia 1/11 ainda é 31/10 em BRT
    expect(dayBRT(new Date("2026-11-01T01:00:00Z"))).toBe("2026-10-31");
  });
  it("horário comercial seg-sáb 08-18", () => {
    expect(businessHourBRT(new Date("2026-10-24T14:00:00Z"))).toBe(true);  // sáb 11h
    expect(businessHourBRT(new Date("2026-10-25T14:00:00Z"))).toBe(false); // dom
    expect(businessHourBRT(new Date("2026-10-26T10:00:00Z"))).toBe(false); // seg 07h
    expect(businessHourBRT(new Date("2026-10-26T21:00:00Z"))).toBe(false); // seg 18h
  });
});

describe("textos dos lembretes", () => {
  it("todos os tipos geram texto com nome, valor e serviço, sem citar cláusula ou rescisão", () => {
    for (const t of TIPOS_LEMBRETE) {
      const w = buildWhatsApp("Maria Souza", "hoje", "24/10/2026", "https://x/y", "R$ 699,00", t, "Registro de marca");
      const e = buildEmailHtml("Maria Souza", "hoje", "24/10/2026", "https://x/y", "R$ 699,00", t, "Registro de marca");
      expect(w).toContain("Maria"); expect(w).toContain("699,00"); expect(w).toContain("Registro de marca");
      expect(e).toContain("699,00");
      expect(buildSubject(t, "hoje", "24/10/2026").length).toBeGreaterThan(5);
      for (const txt of [w, e]) expect(/cl[áa]usula|rescis|encerrad/i.test(txt)).toBe(false);
    }
  });
});
