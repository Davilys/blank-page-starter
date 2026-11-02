import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BrainCircuit, CheckCircle2, Download, Loader2, Search, ShieldAlert, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import jsPDF from 'jspdf';
import 'svg2pdf.js';
import { runConsultorIaSearch } from '@/lib/api/consultorIaSearch';
import { cn } from '@/lib/utils';

const MOCK = import.meta.env.VITE_MARCAS_IA_MOCK === '1';
const DIAG_MARKER = '[DIAGNOSTICO_COMPLETO]';

type Msg = { role: 'user' | 'assistant'; content: string };
type Stage = 'briefing' | 'nomes' | 'logos' | 'entrega';

type Nome = { nome: string; justificativa: string; tom: string };
type CheckState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; total: number; exatas: number; fonte: string }
  | { kind: 'erro'; message: string };

const MOCK_NOMES: Nome[] = Array.from({ length: 10 }, (_, i) => ({
  nome: `NomeConceito${i + 1}`,
  justificativa: 'Fixture de prévia — não é uma sugestão real do BrandBot.',
  tom: 'fixture',
}));

const MOCK_SVGS: string[] = [0, 1, 2, 3, 4].map((i) => {
  const hue = 210 + i * 12;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><rect width="240" height="240" rx="32" fill="hsl(${hue} 70% 18%)"/><circle cx="120" cy="100" r="44" fill="none" stroke="hsl(${hue} 90% 60%)" stroke-width="10"/><text x="120" y="190" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#fff">CONCEITO ${i + 1}</text></svg>`;
});

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

async function callAgent(body: Record<string, unknown>): Promise<{ ok: boolean; [k: string]: unknown }> {
  const { data, error } = await supabase.functions.invoke('marcas-ia-agent', { body });
  if (error) {
    // supabase-js trata non-2xx como erro genérico: o corpo JSON da edge
    // (disabled/budget/config) está em error.context — ler antes de assumir falha.
    try {
      const ctx = (error as { context?: Response }).context;
      const payload = ctx ? await ctx.json() : null;
      if (payload?.error?.code) return { ok: false, error: payload.error };
    } catch { /* corpo ilegível: cai no genérico */ }
    return { ok: false, error: { code: 'invoke', message: 'Não consegui falar com o BrandBot agora.' } };
  }
  return data as { ok: boolean };
}

export default function MarcasIA() {
  const [sessionId] = useState(() => crypto.randomUUID());
  const [stage, setStage] = useState<Stage>('briefing');
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: 'assistant', content: 'Olá! Sou o BrandBot, da WebMarcas. Vamos criar sua marca juntos, em etapas rápidas e sempre com a sua aprovação. Para começar: o que o seu negócio faz e o que o nome precisa transmitir?' },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [diagnostico, setDiagnostico] = useState<string | null>(null);
  const [diagAprovado, setDiagAprovado] = useState(false);
  const [nomes, setNomes] = useState<Nome[]>([]);
  const [ramo, setRamo] = useState('');
  const [checks, setChecks] = useState<Record<string, CheckState>>({});
  const [nomeEscolhido, setNomeEscolhido] = useState<Nome | null>(null);
  const [svgs, setSvgs] = useState<string[]>([]);
  const [svgEscolhido, setSvgEscolhido] = useState<number | null>(null);
  const [manual, setManual] = useState<{ proposito?: string; tom_de_voz?: string[]; valores?: string[]; paleta?: { nome: string; hex: string; rgb: string; cmyk: string }[]; tipografia?: { primaria?: string; secundaria?: string; uso?: string } } | null>(null);
  const [manualBusy, setManualBusy] = useState(false);
  const [agenteOff, setAgenteOff] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const scrollDown = () => setTimeout(() => listRef.current?.scrollTo({ top: 999999, behavior: 'smooth' }), 60);

  async function sendChat() {
    const text = input.trim();
    if (!text || busy) return;
    const next = [...msgs, { role: 'user' as const, content: text }];
    setMsgs(next);
    setInput('');
    setBusy(true);
    scrollDown();
    try {
      if (MOCK) {
        const reply = msgs.length < 2
          ? '(fixture) Perfeito. E quem é o público e qual o diferencial?'
          : '(fixture) Diagnóstico: essência X, público Y, diferencial Z, personalidade premium, direção visual azul escuro + dourado. ' + DIAG_MARKER;
        applyReply(next, reply);
      } else {
        const res = await callAgent({ action: 'chat', session_id: sessionId, messages: next });
        if (!res.ok) return handleAgentError(res);
        applyReply(next, String(res.reply ?? ''));
      }
    } finally {
      setBusy(false);
      scrollDown();
    }
  }

  function applyReply(base: Msg[], raw: string) {
    let reply = raw;
    if (reply.includes(DIAG_MARKER)) {
      const diag = reply.replace(DIAG_MARKER, '').trim();
      setDiagnostico(diag);
      reply = diag + '\n\nSe o diagnóstico acima está certo, aprove abaixo para eu gerar os 10 nomes.';
    }
    setMsgs([...base, { role: 'assistant', content: reply }]);
  }

  function handleAgentError(res: { ok: boolean; [k: string]: unknown }) {
    const err = (res.error ?? {}) as { code?: string; message?: string };
    if (err.code === 'disabled' || err.code === 'config' || err.code === 'invoke') {
      setAgenteOff(err.message ?? 'O BrandBot está em configuração.');
    }
    setMsgs((m) => [...m, { role: 'assistant', content: err.message ?? 'Falha ao falar com o BrandBot. Tente novamente.' }]);
  }

  async function gerarNomes() {
    if (!diagnostico || busy) return;
    setBusy(true);
    try {
      if (MOCK) {
        setNomes(MOCK_NOMES);
      } else {
        const res = await callAgent({ action: 'nomes', session_id: sessionId, diagnostico });
        if (!res.ok) { handleAgentError(res); return; }
        setNomes((res.nomes as Nome[]) ?? []);
      }
      setStage('nomes');
    } finally {
      setBusy(false);
    }
  }

  async function checarNome(nome: string) {
    if (!ramo.trim()) return;
    setChecks((c) => ({ ...c, [nome]: { kind: 'loading' } }));
    const res = await runConsultorIaSearch(nome, ramo.trim());
    if (res.ok) {
      const records = res.records ?? [];
      const exatas = records.filter((r) => (r.brand ?? '').trim().toLowerCase() === nome.trim().toLowerCase()).length;
      setChecks((c) => ({ ...c, [nome]: { kind: 'ok', total: res.total ?? records.length, exatas, fonte: res.baseUpdatedAt ?? 'base WebMarcas/INPI' } }));
    } else {
      setChecks((c) => ({ ...c, [nome]: { kind: 'erro', message: res.error.message } }));
    }
  }

  async function gerarLogos() {
    if (!nomeEscolhido || busy) return;
    setBusy(true);
    try {
      if (MOCK) {
        setSvgs(MOCK_SVGS);
        setStage('logos');
      } else {
        const res = await callAgent({ action: 'logos', session_id: sessionId, nome: nomeEscolhido.nome, diagnostico });
        if (!res.ok) { handleAgentError(res); return; }
        setSvgs((res.svgs as string[]) ?? []);
        setStage('logos');
      }
    } finally {
      setBusy(false);
    }
  }

  async function montarEntrega() {
    if (svgEscolhido === null || manualBusy) return;
    setStage('entrega');
    if (MOCK) {
      setManual({ proposito: '(fixture) Propósito da marca.', tom_de_voz: ['fixture'], valores: ['fixture'], paleta: [{ nome: 'Azul', hex: '#1D4ED8', rgb: '29,78,216', cmyk: '87,64,0,15' }], tipografia: { primaria: 'Inter', secundaria: 'Arial', uso: 'fixture' } });
      return;
    }
    setManualBusy(true);
    try {
      const res = await callAgent({ action: 'brandbook', session_id: sessionId, nome: nomeEscolhido?.nome, diagnostico, svg: svgs[svgEscolhido] });
      if (!res.ok) { handleAgentError(res); return; }
      setManual(res.manual as never);
    } finally {
      setManualBusy(false);
    }
  }

  function baixarManualPdf() {
    if (!manual || svgEscolhido === null || !nomeEscolhido) return;
    const doc = new jsPDF();
    let y = 20;
    doc.setFontSize(20);
    doc.text(`Manual de identidade — ${nomeEscolhido.nome}`, 14, y); y += 12;
    doc.setFontSize(12);
    const bloco = (titulo: string, corpo: string | string[]) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFont(undefined as never, 'bold');
      doc.text(titulo, 14, y); y += 6;
      doc.setFont(undefined as never, 'normal');
      const linhas = doc.splitTextToSize(Array.isArray(corpo) ? corpo.join('  •  ') : corpo, 180);
      doc.text(linhas, 14, y); y += linhas.length * 6 + 6;
    };
    if (manual.proposito) bloco('Propósito', manual.proposito);
    if (manual.valores?.length) bloco('Valores', manual.valores);
    if (manual.tom_de_voz?.length) bloco('Tom de voz', manual.tom_de_voz);
    if (manual.tipografia) bloco('Tipografia', `Primária: ${manual.tipografia.primaria ?? '-'}  |  Secundária: ${manual.tipografia.secundaria ?? '-'}
${manual.tipografia.uso ?? ''}`);
    if (manual.paleta?.length) {
      if (y > 230) { doc.addPage(); y = 20; }
      doc.setFont(undefined as never, 'bold');
      doc.text('Paleta de cores', 14, y); y += 8;
      manual.paleta.forEach((c) => {
        const m = /^#?([0-9a-f]{6})$/i.exec(c.hex ?? '');
        if (m) {
          const n = parseInt(m[1], 16);
          doc.setFillColor((n >> 16) & 255, (n >> 8) & 255, n & 255);
          doc.rect(14, y - 5, 10, 10, 'F');
        }
        doc.setFont(undefined as never, 'normal');
        doc.text(`${c.nome}: HEX ${c.hex}  |  RGB ${c.rgb}  |  CMYK ${c.cmyk}`, 28, y + 3);
        y += 12;
      });
      y += 4;
      doc.setFontSize(10);
      doc.text('Equivalências Pantone não fazem parte deste pacote, conforme combinado.', 14, y);
    }
    doc.save(`manual-${nomeEscolhido.nome}.pdf`);
  }

  function rasterizarLogo(tipo: 'png' | 'jpeg') {
    if (svgEscolhido === null || !nomeEscolhido) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 2048; canvas.height = 2048;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      if (tipo === 'jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 2048, 2048); }
      ctx.drawImage(img, 0, 0, 2048, 2048);
      const a = document.createElement('a');
      a.href = canvas.toDataURL(tipo === 'png' ? 'image/png' : 'image/jpeg', 0.95);
      a.download = `${nomeEscolhido.nome}.${tipo === 'png' ? 'png' : 'jpg'}`;
      a.click();
    };
    img.src = svgToDataUrl(svgs[svgEscolhido]);
  }

  async function baixarPdfVetorialLogo() {
    if (svgEscolhido === null || !nomeEscolhido) return;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: [480, 480] });
    const el = document.createElement('div');
    el.innerHTML = svgs[svgEscolhido];
    const svgEl = el.querySelector('svg');
    if (!svgEl) return;
    await (doc as unknown as { svg: (el: SVGSVGElement, o: { x: number; y: number; width: number; height: number }) => Promise<unknown> }).svg(svgEl as SVGSVGElement, { x: 0, y: 0, width: 480, height: 480 });
    doc.save(`${nomeEscolhido.nome}-vetorial.pdf`);
  }

  function baixarSvg() {
    if (svgEscolhido === null) return;
    const blob = new Blob([svgs[svgEscolhido]], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${nomeEscolhido?.nome ?? 'logotipo'}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const etapas = useMemo(() => ([
    { id: 'briefing', label: 'Briefing' },
    { id: 'nomes', label: '10 nomes' },
    { id: 'logos', label: '5 logotipos' },
    { id: 'entrega', label: 'Entrega' },
  ] as const), []);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div className="flex items-center gap-3 border-b px-5 py-3">
        <BrainCircuit className="h-6 w-6 text-primary" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold">Marcas IA — BrandBot</h2>
          <p className="truncate text-xs text-muted-foreground">Criação de nome e logotipo com a sua aprovação em cada etapa.</p>
        </div>
        <div className="hidden items-center gap-1 md:flex">
          {etapas.map((e, i) => (
            <span key={e.id} className={cn('rounded-full px-2.5 py-1 text-xs', stage === e.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
              {i + 1}. {e.label}
            </span>
          ))}
        </div>
      </div>

      {agenteOff && (
        <div className="flex items-center gap-2 border-b bg-amber-500/10 px-5 py-2 text-sm text-amber-700 dark:text-amber-400">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>{agenteOff}</span>
        </div>
      )}

      <AnimatePresence mode="wait">
        {stage === 'briefing' && (
          <motion.div key="briefing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex min-h-0 flex-1 flex-col">
            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {msgs.map((m, i) => (
                <div key={i} className={cn('max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed', m.role === 'assistant' ? 'bg-muted' : 'ml-auto bg-primary text-primary-foreground')}>
                  {m.content}
                </div>
              ))}
              {busy && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> BrandBot pensando...</div>}
            </div>
            {diagnostico && !diagAprovado && (
              <div className="border-t bg-muted/40 px-5 py-3">
                <p className="mb-2 text-sm font-medium">Diagnóstico pronto. Ao aprovar, gero os 10 nomes.</p>
                <Button onClick={() => { setDiagAprovado(true); void gerarNomes(); }} disabled={busy}>
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Aprovar diagnóstico e gerar 10 nomes
                </Button>
              </div>
            )}
            <div className="flex gap-2 border-t px-5 py-3">
              <Textarea
                disabled={!!agenteOff}
                placeholder={agenteOff ? 'BrandBot em ativação — aguarde a liberação.' : undefined}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendChat(); } }}
                placeholder="Responda o BrandBot aqui..."
                className="min-h-[44px] flex-1 resize-none"
                rows={1}
              />
              <Button onClick={() => void sendChat()} disabled={busy || !!agenteOff || !input.trim()}>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {stage === 'nomes' && (
          <motion.div key="nomes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-wrap items-center gap-2 border-b px-5 py-3">
              <span className="text-sm text-muted-foreground">Ramo de atividade para a checagem na base INPI:</span>
              <Input value={ramo} onChange={(e) => setRamo(e.target.value)} placeholder="ex.: cosméticos" className="h-8 w-56" />
              <span className="flex items-center gap-1 text-xs text-muted-foreground"><ShieldAlert className="h-3.5 w-3.5" /> A checagem não garante a aprovação do registro — o exame final é do INPI.</span>
            </div>
            <div className="grid flex-1 grid-cols-1 gap-3 overflow-y-auto px-5 py-4 md:grid-cols-2">
              {nomes.map((n) => {
                const ck = checks[n.nome] ?? { kind: 'idle' as const };
                return (
                  <div key={n.nome} className={cn('rounded-xl border p-4', nomeEscolhido?.nome === n.nome && 'border-primary ring-1 ring-primary')}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <h3 className="text-base font-semibold">{n.nome}</h3>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{n.tom}</span>
                    </div>
                    <p className="mb-3 text-sm text-muted-foreground">{n.justificativa}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => void checarNome(n.nome)} disabled={!ramo.trim() || ck.kind === 'loading'}>
                        {ck.kind === 'loading' ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Search className="mr-2 h-3.5 w-3.5" />}
                        Verificar na base INPI
                      </Button>
                      <Button size="sm" variant={nomeEscolhido?.nome === n.nome ? 'default' : 'secondary'} onClick={() => setNomeEscolhido(n)}>
                        {nomeEscolhido?.nome === n.nome ? 'Escolhido' : 'Escolher este nome'}
                      </Button>
                    </div>
                    {ck.kind === 'ok' && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {ck.exatas > 0
                          ? `Nome exato aparece entre os resultados retornados; ${ck.total} ocorrência(s) relacionada(s) na base (${ck.fonte}). Isso NÃO garante indeferimento nem aprovação — a análise oficial é do INPI.`
                          : `Nenhum nome exato entre os resultados retornados; ${ck.total} ocorrência(s) relacionada(s) na base (${ck.fonte}). Isso NÃO garante disponibilidade — a análise oficial é do INPI.`}
                      </p>
                    )}
                    {ck.kind === 'erro' && <p className="mt-2 text-xs text-destructive">{ck.message}</p>}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between border-t px-5 py-3">
              <Button variant="ghost" onClick={() => setStage('briefing')}><ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao briefing</Button>
              <Button onClick={() => void gerarLogos()} disabled={!nomeEscolhido || busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Gerar 5 logotipos de {nomeEscolhido?.nome ?? '...'}
              </Button>
            </div>
          </motion.div>
        )}

        {stage === 'logos' && (
          <motion.div key="logos" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex min-h-0 flex-1 flex-col">
            <div className="grid flex-1 grid-cols-2 gap-4 overflow-y-auto px-5 py-4 md:grid-cols-3">
              {svgs.map((svg, i) => (
                <button
                  key={i}
                  onClick={() => setSvgEscolhido(i)}
                  className={cn('overflow-hidden rounded-xl border transition', svgEscolhido === i ? 'border-primary ring-2 ring-primary' : 'hover:border-primary/50')}
                >
                  <img src={svgToDataUrl(svg)} alt={`Conceito ${i + 1}`} className="aspect-square w-full bg-white object-contain" />
                  <span className="block py-2 text-sm">Conceito {i + 1}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between border-t px-5 py-3">
              <Button variant="ghost" onClick={() => setStage('nomes')}><ArrowLeft className="mr-2 h-4 w-4" /> Voltar aos nomes</Button>
              <Button onClick={() => void montarEntrega()} disabled={svgEscolhido === null}>
                {manualBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Aprovar conceito {svgEscolhido !== null ? svgEscolhido + 1 : ''} e montar entrega
              </Button>
            </div>
          </motion.div>
        )}

        {stage === 'entrega' && (
          <motion.div key="entrega" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <h3 className="text-lg font-semibold">Entrega da marca {nomeEscolhido?.nome}</h3>
            {svgEscolhido !== null && (
              <div className="flex flex-wrap items-start gap-4">
                <img src={svgToDataUrl(svgs[svgEscolhido])} alt="Logotipo aprovado" className="h-40 w-40 rounded-xl border" />
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={baixarSvg}><Download className="mr-2 h-4 w-4" /> SVG vetorial</Button>
                    <Button variant="secondary" onClick={() => void baixarPdfVetorialLogo()}><Download className="mr-2 h-4 w-4" /> PDF vetorial</Button>
                    <Button variant="secondary" onClick={() => rasterizarLogo('png')}><Download className="mr-2 h-4 w-4" /> PNG transparente</Button>
                    <Button variant="secondary" onClick={() => rasterizarLogo('jpeg')}><Download className="mr-2 h-4 w-4" /> JPEG</Button>
                    <Button variant="secondary" onClick={baixarManualPdf} disabled={!manual}>
                      {manualBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                      Manual de identidade (PDF)
                    </Button>
                  </div>
                  <p className="max-w-md text-sm text-muted-foreground">
                    SVG e PDF são vetor de verdade: abrem e editam no Illustrator, CorelDRAW e Inkscape.
                    O PNG sai com fundo transparente e o JPEG com fundo branco. O EPS (formato de
                    intercâmbio que Corel e Illustrator abrem) está em montagem no servidor — sem Pantone
                    exato, conforme combinado.
                  </p>
                </div>
              </div>
            )}
            {manual && (
              <div className="max-w-2xl space-y-3 rounded-xl border p-4">
                {manual.proposito && <div><h4 className="text-sm font-semibold">Propósito</h4><p className="text-sm text-muted-foreground">{manual.proposito}</p></div>}
                {manual.valores && manual.valores.length > 0 && <div><h4 className="text-sm font-semibold">Valores</h4><p className="text-sm text-muted-foreground">{manual.valores.join(' • ')}</p></div>}
                {manual.tom_de_voz && manual.tom_de_voz.length > 0 && <div><h4 className="text-sm font-semibold">Tom de voz</h4><p className="text-sm text-muted-foreground">{manual.tom_de_voz.join(' • ')}</p></div>}
                {manual.tipografia && <div><h4 className="text-sm font-semibold">Tipografia</h4><p className="text-sm text-muted-foreground">Primária: {manual.tipografia.primaria ?? '-'} | Secundária: {manual.tipografia.secundaria ?? '-'} — {manual.tipografia.uso ?? ''}</p></div>}
                {manual.paleta && manual.paleta.length > 0 && (
                  <div>
                    <h4 className="mb-1 text-sm font-semibold">Paleta</h4>
                    <div className="flex flex-wrap gap-2">
                      {manual.paleta.map((c) => (
                        <div key={c.hex} className="flex items-center gap-2 rounded-lg border px-2 py-1">
                          <span className="h-5 w-5 rounded" style={{ backgroundColor: c.hex }} />
                          <span className="text-xs">{c.nome} {c.hex} • RGB {c.rgb} • CMYK {c.cmyk}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <Button variant="ghost" onClick={() => setStage('logos')}><ArrowLeft className="mr-2 h-4 w-4" /> Voltar aos logotipos</Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
