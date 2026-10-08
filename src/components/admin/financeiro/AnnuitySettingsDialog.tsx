import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, RotateCcw, Send, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { calcAnnuityDueDate, fmtBR, todaySaoPaulo } from '@/lib/annuity';

type S = Record<string, any>;
type Call = (action: string, payload?: Record<string, unknown>) => Promise<any>;

const VARS: [string, string][] = [
  ['nome_cliente', 'Nome do cliente'], ['valor', 'Valor'], ['exercicio', 'Exercício'], ['periodo_referencia', 'Período'],
  ['data_vencimento', 'Vencimento'], ['botao_boleto', 'Botão do boleto'], ['link_boleto', 'Link do boleto'], ['marcas', 'Marcas'],
];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

interface Props {
  open: boolean; onOpenChange: (o: boolean) => void; call: Call;
  campaign: S | null; exercicio: number; onSaved: () => void;
}

export function AnnuitySettingsDialog({ open, onOpenChange, call, campaign, exercicio, onSaved }: Props) {
  const [s, setS] = useState<S | null>(null);
  const [factory, setFactory] = useState<S | null>(null);
  const [startDate, setStartDate] = useState('');
  const [periodLabel, setPeriodLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [preview, setPreview] = useState<{ subject: string; html: string; problems?: string[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [testTo, setTestTo] = useState('');
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [focusField, setFocusField] = useState<'email_body_tpl' | 'email_subject_tpl' | 'boleto_description_tpl'>('email_body_tpl');

  useEffect(() => {
    if (!open) return;
    setS(null);
    call('get_settings', { campaign_id: campaign?.id }).then((r) => {
      const base = r.campaign || r.defaults;
      setS(base); setFactory(r.factory);
      setAmount((base.amount_cents / 100).toFixed(2).replace('.', ','));
      setStartDate(r.campaign?.start_date || '');
      setPeriodLabel(r.campaign?.period_label || '');
    }).catch((e) => toast.error(e.message));
  }, [open, campaign?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const cents = Math.round(Number(amount.replace(/\./g, '').replace(',', '.')) * 100);
  const draft = s ? { ...s, amount_cents: Number.isFinite(cents) ? cents : s.amount_cents } : null;

  useEffect(() => {
    if (!draft || !open) return;
    const t = setTimeout(() => {
      call('preview', { settings: draft, exercicio, campaign_id: campaign?.id, period_label: periodLabel || undefined })
        .then(setPreview).catch(() => null);
    }, 500);
    return () => clearTimeout(t);
  }, [JSON.stringify(draft), periodLabel, open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;
  const set = (k: string, v: any) => setS((p) => ({ ...(p || {}), [k]: v }));

  const insertVar = (v: string) => {
    const tag = `{{${v}}}`;
    if (focusField === 'email_body_tpl' && bodyRef.current) {
      const el = bodyRef.current; const a = el.selectionStart; const b = el.selectionEnd;
      const val = s?.email_body_tpl || '';
      set('email_body_tpl', val.slice(0, a) + tag + val.slice(b));
      requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + tag.length, a + tag.length); });
    } else set(focusField, `${s?.[focusField] || ''}${tag}`);
  };

  const save = async (scope: 'default' | 'campaign' | 'both') => {
    if (!draft) return;
    setSaving(true);
    try {
      await call('save_settings', { scope, settings: draft, campaign_id: campaign?.id, start_date: startDate || undefined, period_label: periodLabel || undefined });
      toast.success(scope === 'default' ? 'Padrão salvo para os próximos exercícios' : scope === 'campaign' ? `Salvo para o exercício ${exercicio}` : 'Salvo no exercício e como padrão');
      onSaved(); onOpenChange(false);
    } catch (e) { toast.error((e as Error).message); } finally { setSaving(false); }
  };

  const today = todaySaoPaulo();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurações da anuidade</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {campaign ? `Editando o exercício ${exercicio}. Boletos já emitidos não são alterados.` : 'Editando o modelo padrão, usado ao gerar cada novo exercício.'}
          </p>
        </DialogHeader>
        {!s ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (
          <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
            <Tabs defaultValue="email">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="cobranca">Cobrança</TabsTrigger>
                <TabsTrigger value="agenda">Agenda</TabsTrigger>
                <TabsTrigger value="email">E-mail</TabsTrigger>
                <TabsTrigger value="regras">Regras</TabsTrigger>
              </TabsList>

              <TabsContent value="cobranca" className="space-y-4 pt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Valor da anuidade (R$)</Label><Input value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
                  <div><Label>Dias para vencer após a emissão</Label><Input type="number" min={1} max={60} value={s.due_days} onChange={(e) => set('due_days', Number(e.target.value))} /></div>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div><div className="text-sm font-medium">Passar para segunda se cair em sexta, sábado ou domingo</div>
                    <div className="text-xs text-muted-foreground">Ex.: emissão hoje ({fmtBR(today)}) → vence {fmtBR(calcAnnuityDueDate(today, Number(s.due_days) || 5, !!s.weekend_shift))}</div></div>
                  <Switch checked={!!s.weekend_shift} onCheckedChange={(v) => set('weekend_shift', v)} />
                </div>
                <div><Label>Descrição do boleto no Asaas</Label>
                  <Input value={s.boleto_description_tpl} onFocus={() => setFocusField('boleto_description_tpl')} onChange={(e) => set('boleto_description_tpl', e.target.value)} />
                  <p className="mt-1 text-xs text-muted-foreground">Campos aceitos: {'{{exercicio}}'}, {'{{periodo_referencia}}'}, {'{{marcas}}'}</p></div>
              </TabsContent>

              <TabsContent value="agenda" className="space-y-4 pt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Dia de início (padrão)</Label><Input type="number" min={1} max={31} value={s.start_day} onChange={(e) => set('start_day', Number(e.target.value))} /></div>
                  <div><Label>Mês de início (padrão)</Label>
                    <Select value={String(s.start_month)} onValueChange={(v) => set('start_month', Number(v))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                    </Select></div>
                  <div><Label>Horário diário dos lotes (h)</Label><Input type="number" min={0} max={23} value={s.daily_hour} onChange={(e) => set('daily_hour', Number(e.target.value))} /></div>
                  <div><Label>Clientes por dia (até 200)</Label><Input type="number" min={1} max={200} value={s.daily_limit} onChange={(e) => set('daily_limit', Math.min(200, Number(e.target.value)))} /></div>
                </div>
                <div><Label>Nome do período (padrão)</Label><Input value={s.period_label_tpl} onChange={(e) => set('period_label_tpl', e.target.value)} />
                  <p className="mt-1 text-xs text-muted-foreground">Use {'{{exercicio}}'} para o ano. Ex.: “Exercício {'{{exercicio}}'}”.</p></div>
                {campaign && (
                  <div className="grid grid-cols-2 gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
                    <div className="col-span-2 text-xs font-semibold text-primary">Somente o exercício {exercicio}</div>
                    <div><Label>Data de início</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
                    <div><Label>Período de referência</Label><Input value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} /></div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="email" className="space-y-4 pt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Nome do remetente</Label><Input value={s.sender_name} onChange={(e) => set('sender_name', e.target.value)} /></div>
                  <div><Label>E-mail para respostas</Label><Input value={s.reply_to} onChange={(e) => set('reply_to', e.target.value)} /></div>
                </div>
                <div><Label>Assunto</Label><Input value={s.email_subject_tpl} onFocus={() => setFocusField('email_subject_tpl')} onChange={(e) => set('email_subject_tpl', e.target.value)} /></div>
                <div>
                  <div className="mb-1 flex items-center justify-between"><Label>Texto do e-mail</Label>
                    <Button type="button" size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => factory && setS({ ...s, email_body_tpl: factory.email_body_tpl, email_subject_tpl: factory.email_subject_tpl, email_button_label: factory.email_button_label, email_footer: factory.email_footer })}>
                      <RotateCcw className="h-3 w-3" /> Restaurar texto padrão</Button></div>
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {VARS.map(([k, l]) => <button key={k} type="button" onClick={() => insertVar(k)} className="rounded-md border border-primary/30 bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/10">+ {l}</button>)}
                  </div>
                  <Textarea ref={bodyRef} rows={12} className="font-mono text-xs" value={s.email_body_tpl} onFocus={() => setFocusField('email_body_tpl')} onChange={(e) => set('email_body_tpl', e.target.value)} />
                  <p className="mt-1 text-xs text-muted-foreground">Deixe uma linha em branco entre parágrafos. Coloque {'{{botao_boleto}}'} sozinho numa linha para mostrar o botão.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Texto do botão</Label><Input value={s.email_button_label} onChange={(e) => set('email_button_label', e.target.value)} /></div>
                  <div><Label>Rodapé</Label><Textarea rows={3} value={s.email_footer} onChange={(e) => set('email_footer', e.target.value)} /></div>
                </div>
              </TabsContent>

              <TabsContent value="regras" className="space-y-4 pt-3">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div><div className="text-sm font-medium">Exigir cláusula de anuidade no contrato assinado</div>
                    <div className="text-xs text-muted-foreground">Sem a cláusula, o cliente vai para “Em revisão” em vez de ser cobrado.</div></div>
                  <Switch checked={!!s.require_clause} onCheckedChange={(v) => set('require_clause', v)} />
                </div>
                <div><Label>Palavra que identifica a cláusula</Label><Input value={s.clause_keyword} onChange={(e) => set('clause_keyword', e.target.value)} disabled={!s.require_clause} /></div>
                <p className="text-xs text-muted-foreground">Clientes com distrato assinado são sempre excluídos. Envio somente por e-mail.</p>
              </TabsContent>
            </Tabs>

            <div className="space-y-2">
              <div className="text-sm font-semibold">Prévia</div>
              {preview?.problems?.length ? (
                <div className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0" /><div>{preview.problems.join(' ')}</div></div>) : null}
              <div className="text-xs"><span className="text-muted-foreground">Assunto:</span> <strong>{preview?.subject || '…'}</strong></div>
              {preview ? <iframe title="Prévia" srcDoc={preview.html} sandbox="" className="h-[460px] w-full rounded-lg border" /> : <div className="h-[460px] rounded-lg border" />}
              <div className="flex gap-2">
                <Input placeholder="E-mail interno para teste" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
                <Button variant="outline" size="sm" className="gap-1" disabled={!testTo}
                  onClick={() => call('test_email', { to: testTo, settings: draft, exercicio, campaign_id: campaign?.id }).then(() => toast.success('Teste enviado (sem boleto real)')).catch((e) => toast.error(e.message))}>
                  <Send className="h-3.5 w-3.5" /> Teste</Button>
              </div>
            </div>
          </div>
        )}
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
          {campaign ? <>
            <Button variant="outline" disabled={saving || !s} onClick={() => save('campaign')}>Salvar só para {exercicio}</Button>
            <Button disabled={saving || !s} onClick={() => save('both')}>{saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Salvar em {exercicio} e como padrão</Button>
          </> : <Button disabled={saving || !s} onClick={() => save('default')}>{saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Salvar padrão</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
