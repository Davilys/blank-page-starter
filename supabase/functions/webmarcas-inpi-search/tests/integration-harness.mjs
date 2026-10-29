/**
 * Harness de integração LOCAL do candidato (sem rede, sem produção, sem segredos).
 *
 * Como rodar a partir da RAIZ DO REPO (validado em diretório limpo). Dois tsc,
 * ambos exit 0 OBRIGATÓRIO: o passo 1 é o typecheck real (qualquer erro novo
 * falha aqui); o passo 2 emite JS para o Node a partir de uma CÓPIA de staging
 * com a extensão do import ajustada (o repo mantém './renomeSnapshot.ts',
 * estilo Deno; a cópia usa '.js'). Nunca "emitiu apesar do erro".
 *
 *   BUILD=/tmp/afport-build
 *   rm -rf "$BUILD" && mkdir -p "$BUILD/src/webmarcas-inpi-search" "$BUILD/src/_shared"
 *   cp supabase/functions/webmarcas-inpi-search/{activityFilterPort,orientationPort,renomeSnapshot}.ts "$BUILD/src/webmarcas-inpi-search/"
 *   cp supabase/functions/_shared/activityAnalysis.ts "$BUILD/src/_shared/"
 *
 *   # 1) TYPECHECK REAL (exit 0; controle negativo verificado: erro injetado -> exit 2)
 *   node_modules/.bin/tsc --strict --noEmit --module esnext --target es2022 \
 *     --moduleResolution bundler --allowImportingTsExtensions \
 *     "$BUILD"/src/webmarcas-inpi-search/*.ts "$BUILD"/src/_shared/activityAnalysis.ts || exit 1
 *
 *   # 2) EMIT limpo na cópia (exit 0)
 *   sed -i "s|'./renomeSnapshot.ts'|'./renomeSnapshot.js'|" "$BUILD/src/webmarcas-inpi-search/activityFilterPort.ts"
 *   node_modules/.bin/tsc --strict --module esnext --target es2022 \
 *     --moduleResolution bundler --outDir "$BUILD/out" --rootDir "$BUILD/src" \
 *     "$BUILD"/src/webmarcas-inpi-search/*.ts "$BUILD"/src/_shared/activityAnalysis.ts || exit 1
 *
 *   # 3) Harness (20 checks; exit 0 só se todos passarem)
 *   node supabase/functions/webmarcas-inpi-search/tests/integration-harness.mjs "$BUILD/out"
 *
 * Fixtures: tests/fixtures.json (dados públicos capturados do portal INPI +
 * saídas esperadas do orientation.py original; sem segredos).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const buildDir = process.argv[2];
if (!buildDir) {
  console.error('uso: node integration-harness.mjs <dir-do-build-tsc> (ex.: /tmp/afport-build)');
  process.exit(2);
}
const mod = (p) => import(pathToFileURL(resolve(buildDir, p)).href);
const { triage, classify } = await mod('webmarcas-inpi-search/activityFilterPort.js');
const { guidance, primaryClassFor } = await mod('webmarcas-inpi-search/orientationPort.js');
const { RENOME_PROCESSES, RENOME_SNAPSHOT } = await mod('webmarcas-inpi-search/renomeSnapshot.js');
const { normalizeActivityAnalysis } = await mod('_shared/activityAnalysis.js');
const fixtures = JSON.parse(readFileSync(new URL('./fixtures.json', import.meta.url), 'utf8'));

let failures = 0;
const check = (name, cond, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${cond ? '' : ' — ' + detail}`);
  if (!cond) failures++;
};

// 1) Fidelidade do orientation portado vs saída registrada do original (VPS)
let mism = 0;
for (const [activity, [pcls, pstatus]] of Object.entries(fixtures.guidanceExpected)) {
  const g = guidance(activity);
  if (g.primary_class !== pcls || g.status !== pstatus) { mism++; console.log('  diverge', JSON.stringify(activity), 'esperado', pcls, pstatus, 'obtido', g.primary_class, g.status); }
}
check('guidance 31/31 idêntico ao original', mism === 0, `${mism} divergências`);
check('snapshot: 383 processos, data/fonte explícitas', RENOME_PROCESSES.size === 383 && RENOME_SNAPSHOT.listDate === '2026-10-20' && RENOME_SNAPSHOT.sourceUrl.endsWith('_2026_10_20.pdf'));

// 2) Bloco de integração replicado de buildCompletedJob (index.ts)
const s = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
function mapInpiRecord(r) {
  const raw = (f) => r[f]?.raw;
  const process = s(raw('process_number'));
  const brand = s(raw('mark_name'));
  if (!process && !brand) return null;
  const specs = raw('specifications');
  const nice = Array.isArray(specs)
    ? [...new Set(specs.map((sp) => s(sp?.nice_class_code)).filter(Boolean))].sort().join(', ') || null
    : null;
  return { process: process ?? '', priority: s(raw('priority_datetime')) ?? s(raw('filing_date')), brand: brand ?? '', status: s(raw('status')) ?? '', holder: null, nice, source_url: null };
}
function integrate(rawResults, brand, activity) {
  const records = rawResults.map(mapInpiRecord).filter(Boolean);
  let activityAnalysis = null;
  if (activity.trim() && records.length > 0) {
    const details = new Map();
    for (const r of rawResults) {
      const proc = s(r?.process_number?.raw);
      if (!proc) continue;
      const specsRaw = r?.specifications?.raw;
      const specs = Array.isArray(specsRaw)
        ? specsRaw.map((sp) => ({ nice: s(sp?.nice_class_code) ?? '', text: s(sp?.text) ?? '' })).filter((sp) => sp.nice || sp.text)
        : [];
      details.set(proc, { process: proc, specifications: specs });
    }
    const primary = primaryClassFor(activity);
    activityAnalysis = triage(records, activity, details, brand, primary ? [primary] : []);
  }
  return { records, activityAnalysis };
}

// 3) Registro real capturado (BARBIE 790377179, especificação completa)
const rawBarbie = fixtures.barbieRawRecord;
const a = integrate([rawBarbie], 'BARBIE', 'loja de brinquedos');
check('real BARBIE: analysis populada, versão do port', a.activityAnalysis?.version.includes('+portal-port-2026-10-29'));
check('real BARBIE: normalizer aceita o payload', normalizeActivityAnalysis(a.activityAnalysis, a.records.map((r) => r.process)) !== null);
check('real BARBIE: ramo ambíguo -> pending conservador', a.activityAnalysis.items[0].group === 'pending');

// 4) Renome por snapshot dentro/fora do foco + normalização de processo
const fifa = JSON.parse(JSON.stringify(rawBarbie));
fifa.process_number = { raw: '818427086' }; // processo FIFA, consta na lista oficial (fixture forçada de triagem)
fifa.mark_name = { raw: 'FIFA' };
fifa.specifications = { raw: [{ nice_class_code: '28', text: 'Artigos esportivos e jogos' }] };
const cFora = integrate([fifa], 'XPTO', 'escola de cursos');
check('renome FORA do foco -> pending com razão da lista', cFora.activityAnalysis.items[0].group === 'pending' && cFora.activityAnalysis.items[0].reason.includes('lista oficial de alto renome'), cFora.activityAnalysis.items[0].reason);
const cDentro = integrate([JSON.parse(JSON.stringify({ ...fifa, specifications: { raw: [{ nice_class_code: '41', text: 'Cursos e treinamentos' }] } }))], 'XPTO', 'escola de cursos');
check('renome DENTRO do foco -> pending com razão da lista', cDentro.activityAnalysis.items[0].group === 'pending' && cDentro.activityAnalysis.items[0].reason.includes('lista oficial de alto renome'));
const tags = new Set(['education']); const focus = new Set([9, 16, 35, 38, 41, 42]);
const det = (p) => ({ process: p, specifications: [{ nice: '28', text: 'Artigos esportivos' }] });
check('processo sem zero-pad casa (1959204 -> 001959204)', classify({ process: '1959204', brand: 'X', status: 'em vigor', nice: '28' }, det('1959204'), tags, focus)[1].includes('alto renome'));
check('processo pontuado casa (818.427.086)', classify({ process: '818.427.086', brand: 'FIFA', status: 'em vigor', nice: '28' }, det('818.427.086'), tags, focus)[1].includes('alto renome'));
check('lista FIFA-2027 (processo 501596725, só nela) -> pending com razão FIFA', classify({ process: '501596725', brand: 'FIFA', status: 'em vigor', nice: '28' }, det('501596725'), tags, focus)[1].includes('Copa do Mundo Feminina da FIFA'));
check('não-renome fora do foco -> other (controle)', classify({ process: '999000002', brand: 'Y', status: 'em vigor', nice: '28' }, det('999000002'), tags, focus)[0] === 'other');
check('lixo não casa nem quebra (abc)', classify({ process: 'abc', brand: 'Z', status: 'em vigor', nice: '28' }, det('abc'), tags, focus)[0] === 'other');

// 5) Renome por texto de especificação (via original)
const recTxt = { process: '999000001', brand: 'ABC', status: 'Marca em vigor', nice: '30' };
check('renome por texto na especificação -> pending', classify(recTxt, { process: '999000001', specifications: [{ nice: '30', text: 'Café. Marca de alto renome concedida pelo INPI.' }] }, new Set(['food']), new Set([30]))[0] === 'pending');

// 6) Marca idêntica na classe principal derivada (restaurante -> 43)
const same = JSON.parse(JSON.stringify(rawBarbie));
same.process_number = { raw: '999123456' };
same.specifications = { raw: [{ nice_class_code: '43', text: 'Serviços de alimentação' }] };
const d = integrate([same], 'BARBIE', 'restaurante');
check('primária derivada: restaurante -> 43', primaryClassFor('restaurante') === 43);
check('idêntica na primária -> related', d.activityAnalysis.items[0].group === 'related');

// 7) Conservadorismo: zero registros / sem atividade / negação
check('zero registros -> analysis null', integrate([], 'ZZZ', 'restaurante').activityAnalysis === null);
check('sem atividade -> analysis null', integrate([rawBarbie], 'BARBIE', '').activityAnalysis === null);
const g = integrate([rawBarbie], 'BARBIE', 'não vendo brinquedos');
check('negação -> primária null + pending', primaryClassFor('não vendo brinquedos') === null && g.activityAnalysis.items[0].group === 'pending');

// 8) Payload real capturado da busca exata BARBIE (51 registros normalizados)
const recs = fixtures.barbieSearchRecords.map((r) => ({ process: String(r.process ?? ''), brand: String(r.brand ?? ''), status: String(r.status ?? ''), nice: r.nice != null ? String(r.nice) : null }));
const t3 = triage(recs, 'loja de brinquedos', new Map(), 'BARBIE', []);
check('payload real: 51 registros, todos pending (sem specs na resposta de status)', recs.length === 51 && t3.counts.pending === 51);
check('payload real: nenhum processo na lista de renome', t3.items.every((i) => !RENOME_PROCESSES.has(i.process)));
check('limitation declara data da lista sem afirmar vigência', a.activityAnalysis.limitation.includes('2026-10-20') && a.activityAnalysis.limitation.includes('vigência atual'));

console.log(failures === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${failures} FALHA(S)`);
process.exit(failures === 0 ? 0 : 1);
