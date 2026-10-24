// Runtime real dos 6 consumidores zod (base 3.25.76 x candidato 4.6.7) — ASSERTS REAIS.
// Versao exata via EXPECTED_ZOD_VERSION (CI injeta). Paridade/msgs esperadas sao
// ASSERTADAS aqui; o JSON em /tmp/fix e evidencia auxiliar, nao o criterio.
// O array 50k e FIXTURE DE DESEMPENHO apenas (nao demonstra mitigacao do advisory).
import { it, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const zodVersion = req('zod/package.json').version as string;
const out: Record<string, unknown> = { zodVersion };

it('versao exata instalada == esperada pela branch', () => {
  expect(process.env.EXPECTED_ZOD_VERSION, 'CI deve injetar EXPECTED_ZOD_VERSION').toBeTruthy();
  expect(zodVersion).toBe(process.env.EXPECTED_ZOD_VERSION);
});

it('1: PersonalDataStep.personalDataSchema', async () => {
  const { personalDataSchema } = await import('@/components/cliente/checkout/PersonalDataStep');
  const v = { fullName: 'Maria Exemplo Silva', email: 'maria@exemplo.com', phone: '(11) 98983-2130', cpf: '529.982.247-25', cep: '01310-100', address: 'Av. Paulista, 1000', neighborhood: 'Bela Vista', city: 'São Paulo', state: 'SP' };
  const ok = personalDataSchema.safeParse(v);
  expect(ok.success).toBe(true);
  if (ok.success) expect(ok.data.state).toBe('SP');
  const email = personalDataSchema.safeParse({ ...v, email: 'x' });
  expect(email.success).toBe(false);
  if (!email.success) {
    expect(email.error.issues[0].path.map(String)).toEqual(['email']);
    expect(email.error.issues[0].message).toBe('E-mail inválido');
  }
  const cpf = personalDataSchema.safeParse({ ...v, cpf: '111.111.111-11' });
  expect(cpf.success).toBe(false);
  if (!cpf.success) expect(cpf.error.issues[0].message).toBe('CPF inválido');
  const uf = personalDataSchema.safeParse({ ...v, state: 'SPX' });
  expect(uf.success).toBe(false);
  if (!uf.success) expect(uf.error.issues[0].message).toBe('UF obrigatória');
  const cep = personalDataSchema.safeParse({ ...v, cep: '01310100' });
  expect(cep.success).toBe(false);
  if (!cep.success) expect(cep.error.issues[0].message).toBe('CEP inválido');
  const nulo = personalDataSchema.safeParse({ ...v, fullName: null });
  expect(nulo.success).toBe(false);
  if (!nulo.success) expect(nulo.error.issues[0].code).toBe('invalid_type');
  out.personalDataStep = { ok: true };
});

it('2: CreateContractDialog personal+brand (refine composto)', async () => {
  const m = await import('@/components/admin/contracts/CreateContractDialog');
  const p = { fullName: 'João Exemplo', email: 'joao@exemplo.com', phone: '(11) 91234-5678', cpf: '529.982.247-25', cep: '01310-100', address: 'Rua Exemplo, 1', neighborhood: 'Centro', city: 'São Paulo', state: 'SP' };
  expect(m.personalDataSchema.safeParse(p).success).toBe(true);
  const email = m.personalDataSchema.safeParse({ ...p, email: 'x' });
  expect(email.success).toBe(false);
  if (!email.success) expect(email.error.issues[0].message).toBe('Email inválido'); // sem acento, L131
  const semCnpj = m.brandDataSchema.safeParse({ brandName: 'MARCA X', businessArea: 'Consultoria', hasCNPJ: false });
  expect(semCnpj.success).toBe(true);
  const cnpjFaltando = m.brandDataSchema.safeParse({ brandName: 'MARCA X', businessArea: 'Consultoria', hasCNPJ: true });
  expect(cnpjFaltando.success).toBe(false);
  if (!cnpjFaltando.success) {
    expect(cnpjFaltando.error.issues[0].message).toBe('CNPJ ou Razão Social inválidos');
    expect(cnpjFaltando.error.issues[0].path.map(String)).toEqual(['cnpj']);
  }
  const razaoCurta = m.brandDataSchema.safeParse({ brandName: 'MARCA X', businessArea: 'Consultoria', hasCNPJ: true, cnpj: '11.222.333/0001-81', companyName: 'AB' });
  expect(razaoCurta.success).toBe(false);
  const completa = m.brandDataSchema.safeParse({ brandName: 'MARCA X', businessArea: 'Consultoria', hasCNPJ: true, cnpj: '11.222.333/0001-81', companyName: 'Razão Social Exemplo' });
  expect(completa.success).toBe(true);
  out.createContractDialog = { ok: true };
});

it('3: QuickStepsForm quick+comp (trim transforma output; max preserva texto v3)', async () => {
  const m = await import('@/components/formulario/QuickStepsForm');
  const trim = m.quickSchema.safeParse({ brandName: '  MARCA X  ', businessArea: 'Consultoria', fullName: 'Maria Exemplo', email: ' maria@exemplo.com ', phone: '(11) 98983-2130' });
  expect(trim.success).toBe(true);
  if (trim.success) {
    expect(trim.data.brandName).toBe('MARCA X');
    expect(trim.data.email).toBe('maria@exemplo.com');
  }
  const fone = m.quickSchema.safeParse({ brandName: 'MARCA X', businessArea: 'Consultoria', fullName: 'Maria Exemplo', email: 'maria@exemplo.com', phone: '(11) 98983-21309' });
  expect(fone.success).toBe(false);
  if (!fone.success) expect(fone.error.issues[0].message).toBe('String must contain at most 15 character(s)'); // texto v3 PRESERVADO no schema
  const comp = m.compSchema.safeParse({ cpf: '529.982.247-25', cep: '01310-100', address: 'Rua Exemplo, 1', neighborhood: 'Centro', city: 'São Paulo', state: 'SP' });
  expect(comp.success).toBe(true);
  const compBad = m.compSchema.safeParse({ cpf: '123', cep: '01310-100', address: 'Rua Exemplo, 1', neighborhood: 'Centro', city: 'São Paulo', state: 'SP' });
  expect(compBad.success).toBe(false);
  if (!compBad.success) expect(compBad.error.issues[0].message).toBe('CPF inválido');
  out.quickStepsForm = { ok: true };
});

it('4: BrandDataStep.brandDataSchema', async () => {
  const m = await import('@/components/cliente/checkout/BrandDataStep');
  expect(m.brandDataSchema.safeParse({ brandName: 'MARCA Y', businessArea: 'Alimentos', hasCNPJ: false }).success).toBe(true);
  const bad = m.brandDataSchema.safeParse({ brandName: 'MARCA Y', businessArea: 'Alimentos', hasCNPJ: true, cnpj: '00.000.000/0000-00', companyName: 'Razão Completa' });
  expect(bad.success).toBe(false);
  if (!bad.success) expect(bad.error.issues[0].path.map(String)).toEqual(['cnpj']);
  out.brandDataStep = { ok: true };
});

it('5: CreateClientDialog.formSchema (combinado + opcionais)', async () => {
  const m = await import('@/components/admin/clients/CreateClientDialog');
  const base = { fullName: 'Maria Exemplo', email: 'maria@exemplo.com', phone: '(11) 98983-2130', cpf: '529.982.247-25', cep: '01310-100', address: 'Rua Exemplo, 1', neighborhood: 'Centro', city: 'São Paulo', state: 'SP', brandName: 'MARCA Z', businessArea: 'Serviços', hasCNPJ: false };
  expect(m.formSchema.safeParse(base).success).toBe(true);
  const comOp = m.formSchema.safeParse({ ...base, addressNumber: '100', cnpj: undefined, companyName: undefined });
  expect(comOp.success).toBe(true);
  const multi = m.formSchema.safeParse({ ...base, email: 'x', cpf: '123', state: 'X' });
  expect(multi.success).toBe(false);
  if (!multi.success) {
    const map: Record<string, string> = {};
    multi.error.issues.forEach((x) => { if (x.path[0]) map[String(x.path[0])] = x.message; });
    expect(map.email).toBe('E-mail inválido');
    expect(map.cpf).toBe('CPF inválido');
    expect(map.state).toBe('UF obrigatória');
  }
  out.createClientDialog = { ok: true };
});

it('6: providerResponse (vetor real) + fixture de desempenho 50k', async () => {
  const m = await import('@/lib/dataEnrichment/providerResponse');
  const valida = m.parseProviderResponse({ success: true, status: 'success', source: 'BrasilAPI', documentType: 'cnpj', data: { company_name: 'EMPRESA EXEMPLO LTDA', share_capital: 100000, emails: ['a@b.com'] } });
  expect(valida.success).toBe(true);
  expect(valida.status).toBe('success');
  const enumBad = m.parseProviderResponse({ success: true, status: 'weird', source: null, documentType: 'cnpj' });
  expect(enumBad.success).toBe(false);
  expect(enumBad.status).toBe('provider_error');
  expect(enumBad.message).toBe('Não foi possível consultar os dados agora. Tente novamente.');
  const tipoBad = m.parseProviderResponse({ success: 'sim', status: 'success', source: null, documentType: 'cnpj' });
  expect(tipoBad.success).toBe(false);
  const nulls = m.parseProviderResponse({ success: true, status: 'success', source: null, documentType: 'cpf', data: { full_name: null, share_capital: null } });
  expect(nulls.success).toBe(true);
  const capString = m.parseProviderResponse({ success: true, status: 'success', source: null, documentType: 'cnpj', data: { share_capital: '100000' } });
  expect(capString.success).toBe(false);
  // FIXTURE DE DESEMPENHO (nao e prova de mitigacao do GHSA-mrhx-c7xc-m3w5):
  const grande = Array.from({ length: 50000 }, (_, i) => 'e' + i + '@x.com');
  const t0 = Date.now();
  const g = m.parseProviderResponse({ success: true, status: 'success', source: null, documentType: 'cnpj', data: { emails: grande } });
  const ms = Date.now() - t0;
  expect(g.success).toBe(true);
  out.providerResponse = { ok: true, arrayGrande50kMs: ms };
});

it('grava evidencia auxiliar', () => {
  mkdirSync('/tmp/fix', { recursive: true });
  writeFileSync(`/tmp/fix/zod-rt-${zodVersion}.json`, JSON.stringify(out, null, 1));
});
