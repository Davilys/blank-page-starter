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

import { buildAcordoAutoWhatsApp, buildAcordoAutoEmailHtml } from "../../../supabase/functions/_shared/lembreteTemplates";
describe("acordo automático D30 (texto literal ditado)", () => {
  it("1621 em até 5x e 699 em até 3x, sem total nem juros, sem dados do exemplo", () => {
    const d = { nome: "Maria Souza", valor: "R$ 1.621,00", dias: 31, n: 5, dataPrimeira: "31/10/2026", link: "https://x/1" };
    const w = buildAcordoAutoWhatsApp(d);
    expect(w).toContain("Oi Maria! Tudo bem?");
    expect(w).toContain("Parcelamos o débito *R$ 1.621,00* em aberto com mais de 31 dias, em até *5x* no boleto!");
    expect(w).toContain("Primeira parcela só dia *31/10/2026*: https://x/1");
    expect(buildAcordoAutoWhatsApp({ ...d, valor: "R$ 699,00", n: 3 })).toContain("Parcelamos o débito *R$ 699,00* em aberto há 31 dias, em até *3x* no boleto!");
    for (const t of [w, buildAcordoAutoEmailHtml(d)]) { expect(/juros|total|768|1\.783|Samuel|73 dias/i.test(t)).toBe(false); }
  });
  it("WhatsApp curto com negrito nativo exato (sem asteriscos duplicados) e e-mail integral com strong", () => {
    const d = { nome: "Maria Souza", valor: "R$ 1.621,00", dias: 31, n: 5, dataPrimeira: "31/10/2026", link: "https://x/1" };
    const w = buildAcordoAutoWhatsApp(d);
    expect(w).toContain("*R$ 1.621,00*"); expect(w).toContain("*5x*"); expect(w).toContain("*31/10/2026*");
    expect(w).toContain("*mantém seu contrato ativo e evita qualquer risco de cancelamento*");
    expect(w).not.toMatch(/\*\*/); expect((w.match(/\*/g) || []).length % 2).toBe(0);
    expect(w).not.toContain("Nosso objetivo");
    expect(w).toContain("Só para confirma aqui ja liberei essa condição pra você, combinado... 👍");
    const e = buildAcordoAutoEmailHtml(d);
    expect(e).toContain("<strong>R$ 1.621,00</strong>"); expect(e).toContain("<strong>5x</strong>");
    expect(e).toContain("<strong>mantém seu contrato ativo e evita qualquer risco de cancelamento</strong>");
    expect(e).toContain("Nosso objetivo é garantir que sua marca continue protegida e em andamento no INPI.");
    expect(e).not.toContain("*");
  });
  it("D5 é o texto genérico original aprovado", () => {
    const w = buildWhatsApp("Maria", "", "24/10/2026", "https://x", "R$ 699,00", "vencido_d5", "Registro de marca");
    expect(w).toContain("A falta de pagamento pode prejudicar o andamento do seu processo e dos serviços contratados.");
    expect(w).not.toMatch(/cl[áa]usula|exig[íi]vel/i);
  });
});

describe("acordo manual reutiliza textos aprovados", () => {
  it("atraso 'ha' forca 'há N dias' independente de n; sem asteriscos duplicados", () => {
    const d = { nome: "Ana", valor: "R$ 2.000,00", dias: 12, n: 5, dataPrimeira: "05/11/2026", link: "https://x/1", atraso: "ha" as const };
    const w = buildAcordoAutoWhatsApp(d);
    expect(w).toContain("Parcelamos o débito *R$ 2.000,00* em aberto há 12 dias, em até *5x* no boleto!");
    expect(w).not.toMatch(/\*\*/);
  });
});
