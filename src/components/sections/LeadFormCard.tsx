import { useState } from "react";
import { Sparkles, ArrowRight, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const LeadFormCard = () => {
  const [form, setForm] = useState({ marca: "", nome: "", whatsapp: "", email: "" });
  const [accept, setAccept] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleChange = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.marca || !form.nome || !form.whatsapp || !form.email) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    if (!accept) {
      toast({ title: "Aceite a política de privacidade", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await supabase.from("leads").insert({
        nome: form.nome,
        whatsapp: form.whatsapp,
        email: form.email,
        nome_marca: form.marca,
        origem: "hero_form",
        status: "novo",
      } as any);
      toast({ title: "Enviado!", description: "Um especialista entrará em contato em instantes." });
      setForm({ marca: "", nome: "", whatsapp: "", email: "" });
      setAccept(false);
    } catch (err) {
      toast({ title: "Erro ao enviar", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="text-center mb-5">
        <span className="badge-consulta">
          <Sparkles className="w-3.5 h-3.5" /> Consulta gratuita
        </span>
      </div>
      <h3 className="text-center text-[1.65rem] md:text-[1.9rem] font-black text-foreground leading-tight mb-6">
        Registre sua marca em<br />
        <span className="text-primary">poucos passos</span>
      </h3>

      <div className="space-y-4">
        <div>
          <label className="form-label-caps">Nome da marca</label>
          <input className="form-pill-input" placeholder="Como sua marca se chama?" value={form.marca} onChange={handleChange("marca")} />
        </div>
        <div>
          <label className="form-label-caps">Seu nome</label>
          <input className="form-pill-input" placeholder="Nome completo" value={form.nome} onChange={handleChange("nome")} />
        </div>
        <div>
          <label className="form-label-caps">WhatsApp com DDD</label>
          <input className="form-pill-input" placeholder="(11) 99999-9999" value={form.whatsapp} onChange={handleChange("whatsapp")} />
        </div>
        <div>
          <label className="form-label-caps">E-mail</label>
          <input type="email" className="form-pill-input" placeholder="seu@email.com" value={form.email} onChange={handleChange("email")} />
        </div>

        <label className="flex items-start gap-2.5 text-sm text-muted-foreground cursor-pointer select-none">
          <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="mt-1 w-4 h-4 accent-primary" />
          <span>
            Concordo com a{" "}
            <a href="/politica-privacidade" className="text-primary font-semibold underline underline-offset-2">Política de Privacidade</a>{" "}
            e aceito receber comunicações via WhatsApp.
          </span>
        </label>

        <button type="submit" disabled={submitting} className="btn-cta-solid">
          {submitting ? "Enviando..." : "Falar com especialista"} <ArrowRight className="w-4 h-4" />
        </button>

        <div className="flex items-center justify-center gap-2 pt-1 text-xs text-muted-foreground">
          <Lock className="w-3.5 h-3.5 text-emerald-600" />
          <span className="font-semibold text-foreground">100% Seguro</span>
          <span>·</span>
          <a href="/politica-privacidade" className="underline underline-offset-2">Política de privacidade</a>
        </div>
      </div>
    </form>
  );
};

export default LeadFormCard;