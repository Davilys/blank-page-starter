import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  QrCode, FileText, CreditCard, Wallet, Loader2, CheckCircle,
  ExternalLink, Copy,
} from 'lucide-react';

type PaymentMethod = 'pix' | 'boleto' | 'cartao';
type PaymentType = 'avista' | 'parcelado';

const PAYMENT_OPTIONS = {
  pix:    { label: 'PIX',               icon: QrCode,      color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/30', description: 'Pagamento instantâneo' },
  boleto: { label: 'Boleto',            icon: FileText,    color: 'text-blue-500',    bg: 'bg-blue-500/10 border-blue-500/30',       description: 'Vencimento em 3 dias úteis' },
  cartao: { label: 'Cartão de Crédito', icon: CreditCard,  color: 'text-violet-500',  bg: 'bg-violet-500/10 border-violet-500/30',   description: 'Parcelamento disponível' },
};

const INSTALLMENT_OPTIONS = { boleto: [1, 2, 3, 4, 5, 6], cartao: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] };
const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

interface CreateInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  onCreated?: () => void;
}

export function CreateInvoiceDialog({ open, onOpenChange, clientId, clientName, onCreated }: CreateInvoiceDialogProps) {
  const [processes, setProcesses] = useState<{ id: string; brand_name: string }[]>([]);
  const [formData, setFormData] = useState({ description: '', amount: '', due_date: '', process_id: '', observation: '' });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [paymentType, setPaymentType] = useState<PaymentType>('avista');
  const [installments, setInstallments] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [invoiceResult, setInvoiceResult] = useState<{ success: boolean; invoice_url?: string; pix_code?: string; pix_qr_code?: string } | null>(null);

  useEffect(() => {
    if (open && clientId) {
      supabase.from('brand_processes').select('id, brand_name').eq('user_id', clientId).then(({ data }) => setProcesses(data || []));
    }
  }, [open, clientId]);

  const resetForm = () => {
    setFormData({ description: '', amount: '', due_date: '', process_id: '', observation: '' });
    setPaymentMethod('pix'); setPaymentType('avista'); setInstallments(1); setInvoiceResult(null);
  };

  const handleClose = (o: boolean) => { onOpenChange(o); if (!o) resetForm(); };
  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); toast.success('Código copiado!'); };

  const getInstallmentValue = () => {
    if (!formData.amount) return 0;
    const total = parseFloat(formData.amount);
    if (paymentType === 'avista' || installments <= 1) return total;
    return Math.ceil((total / installments) * 100) / 100;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description || !formData.amount || !formData.due_date) { toast.error('Preencha todos os campos obrigatórios'); return; }
    setSubmitting(true);
    try {
      const response = await supabase.functions.invoke('create-admin-invoice', {
        body: {
          user_id: clientId, process_id: formData.process_id || null,
          description: formData.description + (formData.observation ? ` - ${formData.observation}` : ''),
          payment_method: paymentMethod, payment_type: paymentType,
          installments: paymentType === 'parcelado' ? installments : 1,
          total_value: parseFloat(formData.amount), due_date: formData.due_date,
        },
      });
      if (response.error) throw new Error(response.error.message);
      const data = response.data;
      if (data.success) {
        toast.success('Fatura criada com sucesso!');
        setInvoiceResult({ success: true, invoice_url: data.invoice_url, pix_code: data.pix_code, pix_qr_code: data.pix_qr_code });
        onCreated?.();
      } else throw new Error(data.error || 'Erro ao criar fatura');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar fatura');
    } finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" /> Nova Fatura — {clientName}
          </DialogTitle>
        </DialogHeader>
        <AnimatePresence mode="wait">
          {invoiceResult?.success ? (
            <motion.div key="result" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="text-center p-6 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
                <h3 className="font-bold text-lg text-emerald-500">Fatura criada com sucesso!</h3>
                <p className="text-sm text-muted-foreground">A cobrança foi gerada para {clientName}</p>
              </div>
              {invoiceResult.pix_code && (
                <div className="space-y-2">
                  <Label>Código PIX Copia e Cola</Label>
                  <div className="flex gap-2">
                    <Input value={invoiceResult.pix_code} readOnly className="text-xs font-mono" />
                    <Button variant="outline" size="icon" onClick={() => copyToClipboard(invoiceResult.pix_code!)}><Copy className="h-4 w-4" /></Button>
                  </div>
                </div>
              )}
              {invoiceResult.pix_qr_code && (
                <div className="flex justify-center">
                  <img src={`data:image/png;base64,${invoiceResult.pix_qr_code}`} alt="QR Code PIX" className="w-48 h-48 border rounded-lg" />
                </div>
              )}
              {invoiceResult.invoice_url && (
                <Button variant="outline" className="w-full" onClick={() => window.open(invoiceResult.invoice_url, '_blank')}>
                  <ExternalLink className="h-4 w-4 mr-2" /> Abrir Fatura
                </Button>
              )}
              <Button className="w-full" onClick={() => handleClose(false)}>Fechar</Button>
            </motion.div>
          ) : (
            <motion.form key="form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} onSubmit={handleSubmit} className="space-y-5">
              {/* Client (read-only) */}
              <div>
                <Label className="text-sm font-medium">Cliente</Label>
                <Input value={clientName} readOnly className="mt-1 bg-muted/40" />
              </div>
              {processes.length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Processo (opcional)</Label>
                  <Select value={formData.process_id} onValueChange={(v) => setFormData({ ...formData, process_id: v })}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Vincular a um processo" /></SelectTrigger>
                    <SelectContent>
                      {processes.map((p) => <SelectItem key={p.id} value={p.id}>{p.brand_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label className="text-sm font-medium">Descrição *</Label>
                <Input className="mt-1" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Ex: Honorários de Registro de Marca" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Valor Total (R$) *</Label>
                  <Input className="mt-1" type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} placeholder="699.00" />
                </div>
                <div>
                  <Label className="text-sm font-medium">Vencimento *</Label>
                  <Input className="mt-1" type="date" value={formData.due_date} onChange={(e) => setFormData({ ...formData, due_date: e.target.value })} />
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium mb-3 block">Forma de Pagamento *</Label>
                <div className="grid grid-cols-3 gap-3">
                  {(Object.keys(PAYMENT_OPTIONS) as PaymentMethod[]).map((method) => {
                    const cfg = PAYMENT_OPTIONS[method]; const Icon = cfg.icon; const sel = paymentMethod === method;
                    return (
                      <motion.button key={method} type="button" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        onClick={() => { setPaymentMethod(method); if (method === 'pix') { setPaymentType('avista'); setInstallments(1); } }}
                        className={cn("p-4 rounded-xl border-2 transition-all text-left", sel ? `${cfg.bg} ${cfg.color} shadow-md` : "border-border bg-muted/20 hover:bg-muted/40")}
                      >
                        <Icon className={cn("h-6 w-6 mb-2", sel ? cfg.color : "text-muted-foreground")} />
                        <p className={cn("font-medium text-sm", sel ? cfg.color : "text-foreground")}>{cfg.label}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{cfg.description}</p>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
              {paymentMethod !== 'pix' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                  <Label className="text-sm font-medium mb-3 block">Tipo de Pagamento</Label>
                  <RadioGroup value={paymentType} onValueChange={(v) => { setPaymentType(v as PaymentType); if (v === 'avista') setInstallments(1); else setInstallments(2); }} className="flex gap-4">
                    <div className="flex items-center space-x-2"><RadioGroupItem value="avista" id="inv-avista" /><Label htmlFor="inv-avista" className="cursor-pointer">À Vista</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="parcelado" id="inv-parcelado" /><Label htmlFor="inv-parcelado" className="cursor-pointer">Parcelado</Label></div>
                  </RadioGroup>
                </motion.div>
              )}
              {paymentMethod !== 'pix' && paymentType === 'parcelado' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                  <Label className="text-sm font-medium mb-2 block">Número de Parcelas</Label>
                  <Select value={installments.toString()} onValueChange={(v) => setInstallments(parseInt(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {INSTALLMENT_OPTIONS[paymentMethod].map((n) => (
                        <SelectItem key={n} value={n.toString()}>{n}x de R$ {fmt(getInstallmentValue())}{n === 1 && ' (À Vista)'}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </motion.div>
              )}
              {formData.amount && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 bg-muted/40 rounded-xl border space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Método:</span><span className="font-medium">{PAYMENT_OPTIONS[paymentMethod].label}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Parcelas:</span><span className="font-medium">{paymentMethod === 'pix' ? '1x (À Vista)' : `${installments}x`}</span></div>
                  <div className="flex justify-between text-sm border-t pt-2"><span className="text-muted-foreground">Valor por parcela:</span><span className="font-bold text-lg">R$ {fmt(getInstallmentValue())}</span></div>
                </motion.div>
              )}
              <div>
                <Label className="text-sm font-medium">Observação (opcional)</Label>
                <Textarea className="mt-1" value={formData.observation} onChange={(e) => setFormData({ ...formData, observation: e.target.value })} placeholder="Observações adicionais..." rows={2} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={submitting}>Cancelar</Button>
                <Button type="submit" disabled={submitting} className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600">
                  {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Criando...</> : <><Wallet className="h-4 w-4 mr-2" />Criar Fatura</>}
                </Button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
