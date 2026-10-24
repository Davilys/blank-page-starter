// Harness browser-real: Chrome do runner + BlobWorker (estrategia identica ao app).
// Sobe 2 mounts estaticos: /cand = repo (pdfjs do candidato), /base = /tmp/pdfbase (4.4.168).
// Texto extraido e comparado com ASSERT (falha CI se divergir); PNGs base/candidato
// sao salvos como artefatos para inspecao visual + hashes reportados.
import http from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, extname, normalize } from 'node:path';
import { execSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const ROOTS = { '/cand': process.cwd(), '/base': '/tmp/pdfbase' };
const MIME = { '.mjs': 'text/javascript', '.js': 'text/javascript', '.html': 'text/html', '.pdf': 'application/pdf', '.map': 'application/json' };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/page') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(readFileSync('scripts/pdfjs-harness-page.html')); }
  for (const [mount, root] of Object.entries(ROOTS)) {
    if (u.pathname.startsWith(mount + '/')) {
      const p = normalize(join(root, u.pathname.slice(mount.length)));
      if (!p.startsWith(root) || !existsSync(p) || !statSync(p).isFile()) break;
      res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
      return res.end(readFileSync(p));
    }
  }
  res.writeHead(404); res.end('404');
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;

const chromePath = process.env.CHROME_PATH || execSync('which google-chrome || which chromium || which chromium-browser').toString().trim().split('\n')[0];
// Launch robusto: WS endpoint pode demorar sob carga do runner (flake observado no CI —
// timeout de 30s default abortava antes do Chrome subir). 90s + 3 tentativas.
let browser;
for (let tentativa = 1; tentativa <= 3; tentativa++) {
  try {
    browser = await puppeteer.launch({ executablePath: chromePath, timeout: 90000, protocolTimeout: 120000, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    break;
  } catch (err) {
    console.error(`launch tentativa ${tentativa}/3 falhou: ${err.message}`);
    if (tentativa === 3) throw err;
  }
}
mkdirSync('/tmp/render-out', { recursive: true });
const runs = {};
for (const v of ['base', 'cand']) {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/page?v=${v}`, { waitUntil: 'load' });
  await page.waitForFunction('window.__done !== undefined', { timeout: 60000 });
  const r = await page.evaluate('window.__done');
  runs[v] = r;
  for (const [n, f] of Object.entries(r.fixtures || {})) {
    if (f.png) writeFileSync(`/tmp/render-out/${v}-${n}.png`, Buffer.from(f.png.split(',')[1], 'base64'));
  }
  await page.close();
}
await browser.close(); server.close();

const sha = s => createHash('sha256').update(s).digest('hex').slice(0, 16);
let falhou = false;
const bad = (motivo) => { console.error('FALHOU:', motivo); falhou = true; };
// GATE 1: versoes exatas (evita 'base = candidato' ou upgrade silencioso passando como paridade).
const V_BASE = process.env.PDFJS_BASE_VERSION || '4.4.168';
const V_CAND = process.env.PDFJS_CAND_VERSION || '4.10.38';
if (runs.base.version !== V_BASE) bad(`versao base ${runs.base.version} != esperada ${V_BASE}`);
if (runs.cand.version !== V_CAND) bad(`versao candidato ${runs.cand.version} != esperada ${V_CAND}`);
const cmp = { versoes: { base: runs.base.version, cand: runs.cand.version }, fixtures: {} };
if (runs.base.erros.length || runs.cand.erros.length) { console.error('ERROS:', runs.base.erros, runs.cand.erros); process.exit(1); }
// GATE 2: comportamento ESPERADO por fixture — sucesso sem erro nas 2 validas,
// erro de CLASSE ESPECIFICA nas 2 invalidas. 'Mesmo erro inesperado nas duas' NAO passa.
const ESPERADO = {
  'texto-acentos-3pag.pdf': { erro: null },
  'scan-sem-texto.pdf': { erro: null },
  'corrompido.pdf': { erroPrefixo: 'InvalidPDFException:' },
  'protegido-senha.pdf': { erroPrefixo: 'PasswordException:' },
};
for (const n of Object.keys(ESPERADO)) {
  const b = runs.base.fixtures[n], c = runs.cand.fixtures[n];
  const exp = ESPERADO[n];
  const e = { erroBase: b.erro || null, erroCand: c.erro || null };
  for (const [tag, r] of [['base', b], ['cand', c]]) {
    const er = r.erro || null;
    if (exp.erro === null && er) bad(`${n} (${tag}): erro inesperado em fixture valida: ${er}`);
    if (exp.erroPrefixo && (!er || !er.startsWith(exp.erroPrefixo))) bad(`${n} (${tag}): erro ${JSON.stringify(er)} fora da classe esperada ${exp.erroPrefixo}*`);
  }
  if ((b.erro || null) !== (c.erro || null)) { e.diverge = 'erro'; bad(`${n}: erros divergem base x candidato`); }
  if (!b.erro && !c.erro) {
    if (b.texto !== c.texto) { e.diverge = 'texto'; bad(`${n}: texto diverge`); }
    if (!b.texto && n === 'texto-acentos-3pag.pdf') bad(`${n}: texto VAZIO em fixture de texto (render em branco nao e paridade)`);
    if (b.pages !== c.pages || b.w !== c.w || b.h !== c.h) { e.diverge = 'geometria'; bad(`${n}: geometria diverge`); }
    if (!b.png || !c.png) bad(`${n}: PNG ausente`); else {
      e.shaBase = sha(b.png); e.shaCand = sha(c.png); e.pngIdentico = e.shaBase === e.shaCand;
      e.bytesBase = b.png.length; e.bytesCand = c.png.length;
      // GATE 3: PNG identico e OBRIGATORIO (raster bit-a-bit no mesmo Chrome).
      if (!e.pngIdentico) bad(`${n}: PNG diverge (sha ${e.shaBase} x ${e.shaCand})`);
    }
  }
  cmp.fixtures[n] = e;
}
writeFileSync('/tmp/render-out/comparacao.json', JSON.stringify(cmp, null, 1));
console.log(JSON.stringify(cmp, null, 1));
process.exit(falhou ? 1 : 0);
