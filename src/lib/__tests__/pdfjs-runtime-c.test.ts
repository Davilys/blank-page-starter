// Harness runtime REAL dos call sites pdfjs (C: base 4.4.168 x candidato 4.10.38).
// ASSERTS REAIS: qualquer falha de import/worker/parse/render DERRUBA o teste.
// Versao exata conferida via EXPECTED_PDFJS_VERSION (CI injeta por branch).
// Worker: estrategia do app (Blob URL do worker ?raw); shim somente na fronteira
// URL: blob: nao e importavel no ESM loader do Node; data: carrega OS MESMOS
// bytes (prova abaixo: raw ?raw == bytes do pacote instalado).
// Backend raster do harness: @napi-rs/canvas (pinado via CI --no-save, FORA do
// lock de producao). Obrigatorio nos probes de render: ausencia = FALHA.
import { it, expect, beforeAll } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const pdfjsVersion = req('pdfjs-dist/package.json').version as string;
const FX = new URL('./fixtures/', import.meta.url).pathname;
const file = (n: string) => new File([readFileSync(FX + n)], n, { type: 'application/pdf' });
const results: Record<string, unknown> = { pdfjsVersion };

const NAPI_CANVAS = '@napi-rs/canvas';
it('versao exata instalada == esperada pela branch', () => {
  expect(process.env.EXPECTED_PDFJS_VERSION, 'CI deve injetar EXPECTED_PDFJS_VERSION').toBeTruthy();
  expect(pdfjsVersion).toBe(process.env.EXPECTED_PDFJS_VERSION);
});

beforeAll(async () => {
  const raw = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?raw')).default as string;
  const disk = readFileSync(req.resolve('pdfjs-dist/legacy/build/pdf.worker.min.mjs'), 'utf8');
  expect(raw).toBe(disk); // o ?raw servido pelo vite == bytes do pacote
  const dataUrl = 'data:text/javascript;base64,' + Buffer.from(raw).toString('base64');
  URL.createObjectURL = (_: Blob) => dataUrl;
});

it('call site 1 (real): caseDocuments.extractContent — texto/acentos/multipagina', async () => {
  const { extractContent } = await import('@/lib/inpi/caseDocuments');
  const r = await extractContent(file('texto-acentos-3pag.pdf'));
  results.ecTexto = JSON.parse(JSON.stringify(r));
  expect(r.status).toBe('lido');
  expect(r.pageCount).toBe(3);
  expect(r.interpretedPages).toBe(3);
  expect(r.text).toContain('AÇÃO çãõéàü');
  expect(r.text).toContain('Página 3: assinatura');
});

it('call site 1 (real): extractContent — scan sem texto', async () => {
  const { extractContent } = await import('@/lib/inpi/caseDocuments');
  const r = await extractContent(file('scan-sem-texto.pdf'));
  results.ecScan = JSON.parse(JSON.stringify(r));
  expect(r.status).toBe('recebido');
  expect(r.text).toBeNull();
  expect(r.notes).toContain('sem texto interpretável');
});

it('call site 1 (real): extractContent — corrompido', async () => {
  const { extractContent } = await import('@/lib/inpi/caseDocuments');
  const r = await extractContent(file('corrompido.pdf'));
  results.ecCorrompido = JSON.parse(JSON.stringify(r));
  expect(r.status).toBe('falha');
  expect(r.notes).toContain('danificado');
});

it('call site 1 (real): extractContent — protegido por senha (qpdf user-password real)', async () => {
  const { extractContent } = await import('@/lib/inpi/caseDocuments');
  const r = await extractContent(file('protegido-senha.pdf'));
  results.ecSenha = JSON.parse(JSON.stringify(r));
  expect(r.status).toBe('falha');
  expect(r.notes).toContain('protegido por senha');
});

it('call site 2 (real): binaryParsers.createPdfParser — 4 fixtures', async () => {
  const { createPdfParser } = await import('@/modules/intelligence/infrastructure/parsers/binaryParsers');
  const p = createPdfParser();
  const texto = await p.parse(file('texto-acentos-3pag.pdf'));
  results.bpTexto = JSON.parse(JSON.stringify(texto));
  expect(texto.ok).toBe(true);
  if (texto.ok) {
    expect(texto.value.texto).toContain('Contrato de Prestação de Serviços — AÇÃO çãõéàü');
    expect(texto.value.texto).toContain('Página 2: vigência de 12 meses');
  }
  const scan = await p.parse(file('scan-sem-texto.pdf'));
  expect(scan.ok).toBe(true);
  if (scan.ok) expect(scan.value.texto).toBe('');
  const corr = await p.parse(file('corrompido.pdf'));
  results.bpCorrompido = JSON.parse(JSON.stringify(corr));
  expect(corr.ok).toBe(false);
  if (!corr.ok) expect(corr.error).toContain('Invalid PDF structure');
  const senha = await p.parse(file('protegido-senha.pdf'));
  results.bpSenha = JSON.parse(JSON.stringify(senha));
  expect(senha.ok).toBe(false); // PasswordException -> err()
});

it('call site 3 probe: INPILegalChatDialog render SEM param canvas (assinatura exata L104)', async () => {
  const nc = await import(/* @vite-ignore */ NAPI_CANVAS as string) as any; // ausencia = falha (pinado no CI)
  const lib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await lib.getDocument({ data: new Uint8Array(readFileSync(FX + 'texto-acentos-3pag.pdf')) }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = nc.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: context as never, viewport }).promise; // assinatura exata do dialog
  const img = context.getImageData(0, 0, canvas.width, canvas.height).data;
  // Node sem standardFontDataUrl: texto NAO rasteriza (pdfjs emite warnings e gera
  // pagina em branco) — limitacao do ambiente, igual nas duas versoes. O gate de
  // PIXELS reais e o harness browser-real no CI. Aqui: API resolve + dims exatas.
  let soma = 0; for (let i = 0; i < img.length; i += 401) soma += img[i] * 3 - 765;
  results.renderDialog = { w: canvas.width, h: canvas.height, desvioBranco: soma, nota: 'node sem fontes: raster em branco esperado; gate visual e o harness browser' };
  expect(canvas.width).toBe(Math.ceil(viewport.width));
  expect(canvas.height).toBe(Math.ceil(viewport.height));
  expect(canvas.width).toBeGreaterThan(800); // A4 @1.5x
});

it('call site 4 probe: packageBuilder render COM param canvas (assinatura exata L61, cast identico)', async () => {
  const nc = await import(/* @vite-ignore */ NAPI_CANVAS as string) as any;
  const lib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await lib.getDocument({ data: new Uint8Array(readFileSync(FX + 'texto-acentos-3pag.pdf')) }).promise;
  const page = await doc.getPage(2);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = nc.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport, canvas } as unknown as Parameters<typeof page.render>[0]).promise;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let soma = 0; for (let i = 0; i < img.length; i += 401) soma += img[i] * 3 - 765;
  results.renderBuilder = { w: canvas.width, h: canvas.height, desvioBranco: soma, nota: 'node sem fontes: raster em branco esperado; gate visual e o harness browser' };
  expect(canvas.width).toBe(Math.ceil(viewport.width));
  expect(canvas.height).toBe(Math.ceil(viewport.height));
  expect(canvas.width).toBeGreaterThan(1100); // A4 @2x
});

it('grava evidencia para comparacao base x candidato', () => {
  mkdirSync('/tmp/fix', { recursive: true });
  writeFileSync(`/tmp/fix/pdfjs-rt-${pdfjsVersion}.json`, JSON.stringify(results, null, 1));
});
