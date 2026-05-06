import { useEffect, useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, RefreshCw, Loader2, Zap, AlertTriangle, Users, DollarSign, TrendingUp, Search, Mail, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ClientWithProcess } from "@/components/admin/clients/ClientKanbanBoard";
import { DatePeriodFilter, type DateFilterType } from "@/components/admin/clients/DatePeriodFilter";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";

const ClientDetailSheet = lazy(() =>
  import("@/components/admin/clients/ClientDetailSheet").then((m) => ({ default: m.ClientDetailSheet }))
);

interface Debtor {
  key: string;
  cliente_nome: string | null;
  cliente_cpf_cnpj: string | null;
  cliente_email: string | null;
  asaas_customer_id: string;
  parcelas: any[];
  qtd_parcelas: number;
  total_original: number;
  acrescimo: number;
  novo_total: number;
  valor_parcela: number;
  datas_parcelas: string[];
}

interface Renegociacao {
  id: string;
  cliente_nome: string | null;
  cliente_cpf_cnpj: string | null;
  valor_original_total: number;
  valor_acrescimo: number;
  valor_renegociado: number;
  motivo_cobranca: string;
  created_at: string;
  parcelas_renegociadas?: any[];
}

interface NegociacaoDevedor {
  id: string;
  cliente_nome: string | null;
  cliente_cpf_cnpj: string | null;
  asaas_customer_id: string | null;
  tipo: 'negociar' | 'cobrar';
  valor_original_total: number;
  valor_acrescimo: number;
  valor_total: number;
  created_at: string;
  parcelas_devedor?: any[];
}

const fmtBRL = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
const fmtDate = (s: string) => {
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
};

async function callApi(action: string, body?: any) {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) throw new Error("Sessão expirada — faça login novamente.");
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asaas-debtors-api?action=${encodeURIComponent(action)}`;
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

export default function Devedores() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [debtors30, setDebtors30] = useState<Debtor[]>([]);
  const [history, setHistory] = useState<Renegociacao[]>([]);
  const [history30, setHistory30] = useState<NegociacaoDevedor[]>([]);
  const [selected, setSelected] = useState<Debtor | null>(null);
  const [selectedNeg, setSelectedNeg] = useState<Debtor | null>(null);
  const [selectedCob, setSelectedCob] = useState<Debtor | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [renegLoading, setRenegLoading] = useState(false);
  const [openClient, setOpenClient] = useState<ClientWithProcess | null>(null);
  const [loadingClient, setLoadingClient] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilterType>("all");
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [resending, setResending] = useState<string | null>(null);

  const buildRenegMessage = (nome: string, valor: string, dias: number, link: string) => {
    const firstName = (nome || "Cliente").split(" ")[0];
    const msg =
`Oi ${firstName}! Tudo bem?

Consegui uma condição especial pra você não perder o seu processo de registro de marca 👇

✅ Parcelamos o débito ${valor} em aberto com mais de ${dias} dias, em até 5x sem juros no boleto!
📅 Primeira parcela só dia 20, segue fatura: ${link}

Assim você mantém seu contrato ativo e evita qualquer risco de cancelamento 🚨

Nosso objetivo é garantir que sua marca continue protegida e em andamento no INPI.

Só para confirma aqui ja liberei essa condição pra você, combinado... 👍`;
    const html = `
<p>Oi <strong>${firstName}</strong>! Tudo bem?</p>
<p>Consegui uma condição especial pra você não perder o seu processo de registro de marca 👇</p>
<p>✅ Parcelamos o débito <strong>${valor}</strong> em aberto com mais de <strong>${dias} dias</strong>, em até <strong>5x sem juros</strong> no boleto!</p>
<p>📅 Primeira parcela só dia 20, segue fatura: ${link ? `<a href="${link}" target="_blank" rel="noopener">${link}</a>` : "(link indisponível)"}</p>
<p>Assim você mantém seu contrato ativo e evita qualquer risco de cancelamento 🚨</p>
<p>Nosso objetivo é garantir que sua marca continue protegida e em andamento no INPI.</p>
<p>Só para confirma aqui ja liberei essa condição pra você, combinado... 👍</p>`;
    return { msg, html };
  };

  const buildNegociar30Message = (nome: string, valorTotal: string, link: string) => {
    const firstName = (nome || "Cliente").split(" ")[0];
    const msg =
`Oi ${firstName}! Tudo bem?

Para você não ficar com pendências em aberto, consegui parcelar suas faturas vencidas em até 3x sem juros no boleto 👇

✅ Total renegociado: ${valorTotal} (com pequeno acréscimo de 10%)
📅 1ª parcela vence dia 20, segue boleto: ${link}

Assim você regulariza tudo de forma tranquila e mantém seu cadastro em dia.

Já liberei essa condição pra você, combinado? 👍`;
    const html = `
<p>Oi <strong>${firstName}</strong>! Tudo bem?</p>
<p>Para você não ficar com pendências em aberto, consegui parcelar suas faturas vencidas em até <strong>3x sem juros</strong> no boleto 👇</p>
<p>✅ Total renegociado: <strong>${valorTotal}</strong> (com pequeno acréscimo de 10%)</p>
<p>📅 1ª parcela vence dia 20, segue boleto: ${link ? `<a href="${link}" target="_blank" rel="noopener">${link}</a>` : "(link indisponível)"}</p>
<p>Assim você regulariza tudo de forma tranquila e mantém seu cadastro em dia.</p>
<p>Já liberei essa condição pra você, combinado? 👍</p>`;
    return { msg, html };
  };

  const buildCobrarMessage = (nome: string, valorTotal: string, link: string) => {
    const firstName = (nome || "Cliente").split(" ")[0];
    const msg =
`Oi ${firstName}! Tudo bem?

Juntei todas as suas faturas em aberto em um único boleto, sem qualquer acréscimo, pra ficar mais fácil de quitar 👇

✅ Total: ${valorTotal}
📅 Vencimento dia 20, segue boleto: ${link}

Assim você regulariza tudo de uma vez e fica em dia.

Combinado? 👍`;
    const html = `
<p>Oi <strong>${firstName}</strong>! Tudo bem?</p>
<p>Juntei todas as suas faturas em aberto em um <strong>único boleto</strong>, sem qualquer acréscimo, pra ficar mais fácil de quitar 👇</p>
<p>✅ Total: <strong>${valorTotal}</strong></p>
<p>📅 Vencimento dia 20, segue boleto: ${link ? `<a href="${link}" target="_blank" rel="noopener">${link}</a>` : "(link indisponível)"}</p>
<p>Assim você regulariza tudo de uma vez e fica em dia.</p>
<p>Combinado? 👍</p>`;
    return { msg, html };
  };

  const handleResendNotification = async (h: Renegociacao, channel: 'email' | 'whatsapp') => {
    setResending(`${h.id}-${channel}`);
    try {
      // primeira parcela (link)
      const parcelas = (h.parcelas_renegociadas || []).slice().sort((a: any, b: any) => (a.numero_parcela || 0) - (b.numero_parcela || 0));
      const link = parcelas[0]?.invoice_url || parcelas[0]?.link_boleto || "";
      const dias = 60;
      const valor = fmtBRL(h.valor_original_total);

      // buscar contato
      let email = "";
      let phone = "";
      if (h.cliente_cpf_cnpj) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("email, phone")
          .or(`cpf.eq.${h.cliente_cpf_cnpj},cpf_cnpj.eq.${h.cliente_cpf_cnpj}`)
          .maybeSingle();
        email = prof?.email || "";
        phone = prof?.phone || "";
      }

      if (channel === 'email' && !email) { toast.error("Cliente sem e-mail cadastrado."); return; }
      if (channel === 'whatsapp' && !phone) { toast.error("Cliente sem telefone cadastrado."); return; }

      const nome = h.cliente_nome || "Cliente";
      const { msg, html } = buildRenegMessage(nome, valor, dias, link);

      const { data, error } = await supabase.functions.invoke("send-multichannel-notification", {
        body: {
          event_type: "manual",
          channels: [channel],
          recipient: { nome, phone, email },
          custom_message: msg,
          custom_html: html,
          custom_subject: "Condição especial para regularizar seu registro de marca",
          data: { link, marca: "sua marca" },
        },
      });
      if (error) throw new Error(error.message);
      const results = (data as any)?.results || {};
      const failed = Object.values(results).filter((r: any) => r && r.success === false && !r.skipped).length;
      if (failed > 0) toast.warning(`Falha ao reenviar por ${channel}.`);
      else toast.success(`Notificação reenviada por ${channel === 'email' ? 'e-mail' : 'WhatsApp'}.`);
    } catch (e: any) {
      toast.error(`Falha: ${e.message}`);
    } finally {
      setResending(null);
    }
  };

  const handleResendDevedor = async (h: NegociacaoDevedor, channel: 'email' | 'whatsapp') => {
    setResending(`${h.id}-${channel}`);
    try {
      const parcelas = (h.parcelas_devedor || []).slice().sort((a: any, b: any) => (a.numero_parcela || 0) - (b.numero_parcela || 0));
      const link = parcelas[0]?.invoice_url || parcelas[0]?.link_boleto || "";
      let email = ""; let phone = "";
      if (h.cliente_cpf_cnpj) {
        const { data: prof } = await supabase.from("profiles").select("email, phone")
          .or(`cpf.eq.${h.cliente_cpf_cnpj},cpf_cnpj.eq.${h.cliente_cpf_cnpj}`).maybeSingle();
        email = prof?.email || ""; phone = prof?.phone || "";
      }
      if (channel === 'email' && !email) { toast.error("Cliente sem e-mail."); return; }
      if (channel === 'whatsapp' && !phone) { toast.error("Cliente sem telefone."); return; }
      const nome = h.cliente_nome || "Cliente";
      const valor = fmtBRL(h.valor_total);
      const { msg, html } = h.tipo === 'negociar'
        ? buildNegociar30Message(nome, valor, link)
        : buildCobrarMessage(nome, valor, link);
      const subject = h.tipo === 'negociar'
        ? "Condição especial para regularizar suas faturas"
        : "Boleto único das suas faturas em aberto";
      const { error } = await supabase.functions.invoke("send-multichannel-notification", {
        body: {
          event_type: "manual",
          channels: [channel],
          recipient: { nome, phone, email },
          custom_message: msg, custom_html: html, custom_subject: subject,
          data: { link, marca: "sua marca" },
        },
      });
      if (error) throw new Error(error.message);
      toast.success(`Notificação reenviada por ${channel === 'email' ? 'e-mail' : 'WhatsApp'}.`);
    } catch (e: any) {
      toast.error(`Falha: ${e.message}`);
    } finally {
      setResending(null);
    }
  };

  const fetchDebtors = async () => {
    setLoading(true);
    try {
      const r = await callApi("list-debtors-grouped");
      setDebtors(r.debtors || []);
      try {
        const r30 = await callApi("list-debtors-30-grouped");
        setDebtors30(r30.debtors || []);
      } catch (e) { console.warn("list 30 fail", e); }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    const { data, error } = await supabase
      .from("renegociacoes")
      .select("*, parcelas_renegociadas(*)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) { toast.error(error.message); return; }
    setHistory((data || []) as any);
    const { data: d30, error: e30 } = await (supabase as any)
      .from("negociacoes_devedor")
      .select("*, parcelas_devedor(*)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (e30) { console.warn("hist 30 fail", e30); return; }
    setHistory30((d30 || []) as any);
  };

  useEffect(() => {
    fetchDebtors();
    fetchHistory();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const [r, r30] = await Promise.all([
        callApi("sync-overdue"),
        callApi("sync-overdue-30"),
      ]);
      toast.success(`Sincronizado: ${r.kept_over_60d} com 60+ dias e ${r30.kept_under_30d} com até 30 dias.`);
      await fetchDebtors();
      await fetchHistory();
    } catch (e: any) {
      toast.error(`Falha na sincronização: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleRenegotiate = async () => {
    if (!selected) return;
    setRenegLoading(true);
    try {
      const r = await callApi("renegotiate", {
        cliente_cpf_cnpj: selected.cliente_cpf_cnpj,
        asaas_customer_id: selected.asaas_customer_id,
        observacao: observacao || undefined,
      });
      toast.success(`Renegociação criada com ${r.parcelas_criadas} boleto(s) no Asaas.`);

      // ── envia notificação automática (email + WhatsApp) ──
      try {
        const nome = (r.cliente_nome || selected.cliente_nome || "Cliente").split(" ")[0];
        const valor = fmtBRL(r.valor_debito_original ?? selected.total_original);
        const dias = r.dias_vencimento_max ?? 60;
        const link = r.primeira_fatura_url || "";
        const email = r.cliente_email || selected.cliente_email || "";
        const phone = r.cliente_telefone || "";

        const msg =
`Oi ${nome}! Tudo bem?

Consegui uma condição especial pra você não perder o seu processo de registro de marca 👇

✅ Parcelamos o débito ${valor} em aberto com mais de ${dias} dias, em até 5x sem juros no boleto!
📅 Primeira parcela só dia 20, segue fatura: ${link}

Assim você mantém seu contrato ativo e evita qualquer risco de cancelamento 🚨

Nosso objetivo é garantir que sua marca continue protegida e em andamento no INPI.

Só para confirma aqui ja liberei essa condição pra você, combinado... 👍`;

        const html = `
<p>Oi <strong>${nome}</strong>! Tudo bem?</p>
<p>Consegui uma condição especial pra você não perder o seu processo de registro de marca 👇</p>
<p>✅ Parcelamos o débito <strong>${valor}</strong> em aberto com mais de <strong>${dias} dias</strong>, em até <strong>5x sem juros</strong> no boleto!</p>
<p>📅 Primeira parcela só dia 20, segue fatura: ${link ? `<a href="${link}" target="_blank" rel="noopener">${link}</a>` : "(link indisponível)"}</p>
<p>Assim você mantém seu contrato ativo e evita qualquer risco de cancelamento 🚨</p>
<p>Nosso objetivo é garantir que sua marca continue protegida e em andamento no INPI.</p>
<p>Só para confirma aqui ja liberei essa condição pra você, combinado... 👍</p>`;

        const channelsToSend: Array<'whatsapp' | 'email'> = [];
        if (phone) channelsToSend.push('whatsapp');
        if (email) channelsToSend.push('email');

        if (channelsToSend.length === 0) {
          toast.warning("Renegociação criada, mas cliente sem email/telefone para notificar.");
        } else {
          const { data, error } = await supabase.functions.invoke("send-multichannel-notification", {
            body: {
              event_type: "manual",
              channels: channelsToSend,
              recipient: { nome, phone, email },
              custom_message: msg,
              custom_html: html,
              custom_subject: "Condição especial para regularizar seu registro de marca",
              data: { link, marca: "sua marca" },
            },
          });
          if (error) {
            toast.warning(`Renegociação criada, mas falha ao notificar: ${error.message}`);
          } else {
            const results = (data as any)?.results || {};
            const failed = Object.values(results).filter((r: any) => r && r.success === false && !r.skipped).length;
            if (failed > 0) toast.warning(`Renegociação criada, mas ${failed} canal(is) falharam ao notificar.`);
            else toast.success(`Cliente notificado (${channelsToSend.join(' + ')}).`);
          }
        }
      } catch (e: any) {
        toast.warning(`Renegociação criada, mas falha ao notificar: ${e.message}`);
      }

      setSelected(null);
      setObservacao("");
      await fetchDebtors();
      await fetchHistory();
    } catch (e: any) {
      toast.error(`Falha: ${e.message}`);
    } finally {
      setRenegLoading(false);
    }
  };

  const handleNegociarOrCobrar = async (kind: 'negociar' | 'cobrar') => {
    const target = kind === 'negociar' ? selectedNeg : selectedCob;
    if (!target) return;
    setActionLoading(true);
    try {
      const r = await callApi(kind === 'negociar' ? 'negociar-devedor' : 'cobrar-devedor', {
        cliente_cpf_cnpj: target.cliente_cpf_cnpj,
        asaas_customer_id: target.asaas_customer_id,
      });
      toast.success(`${kind === 'negociar' ? 'Negociação' : 'Cobrança'} criada com ${r.parcelas_criadas} boleto(s).`);

      try {
        const nome = r.cliente_nome || target.cliente_nome || "Cliente";
        const valor = fmtBRL(r.valor_total);
        const link = r.primeira_fatura_url || "";
        const email = r.cliente_email || target.cliente_email || "";
        const phone = r.cliente_telefone || "";
        const { msg, html } = kind === 'negociar'
          ? buildNegociar30Message(nome, valor, link)
          : buildCobrarMessage(nome, valor, link);
        const subject = kind === 'negociar'
          ? "Condição especial para regularizar suas faturas"
          : "Boleto único das suas faturas em aberto";
        const channels: Array<'whatsapp'|'email'> = [];
        if (phone) channels.push('whatsapp');
        if (email) channels.push('email');
        if (channels.length === 0) {
          toast.warning("Criado, mas cliente sem email/telefone.");
        } else {
          await supabase.functions.invoke("send-multichannel-notification", {
            body: {
              event_type: "manual", channels,
              recipient: { nome, phone, email },
              custom_message: msg, custom_html: html, custom_subject: subject,
              data: { link, marca: "sua marca" },
            },
          });
          toast.success(`Cliente notificado (${channels.join(' + ')}).`);
        }
      } catch (e: any) {
        toast.warning(`Criado, mas falha ao notificar: ${e.message}`);
      }

      setSelectedNeg(null); setSelectedCob(null);
      await fetchDebtors();
      await fetchHistory();
    } catch (e: any) {
      toast.error(`Falha: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const getInterval = (): { start: Date; end: Date } | null => {
    const now = new Date();
    if (dateFilter === "today") return { start: startOfDay(now), end: endOfDay(now) };
    if (dateFilter === "week") return { start: startOfWeek(now, { weekStartsOn: 0 }), end: endOfWeek(now, { weekStartsOn: 0 }) };
    if (dateFilter === "month") return { start: startOfMonth(selectedMonth), end: endOfMonth(selectedMonth) };
    return null;
  };
  const interval = getInterval();

  const matchesSearch = (text: string | null | undefined) =>
    !searchTerm || (text || "").toLowerCase().includes(searchTerm.toLowerCase());

  const filteredDebtors = debtors.filter((d) => {
    if (!matchesSearch(d.cliente_nome) && !matchesSearch(d.cliente_cpf_cnpj) && !matchesSearch(d.cliente_email)) return false;
    if (interval) {
      const has = (d.parcelas || []).some((p) => {
        if (!p.data_vencimento) return false;
        const dt = new Date(p.data_vencimento + "T12:00:00");
        return isWithinInterval(dt, interval);
      });
      if (!has) return false;
    }
    return true;
  });

  const filteredHistory = history.filter((h) => {
    if (!matchesSearch(h.cliente_nome) && !matchesSearch(h.cliente_cpf_cnpj)) return false;
    if (interval) {
      const dt = new Date(h.created_at);
      if (!isWithinInterval(dt, interval)) return false;
    }
    return true;
  });

  const filteredDebtors30 = debtors30.filter((d) => {
    if (!matchesSearch(d.cliente_nome) && !matchesSearch(d.cliente_cpf_cnpj) && !matchesSearch(d.cliente_email)) return false;
    return true;
  });

  const filteredHistory30 = history30.filter((h) => {
    if (!matchesSearch(h.cliente_nome) && !matchesSearch(h.cliente_cpf_cnpj)) return false;
    if (interval) {
      const dt = new Date(h.created_at);
      if (!isWithinInterval(dt, interval)) return false;
    }
    return true;
  });

  const totalDevedores = filteredDebtors.length;
  const totalParcelas = filteredDebtors.reduce((s, d) => s + d.qtd_parcelas, 0);
  const totalOriginal = filteredDebtors.reduce((s, d) => s + d.total_original, 0);
  const totalComAcrescimo = filteredDebtors.reduce((s, d) => s + d.novo_total, 0);

  const totalDevedores30 = filteredDebtors30.length;
  const totalParcelas30 = filteredDebtors30.reduce((s, d) => s + d.qtd_parcelas, 0);
  const totalOriginal30 = filteredDebtors30.reduce((s, d) => s + d.total_original, 0);
  const totalComAcrescimo30 = filteredDebtors30.reduce((s, d) => s + d.novo_total, 0);

  const [activeTab, setActiveTab] = useState<string>("lista");
  const is30Group = activeTab === "devedor" || activeTab === "historico-devedor";

  const openClientFile = async (d: Debtor) => {
    setLoadingClient(d.key);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Sessão expirada.");
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/find-or-create-client-from-asaas`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          asaas_customer_id: d.asaas_customer_id,
          cliente_nome: d.cliente_nome,
          cliente_cpf_cnpj: d.cliente_cpf_cnpj,
          cliente_email: d.cliente_email,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      const p = json.profile;
      const client: ClientWithProcess = {
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        phone: p.phone,
        company_name: p.company_name,
        priority: p.priority,
        origin: p.origin,
        contract_value: p.contract_value,
        process_id: null,
        brand_name: null,
        business_area: null,
        pipeline_stage: null,
        process_status: null,
        cpf_cnpj: p.cpf_cnpj,
        created_by: p.created_by,
        assigned_to: p.assigned_to,
      };
      setOpenClient(client);
      if (json.created) toast.success("Cliente criado automaticamente a partir dos dados do Asaas.");
    } catch (e: any) {
      toast.error(`Falha ao abrir ficheiro do cliente: ${e.message}`);
    } finally {
      setLoadingClient(null);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin/financeiro")} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Financeiro
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <AlertTriangle className={`h-6 w-6 ${is30Group ? "text-orange-500" : "text-red-500"}`} />
              {is30Group ? "Devedor (30 dias)" : "Devedores (60 dias)"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {is30Group
                ? "Cobranças Asaas vencidas em até 30 dias"
                : "Cobranças Asaas com mais de 60 dias de atraso"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchDebtors} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
          <Button size="sm" onClick={handleSync} disabled={syncing} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {syncing ? "Sincronizando..." : "Sincronizar com Asaas"}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {is30Group ? (
          <>
            <SummaryCard icon={<Users className="h-5 w-5" />} label="Devedor (30d)" value={String(totalDevedores30)} tone="orange" />
            <SummaryCard icon={<AlertTriangle className="h-5 w-5" />} label="Parcelas vencidas" value={String(totalParcelas30)} tone="orange" />
            <SummaryCard icon={<DollarSign className="h-5 w-5" />} label="Valor original" value={fmtBRL(totalOriginal30)} tone="orange" />
            <SummaryCard icon={<TrendingUp className="h-5 w-5" />} label="Total +10%" value={fmtBRL(totalComAcrescimo30)} tone="orange" accent />
          </>
        ) : (
          <>
            <SummaryCard icon={<Users className="h-5 w-5" />} label="Devedores (60d)" value={String(totalDevedores)} tone="red" />
            <SummaryCard icon={<AlertTriangle className="h-5 w-5" />} label="Parcelas vencidas" value={String(totalParcelas)} tone="red" />
            <SummaryCard icon={<DollarSign className="h-5 w-5" />} label="Valor original" value={fmtBRL(totalOriginal)} tone="red" />
            <SummaryCard icon={<TrendingUp className="h-5 w-5" />} label="Total +10%" value={fmtBRL(totalComAcrescimo)} tone="red" accent />
          </>
        )}
      </div>

      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, CPF/CNPJ ou e-mail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <DatePeriodFilter
            dateFilter={dateFilter}
            onDateFilterChange={setDateFilter}
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
          />
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger
            value="lista"
            className="data-[state=active]:bg-red-600 data-[state=active]:text-white text-red-600"
          >
            Devedores 60 dias ({totalDevedores})
          </TabsTrigger>
          <TabsTrigger
            value="historico"
            className="data-[state=active]:bg-red-600 data-[state=active]:text-white text-red-600"
          >
            Histórico Devedores ({filteredHistory.length})
          </TabsTrigger>
          <TabsTrigger
            value="devedor"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-orange-600"
          >
            Devedor 30 dias ({totalDevedores30})
          </TabsTrigger>
          <TabsTrigger
            value="historico-devedor"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-orange-600"
          >
            Histórico Devedor ({filteredHistory30.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lista">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>CPF/CNPJ</TableHead>
                    <TableHead className="text-center">Parcelas</TableHead>
                    <TableHead className="text-right">Total devido</TableHead>
                    <TableHead className="text-right">Total + 10%</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDebtors.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        {loading ? "Carregando..." : "Nenhum devedor com mais de 60 dias. Clique em Sincronizar para buscar no Asaas."}
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredDebtors.map((d) => (
                    <TableRow
                      key={d.key}
                      onClick={() => openClientFile(d)}
                      className="cursor-pointer"
                    >
                      <TableCell className="font-medium">
                        <span className="inline-flex items-center gap-2 hover:text-primary hover:underline transition-colors">
                          {loadingClient === d.key && <Loader2 className="h-3 w-3 animate-spin" />}
                          {d.cliente_nome || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{d.cliente_cpf_cnpj || "—"}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="destructive">{d.qtd_parcelas}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{fmtBRL(d.total_original)}</TableCell>
                      <TableCell className="text-right font-semibold text-emerald-600">{fmtBRL(d.novo_total)}</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" onClick={() => setSelected(d)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                          Renegociar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="devedor">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>CPF/CNPJ</TableHead>
                    <TableHead className="text-center">Parcelas</TableHead>
                    <TableHead className="text-right">Total devido</TableHead>
                    <TableHead className="text-right">Total + 10%</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDebtors30.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Nenhum vencido recente. Clique em Sincronizar para buscar no Asaas.
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredDebtors30.map((d) => (
                    <TableRow key={d.key} onClick={() => openClientFile(d)} className="cursor-pointer">
                      <TableCell className="font-medium">
                        <span className="inline-flex items-center gap-2 hover:text-primary hover:underline transition-colors">
                          {loadingClient === d.key && <Loader2 className="h-3 w-3 animate-spin" />}
                          {d.cliente_nome || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{d.cliente_cpf_cnpj || "—"}</TableCell>
                      <TableCell className="text-center"><Badge variant="destructive">{d.qtd_parcelas}</Badge></TableCell>
                      <TableCell className="text-right">{fmtBRL(d.total_original)}</TableCell>
                      <TableCell className="text-right font-semibold text-emerald-600">{fmtBRL(d.novo_total)}</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex gap-2">
                          <Button size="sm" onClick={() => setSelectedNeg(d)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                            Negociar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setSelectedCob(d)}>
                            Cobrar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Original</TableHead>
                    <TableHead className="text-right">Acréscimo</TableHead>
                    <TableHead className="text-right">Renegociado</TableHead>
                    <TableHead className="text-center">Parcelas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistory.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma renegociação ainda.</TableCell></TableRow>
                  )}
                  {filteredHistory.map((h) => (
                    <TableRow
                      key={h.id}
                      onClick={() => openClientFile({
                        key: h.id,
                        cliente_nome: h.cliente_nome,
                        cliente_cpf_cnpj: h.cliente_cpf_cnpj,
                        cliente_email: null,
                        asaas_customer_id: "",
                        parcelas: [],
                        qtd_parcelas: 0,
                        total_original: 0,
                        acrescimo: 0,
                        novo_total: 0,
                        valor_parcela: 0,
                        datas_parcelas: [],
                      } as Debtor)}
                      className="cursor-pointer"
                    >
                      <TableCell className="text-sm">{new Date(h.created_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-2 hover:text-primary hover:underline transition-colors">
                          {loadingClient === h.id && <Loader2 className="h-3 w-3 animate-spin" />}
                          {h.cliente_nome || h.cliente_cpf_cnpj || "—"}
                        </span>
                        <span className="inline-flex items-center gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2"
                            onClick={(e) => { e.stopPropagation(); handleResendNotification(h, 'email'); }}
                            disabled={resending === `${h.id}-email`}
                            title="Reenviar e-mail"
                          >
                            {resending === `${h.id}-email` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2"
                            onClick={(e) => { e.stopPropagation(); handleResendNotification(h, 'whatsapp'); }}
                            disabled={resending === `${h.id}-whatsapp`}
                            title="Reenviar WhatsApp"
                          >
                            {resending === `${h.id}-whatsapp` ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageCircle className="h-3 w-3" />}
                          </Button>
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{fmtBRL(h.valor_original_total)}</TableCell>
                      <TableCell className="text-right text-amber-600">{fmtBRL(h.valor_acrescimo)}</TableCell>
                      <TableCell className="text-right font-semibold">{fmtBRL(h.valor_renegociado)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{h.parcelas_renegociadas?.length || 0}/5</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico-devedor">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Original</TableHead>
                    <TableHead className="text-right">Acréscimo</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-center">Parcelas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistory30.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma negociação ainda.</TableCell></TableRow>
                  )}
                  {filteredHistory30.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="text-sm">{new Date(h.created_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>
                        <span>{h.cliente_nome || h.cliente_cpf_cnpj || "—"}</span>
                        <span className="inline-flex items-center gap-1 ml-2">
                          <Button size="sm" variant="outline" className="h-6 px-2"
                            onClick={() => handleResendDevedor(h, 'email')}
                            disabled={resending === `${h.id}-email`} title="Reenviar e-mail">
                            {resending === `${h.id}-email` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
                          </Button>
                          <Button size="sm" variant="outline" className="h-6 px-2"
                            onClick={() => handleResendDevedor(h, 'whatsapp')}
                            disabled={resending === `${h.id}-whatsapp`} title="Reenviar WhatsApp">
                            {resending === `${h.id}-whatsapp` ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageCircle className="h-3 w-3" />}
                          </Button>
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={h.tipo === 'negociar' ? 'default' : 'outline'}>
                          {h.tipo === 'negociar' ? 'Negociar 3x' : 'Cobrar único'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{fmtBRL(h.valor_original_total)}</TableCell>
                      <TableCell className="text-right text-amber-600">{fmtBRL(h.valor_acrescimo)}</TableCell>
                      <TableCell className="text-right font-semibold">{fmtBRL(h.valor_total)}</TableCell>
                      <TableCell className="text-center"><Badge variant="outline">{h.parcelas_devedor?.length || 0}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Renegociar — {selected?.cliente_nome}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Parcelas vencidas agrupadas</CardTitle></CardHeader>
                <CardContent className="space-y-1 text-sm">
                  {selected.parcelas.map((p) => (
                    <div key={p.id} className="flex justify-between border-b border-border/50 py-1">
                      <span>Venc. {fmtDate(p.data_vencimento)} <span className="text-muted-foreground">({p.dias_atraso}d atraso)</span></span>
                      <span className="font-medium">{fmtBRL(Number(p.valor))}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Total original</div>
                  <div className="font-semibold">{fmtBRL(selected.total_original)}</div>
                </div>
                <div className="rounded-lg border p-3 bg-amber-500/5">
                  <div className="text-xs text-muted-foreground">+ 10%</div>
                  <div className="font-semibold text-amber-600">{fmtBRL(selected.acrescimo)}</div>
                </div>
                <div className="rounded-lg border p-3 bg-emerald-500/5">
                  <div className="text-xs text-muted-foreground">Novo total</div>
                  <div className="font-bold text-emerald-600">{fmtBRL(selected.novo_total)}</div>
                </div>
              </div>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">5 boletos serão gerados — vencimento sempre dia 20</CardTitle></CardHeader>
                <CardContent className="space-y-1 text-sm">
                  {selected.datas_parcelas.map((d, i) => (
                    <div key={i} className="flex justify-between border-b border-border/50 py-1">
                      <span>Parcela {i + 1}/5 — venc. {fmtDate(d)}</span>
                      <span className="font-medium">{fmtBRL(selected.valor_parcela)}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <div>
                <label className="text-sm font-medium">Observação (opcional, será incluída no motivo)</label>
                <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={3} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)} disabled={renegLoading}>Cancelar</Button>
            <Button onClick={handleRenegotiate} disabled={renegLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              {renegLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar renegociação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Negociar 3x +10% */}
      <Dialog open={!!selectedNeg} onOpenChange={(o) => !o && setSelectedNeg(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Negociar — {selectedNeg?.cliente_nome}</DialogTitle></DialogHeader>
          {selectedNeg && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Total original</div>
                  <div className="font-semibold">{fmtBRL(selectedNeg.total_original)}</div>
                </div>
                <div className="rounded-lg border p-3 bg-amber-500/5">
                  <div className="text-xs text-muted-foreground">+ 10%</div>
                  <div className="font-semibold text-amber-600">{fmtBRL(selectedNeg.acrescimo)}</div>
                </div>
                <div className="rounded-lg border p-3 bg-emerald-500/5">
                  <div className="text-xs text-muted-foreground">Novo total</div>
                  <div className="font-bold text-emerald-600">{fmtBRL(selectedNeg.novo_total)}</div>
                </div>
              </div>
              <p className="text-muted-foreground">3 boletos serão gerados (vencimento dia 20). Cliente será notificado por e-mail e WhatsApp.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedNeg(null)} disabled={actionLoading}>Cancelar</Button>
            <Button onClick={() => handleNegociarOrCobrar('negociar')} disabled={actionLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar negociação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Cobrar (boleto único, sem taxa) */}
      <Dialog open={!!selectedCob} onOpenChange={(o) => !o && setSelectedCob(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Cobrar — {selectedCob?.cliente_nome}</DialogTitle></DialogHeader>
          {selectedCob && (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border p-3 text-center bg-emerald-500/5">
                <div className="text-xs text-muted-foreground">Total (sem acréscimo)</div>
                <div className="font-bold text-emerald-600 text-lg">{fmtBRL(selectedCob.total_original)}</div>
              </div>
              <p className="text-muted-foreground">1 boleto único será gerado (vencimento dia 20). Cliente será notificado por e-mail e WhatsApp.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedCob(null)} disabled={actionLoading}>Cancelar</Button>
            <Button onClick={() => handleNegociarOrCobrar('cobrar')} disabled={actionLoading} className="gap-2">
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar cobrança
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {openClient && (
        <Suspense fallback={null}>
          <ClientDetailSheet
            client={openClient}
            open={!!openClient}
            onOpenChange={(o) => !o && setOpenClient(null)}
            onUpdate={() => { fetchDebtors(); }}
          />
        </Suspense>
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <Card className={accent ? "border-emerald-500/30" : ""}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg ${accent ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>{icon}</div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="font-bold text-lg">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}