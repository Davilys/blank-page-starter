// @vitest-environment happy-dom
// PARIDADE xlsx 0.18.5 (npm) x 0.20.3 (tarball oficial CDN SheetJS) nos ENTRYPOINTS REAIS do app.
// Goldens gerados executando os mesmos entrypoints na árvore main (0.18.5) — paridade é
// ASSERT contra golden, não relato. Sem rede, sem cobrança, sem envios, sem escrita em
// produção: sinks de download (XLSX.writeFile) capturados via vi.mock — a conversão é real.
// LIMITES DECLARADOS: (a) arquivo inválido RESOLVE com header mojibake — comportamento
// atual preservado (não é melhoria de validação); (b) datas viram números seriais
// (cellDates não é usado pelo app) — golden registra; (c) CVE-2023-30533 sondado bounded
// (headers __proto__/constructor + Object.prototype limpo) — não é prova completa do
// exploit; (d) CVE-2024-22363 (ReDoS) NÃO provado — fix citado do CHANGELOG upstream;
// (e) toasts (sonner) não renderizam no happy-dom — estado assertado via DOM estável.
import { it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';

let capturedWb: unknown = null;
vi.mock('xlsx', async (importOriginal) => {
  const actual = await importOriginal<typeof import('xlsx')>();
  return { ...actual, writeFile: (wb: unknown) => { capturedWb = wb; } };
});

import * as XLSX from 'xlsx';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { parseExcel } from '@/lib/clientParser';
import { extractContent } from '@/lib/inpi/caseDocuments';
import { convertDocument } from '@/lib/inpi/packageBuilder';
import { exportToExcel } from '@/lib/clientExporter';
import { LeadImportExportDialog } from '@/components/admin/leads/LeadImportExportDialog';

const FX = 'src/lib/__tests__/fixtures-xlsx';
const file = (n: string) => new File([readFileSync(`${FX}/${n}`)], n, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

const GOLD = {
 "parseExcel": {
  "headers": [
   "Nome",
   "CPF",
   "Telefone",
   "E-mail",
   "Valor",
   "Data",
   "Obs"
  ],
  "errors": [],
  "format": "xlsx",
  "rows": [
   {
    "Nome": "José São Áéìòu çÃÕ",
    "CPF": "012.345.678-90",
    "Telefone": "(11) 90000-0001",
    "E-mail": "jose@exemplo.com",
    "Valor": 1234.56,
    "Data": 46037.37467592592,
    "Obs": "obs normal"
   },
   {
    "Nome": "María \"aspas\" e\nquebra",
    "CPF": "000.000.001-91",
    "Telefone": "(11) 90000-0002",
    "E-mail": "maria@exemplo.com",
    "Valor": 0.01,
    "Data": 36525.416342592594,
    "Obs": ""
   },
   {
    "Nome": "",
    "CPF": "",
    "Telefone": "",
    "E-mail": 2,
    "Valor": "",
    "Data": "",
    "Obs": ""
   },
   {
    "Nome": "Sem CPF número",
    "CPF": 1234567890,
    "Telefone": "(11) 90000-0003",
    "E-mail": "num@exemplo.com",
    "Valor": -50.5,
    "Obs": "null date"
   }
  ]
 },
 "parseExcelVazia": {
  "headers": [],
  "errors": [
   "Planilha vazia"
  ],
  "dataLen": 0
 },
 "parseExcelInvalido": {
  "resolvido": true,
  "headers": [
   "isso nÃ£o Ã© um xlsx de verdade"
  ],
  "errors": [],
  "dataLen": 0
 },
 "extractInpi": {
  "status": "lido",
  "text": "### Planilha: Publicações\nProcesso,Marca,Titular\n900123456,MARCA TESTE É,Titular São\n900654321,OUTRA MARCA,Titular Ç\n\n### Planilha: Dados\nCol1,Col2\n1.5,texto ÇÃ",
  "notes": "2 aba(s) lida(s): Publicações, Dados.",
  "pageCount": null,
  "interpretedPages": 2,
  "unreadablePages": 0,
  "sheetNames": [
   "Publicações",
   "Dados"
  ]
 },
 "extractPollution": {
  "status": "lido",
  "text": "### Planilha: Sheet1\n__proto__,constructor,Nome\npoluicao,proto2,Cliente Normal",
  "notes": "1 aba(s) lida(s): Sheet1.",
  "pageCount": null,
  "interpretedPages": 1,
  "unreadablePages": 0,
  "sheetNames": [
   "Sheet1"
  ]
 },
 "protoPoluted": null,
 "protoKeys": [],
 "convertInpi": {
  "id": "d1",
  "docNumber": 1,
  "title": "Doc. 01 — inpi-documento.xlsx",
  "category": "edital",
  "categoryLabel": "Edital",
  "fileName": "inpi-documento.xlsx",
  "images": [],
  "textBlocks": [
   "## Aba: Publicações",
   "Processo  |  Marca  |  Titular",
   "900123456  |  MARCA TESTE É  |  Titular São",
   "900654321  |  OUTRA MARCA  |  Titular Ç",
   "## Aba: Dados",
   "Col1  |  Col2",
   "1.5  |  texto ÇÃ"
  ],
  "pageEstimate": 1,
  "status": "convertido",
  "notes": "2 aba(s) convertida(s) em páginas legíveis."
 },
 "exportExcel": {
  "sheets": [
   "Clientes"
  ],
  "rows": [
   [
    "Nome Completo",
    "E-mail",
    "Telefone",
    "Empresa",
    "CPF/CNPJ",
    "Endereço",
    "Cidade",
    "Estado",
    "CEP",
    "Origem",
    "Prioridade",
    "Valor do Contrato",
    "Data de Cadastro"
   ],
   [
    "José São",
    "j@e.com",
    "(11) 90000-0001",
    "Empresa Ç",
    "012.345.678-90",
    "Rua Á",
    "São Paulo",
    "SP",
    "01000-000",
    "Site",
    "Alta",
    "R$ 1.234,50",
    "15/01/2026"
   ],
   [
    "María",
    "",
    "",
    "",
    "000.000.001-91",
    "",
    "",
    "",
    "",
    "WhatsApp",
    "Baixa",
    "",
    "31/12/1999"
   ]
  ]
 },
 "componentImportXlsx": {
  "registros": 3,
  "preview": [
   [
    "José São Áéìòu çÃÕ",
    "jose@exemplo.com",
    "(11) 90000-0001",
    "-"
   ],
   [
    "María \"aspas\" e\nquebra",
    "maria@exemplo.com",
    "(11) 90000-0002",
    "-"
   ],
   [
    "Sem CPF número",
    "num@exemplo.com",
    "(11) 90000-0003",
    "-"
   ]
  ],
  "bodySnippet": "Importar / Exportar LeadsImportarExportarClique para selecionar ou arraste um arquivoSuporta CSV, XLSX e XLSclientes-import.xlsx3 registros prontos para importarColunas detectadas:NomeCPFTelefoneE-mailValorDataObsNomeE-mailTelefoneMarcaJosé São Áéìòu çÃÕjose@exemplo.com(11) 90000-0001-María \"aspas\" "
 },
 "componentImportMerjado": {
  "registros": 2,
  "preview": [
   [
    "Lead Um São",
    "um@exemplo.com",
    "(11) 91111-0001",
    "Empresa A"
   ],
   [
    "Lead Dois ÇÃ",
    "dois@exemplo.com",
    "(11) 92222-0002",
    "Empresa B"
   ]
  ],
  "bodySnippet": "Importar / Exportar LeadsImportarExportarClique para selecionar ou arraste um arquivoSuporta CSV, XLSX e XLSleads-header-merjado.xlsx2 registros prontos para importarColunas detectadas:NomeE-mailTelefoneEmpresaNomeE-mailTelefoneMarcaLead Um Sãoum@exemplo.com(11) 91111-0001Empresa ALead Dois ÇÃdois@e"
 },
 "componentImportCsv": {
  "registros": 2,
  "preview": [
   [
    "Lead CSV Um",
    "csv1@exemplo.com",
    "(11) 93333-0001",
    "-"
   ],
   [
    "Lead CSV Dois",
    "csv2@exemplo.com",
    "(11) 94444-0002",
    "-"
   ]
  ],
  "bodySnippet": "Importar / Exportar LeadsImportarExportarClique para selecionar ou arraste um arquivoSuporta CSV, XLSX e XLSleads.csv2 registros prontos para importarColunas detectadas:NomeE-mailTelefoneNomeE-mailTelefoneMarcaLead CSV Umcsv1@exemplo.com(11) 93333-0001-Lead CSV Doiscsv2@exemplo.com(11) 94444-0002-Ma"
 },
 "componentImportInvalido": {
  "registros": 0,
  "preview": [],
  "bodySnippet": "Importar / Exportar LeadsImportarExportarClique para selecionar ou arraste um arquivoSuporta CSV, XLSX e XLSinvalido.xlsx0 registros prontos para importarMapeamento automático de colunas:Nome → Nome, full_nameE-mail → E-mail, EmailTelefone → Telefone, phoneMarca/Empresa → Marca, EmpresaValor → Valor"
 },
 "componentFormatoErrado": {
  "registros": 0,
  "preview": [],
  "bodySnippet": "Importar / Exportar LeadsImportarExportarClique para selecionar ou arraste um arquivoSuporta CSV, XLSX e XLSarquivo.txt0 registros prontos para importarMapeamento automático de colunas:Nome → Nome, full_nameE-mail → E-mail, EmailTelefone → Telefone, phoneMarca/Empresa → Marca, EmpresaValor → Valor d"
 },
 "componentExportXlsx": {
  "sheets": [
   "Leads"
  ],
  "rows": [
   [
    "Nome",
    "Email",
    "Telefone",
    "Empresa",
    "CPF/CNPJ",
    "Status",
    "Origem",
    "Valor Estimado",
    "Observações",
    "Criado em"
   ],
   [
    "Lead Um São",
    "um@exemplo.com",
    "(11) 91111-0001",
    "Empresa A",
    "012.345.678-90",
    "novo",
    "site",
    1000,
    "obs ç",
    "15/01/2026"
   ],
   [
    "Lead Dois",
    "",
    "",
    "",
    "",
    "contato",
    "",
    "",
    "",
    "31/12/1999"
   ]
  ]
 }
};

it('GATE de versão: EXPECTED_XLSX_VERSION obrigatória e exata (sem skip silencioso)', () => {
  expect(process.env.EXPECTED_XLSX_VERSION, 'env EXPECTED_XLSX_VERSION NÃO definida — CI deve fixar a versão esperada').toBeTruthy();
  expect(XLSX.version).toBe(process.env.EXPECTED_XLSX_VERSION);
});

it('parseExcel (importação clientes REAL): acentos, CPF zeros à esquerda, datas seriais, fórmula, vazias, multisheet = golden 0.18.5', async () => {
  const p = await parseExcel(file('clientes-import.xlsx'));
  expect({ headers: p.headers, errors: p.errors, format: p.format, rows: p.data.map(d => d._raw) }).toEqual(GOLD.parseExcel);
});

it('parseExcel planilha vazia: mensagem pt-BR preservada', async () => {
  const pv = await parseExcel(file('vazia.xlsx'));
  expect({ headers: pv.headers, errors: pv.errors, dataLen: pv.data.length }).toEqual(GOLD.parseExcelVazia);
});

it('parseExcel arquivo inválido: comportamento ATUAL preservado (resolve com header mojibake — limite declarado)', async () => {
  const r = await parseExcel(file('invalido.xlsx')).then((x) => ({ resolvido: true, headers: x.headers, errors: x.errors, dataLen: x.data.length })).catch((e) => ({ resolvido: false, erro: String(e).slice(0, 200) }));
  expect(r).toEqual(GOLD.parseExcelInvalido);
});

it('extractContent (documento INPI REAL): multisheet CSV, acentos, números de processo = golden', async () => {
  expect(await extractContent(file('inpi-documento.xlsx'))).toEqual(GOLD.extractInpi);
});

it('convertDocument (pacote INPI REAL): blocos de texto das abas = golden', async () => {
  const conv = await convertDocument({ id: 'd1', file_name: 'inpi-documento.xlsx', category: 'edital', categoryLabel: 'Edital' }, file('inpi-documento.xlsx'), 1);
  expect(conv).toEqual(GOLD.convertInpi);
});

const LEADS = [
  { id: 'l1', full_name: 'Lead Um São', email: 'um@exemplo.com', phone: '(11) 91111-0001', company_name: 'Empresa A', cpf_cnpj: '012.345.678-90', status: 'novo', origin: 'site', estimated_value: 1000, notes: 'obs ç', created_at: '2026-01-15T12:00:00Z' },
  { id: 'l2', full_name: 'Lead Dois', email: null, phone: null, company_name: null, cpf_cnpj: null, status: 'contato', origin: null, estimated_value: null, notes: null, created_at: '1999-12-31T12:00:00Z' },
];

const CLIENTES = [
  { id: '1', full_name: 'José São', email: 'j@e.com', cpf_cnpj: '012.345.678-90', phone: '(11) 90000-0001', company_name: 'Empresa Ç', address: 'Rua Á', city: 'São Paulo', state: 'SP', zip_code: '01000-000', origin: 'site', priority: 'high', contract_value: 1234.5, created_at: '2026-01-15T12:00:00Z' },
  { id: '2', full_name: 'María', email: null, cpf_cnpj: '000.000.001-91', phone: null, company_name: null, address: null, city: null, state: null, zip_code: null, origin: 'whatsapp', priority: 'low', contract_value: 0, created_at: '1999-12-31T12:00:00Z' },
];

it('exportToExcel (exportação clientes REAL): workbook capturado = golden E serialização real write→read preserva colunas/zeros/datas/acentos', async () => {
  exportToExcel(CLIENTES as never, 'teste');
  const wbk = capturedWb as { SheetNames: string[]; Sheets: Record<string, unknown> };
  expect(wbk).toBeTruthy();
  expect({ sheets: wbk.SheetNames, rows: XLSX.utils.sheet_to_json(wbk.Sheets[wbk.SheetNames[0]], { header: 1 }) }).toEqual(GOLD.exportExcel);
  // serialização REAL (não só objeto em memória): escreve bytes xlsx e relê
  const bytes = XLSX.write(wbk, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  expect(bytes.length).toBeGreaterThan(1000);
  const relido = XLSX.read(bytes, { type: 'buffer' });
  expect({ sheets: relido.SheetNames, rows: XLSX.utils.sheet_to_json(relido.Sheets[relido.SheetNames[0]], { header: 1 }) }).toEqual(GOLD.exportExcel);
});

// ── COMPONENTE REAL LeadImportExportDialog ──
async function upload(name: string, path: string, type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
  capturedWb = null;
  render(<LeadImportExportDialog open onOpenChange={() => {}} leads={LEADS as never} onImportComplete={() => {}} />);
  const input = document.querySelector('input[type=file]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File([readFileSync(path)], name, { type })] } });
  await waitFor(() => {
    const t = document.body.textContent || '';
    if (!/[1-9]\d* registros prontos para importar/.test(t)) throw new Error('aguardando parse');
  }, { timeout: 1200 }).catch(() => {});
  const body = document.body.textContent || '';
  const m = body.match(/(\d+) registros prontos para importar/);
  const preview = Array.from(document.querySelectorAll('table tbody tr')).map(tr => Array.from(tr.querySelectorAll('td')).map(td => td.textContent));
  cleanup();
  return { registros: m ? Number(m[1]) : null, preview };
}

it('componente REAL: import xlsx direto (range 0) — contagem e preview = golden', { timeout: 15000 }, async () => {
  expect(await upload('clientes-import.xlsx', `${FX}/clientes-import.xlsx`)).toEqual({ registros: GOLD.componentImportXlsx.registros, preview: GOLD.componentImportXlsx.preview });
  expect(GOLD.componentImportXlsx.registros).toBeGreaterThan(0);
});

it('componente REAL: header "merjado" dispara fallback range:1 — contagem e preview = golden', { timeout: 15000 }, async () => {
  expect(await upload('leads-header-merjado.xlsx', `${FX}/leads-header-merjado.xlsx`)).toEqual({ registros: GOLD.componentImportMerjado.registros, preview: GOLD.componentImportMerjado.preview });
  expect(GOLD.componentImportMerjado.registros).toBeGreaterThan(0);
});

it('componente REAL: import CSV (formato aceito pelo app) = golden', { timeout: 15000 }, async () => {
  expect(await upload('leads.csv', `${FX}/leads.csv`, 'text/csv')).toEqual({ registros: GOLD.componentImportCsv.registros, preview: GOLD.componentImportCsv.preview });
  expect(GOLD.componentImportCsv.registros).toBeGreaterThan(0);
});

it('componente REAL: xlsx inválido e extensão errada = golden (0 registros, sem crash)', { timeout: 15000 }, async () => {
  expect((await upload('invalido.xlsx', `${FX}/invalido.xlsx`)).registros).toBe(GOLD.componentImportInvalido.registros);
  expect((await upload('arquivo.txt', `${FX}/invalido.xlsx`, 'text/plain')).registros).toBe(GOLD.componentFormatoErrado.registros);
});

it('componente REAL: aba Exportar → Exportar Excel gera workbook = golden (sink capturado)', { timeout: 15000 }, async () => {
  capturedWb = null;
  render(<LeadImportExportDialog open onOpenChange={() => {}} leads={LEADS as never} onImportComplete={() => {}} />);
  const tab = screen.getByRole('tab', { name: /exportar/i });
  fireEvent.mouseDown(tab); fireEvent.click(tab);
  await new Promise(r => setTimeout(r, 300));
  const btn = Array.from(document.querySelectorAll('button')).find(b => /exportar excel/i.test(b.textContent || ''));
  expect(btn, 'botão Exportar Excel não encontrado').toBeTruthy();
  fireEvent.click(btn!);
  await new Promise(r => setTimeout(r, 800));
  cleanup();
  const wb2 = capturedWb as { SheetNames: string[]; Sheets: Record<string, unknown> } | null;
  expect(wb2, 'writeFile não capturado').toBeTruthy();
  expect({ sheets: wb2!.SheetNames, rows: XLSX.utils.sheet_to_json(wb2!.Sheets[wb2!.SheetNames[0]], { header: 1 }) }).toEqual(GOLD.componentExportXlsx);
});

it('CVE-2023-30533 (sonda bounded): headers __proto__/constructor NÃO poluem Object.prototype', async () => {
  const antes = JSON.stringify(Object.getOwnPropertyNames(Object.prototype).sort());
  const r = await extractContent(file('pollution-headers.xlsx'));
  expect(r).toEqual(GOLD.extractPollution);
  expect((Object.prototype as Record<string, unknown>).poluicao).toBeUndefined();
  expect((Object.prototype as Record<string, unknown>).proto2).toBeUndefined();
  expect(JSON.stringify(Object.getOwnPropertyNames(Object.prototype).sort())).toBe(antes);
});
