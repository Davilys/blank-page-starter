// Bateria visual D2: candidato (vite preview local) x producao (webmarcas.net), 5 rotas publicas x desk/mob.
// Compara pixel a pixel com tolerancia apenas para conteudo dinamico (timestamps/toast) via limiar por-pixel.
import { execSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const ROTAS = ['/', '/planos', '/login', '/cadastro', '/obrigado'];
const VIEWPORTS = { desk: { width: 1366, height: 900 }, mob: { width: 390, height: 844 } };
const PROD = 'https://webmarcas.net';
const PREVIEW_PORT = 4173;

const preview = spawn('npx', ['vite', 'preview', '--port', String(PREVIEW_PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('preview timeout')), 60000);
  const poll = setInterval(async () => {
    try { const r = await fetch(`http://127.0.0.1:${PREVIEW_PORT}/`); if (r.ok) { clearInterval(poll); clearTimeout(t); res(); } } catch {}
  }, 1500);
});
const chromePath = process.env.CHROME_PATH || execSync('which google-chrome || which chromium || which chromium-browser').toString().trim().split('\n')[0];
const browser = await puppeteer.launch({ executablePath: chromePath, timeout: 90000, protocolTimeout: 120000, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
mkdirSync('/tmp/visual-out', { recursive: true });
const resultado = [];
for (const [nome, vp] of Object.entries(VIEWPORTS)) {
  for (const rota of ROTAS) {
    const shots = {};
    for (const [alvo, base] of [['cand', `http://127.0.0.1:${PREVIEW_PORT}`], ['prod', PROD]]) {
      const tag = `[${nome} ${rota} ${alvo}]`;
      console.log(tag, 'newPage');
      const page = await browser.newPage();
      await page.setViewport(vp);
      console.log(tag, 'goto', base + rota);
      const t0 = Date.now();
      await page.goto(base + rota, { waitUntil: 'networkidle2', timeout: 45000 }).catch(e => console.error('nav', alvo, rota, e.message));
      console.log(tag, 'goto done em', Date.now() - t0, 'ms');
      await new Promise(r => setTimeout(r, 2500));
      console.log(tag, 'screenshot');
      shots[alvo] = await page.screenshot({ fullPage: false });
      console.log(tag, 'screenshot ok');
      await page.close();
      console.log(tag, 'page closed');
    }
    const a = PNG.sync.read(Buffer.from(shots.cand)), b = PNG.sync.read(Buffer.from(shots.prod));
    const { width, height } = a;
    let diffPx = -1;
    if (width === b.width && height === b.height) {
      diffPx = pixelmatch(a.data, b.data, null, width, height, { threshold: 0.12, includeAA: true });
    }
    const pct = diffPx < 0 ? 999 : (diffPx * 100) / (width * height);
    resultado.push({ rota, vp: nome, diffPx, pct: +pct.toFixed(3) });
    writeFileSync(`/tmp/visual-out/${nome}${rota.replace(/\//g, '_')}-cand.png`, shots.cand);
    writeFileSync(`/tmp/visual-out/${nome}${rota.replace(/\//g, '_')}-prod.png`, shots.prod);
    console.log(`${nome} ${rota}: diffPx=${diffPx} (${pct.toFixed(3)}%)`);
  }
}
await browser.close();
try { preview.kill('SIGKILL'); } catch {}
preview.unref();
const falhas = resultado.filter(r => r.pct > 2.0);
console.log('RESUMO:', JSON.stringify(resultado));
if (falhas.length) { console.error('FALHAS VISUAIS:', JSON.stringify(falhas)); process.exit(1); }
console.log('VISUAL OK (tolerancia 2% por rota, cobre toast/timestamps dinamicos)');
process.exit(0);
