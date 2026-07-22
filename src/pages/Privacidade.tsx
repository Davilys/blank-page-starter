import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Shield, FileText, Scale, UserCheck, Building2, Check, Zap, Lock } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Seal48h from "@/components/decorative/Seal48h";

const Privacidade = () => {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const lastUpdate = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const dadosColetados = [
    "Nome",
    "WhatsApp",
    "E-mail",
    'Resposta ao campo de qualificação ("já tem marca registrada?")',
  ];

  return (
    <div className="brand-public min-h-screen bg-[hsl(220_33%_98%)]">
      <Helmet>
        <title>Política de Privacidade | WebMarcas</title>
        <meta name="description" content="Política de Privacidade da WebMarcas Intelligence PI: dados coletados no formulário do site, finalidade, base legal (LGPD) e direitos do titular." />
        <link rel="canonical" href="https://webmarcas.net/privacidade" />
        <meta name="robots" content="index, follow" />
      </Helmet>
      <Header />

      {/* Hero azul */}
      <section className="relative hero-blue-bg pt-28 pb-20 md:pt-36 md:pb-28 overflow-hidden">
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[hsl(20_100%_55%)] to-[hsl(14_100%_48%)] px-5 py-2.5 text-white shadow-[0_10px_24px_-8px_hsla(20,100%,45%,0.55)] mb-6">
              <Zap className="w-4 h-4 fill-white" />
              <span className="text-[11px] md:text-xs font-black uppercase tracking-[0.18em]">
                Última atualização: {lastUpdate}
              </span>
            </div>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-black leading-tight tracking-tight text-white mb-4">
              Política de Privacidade
            </h1>
            <p className="text-base md:text-lg text-white/85 max-w-2xl mx-auto">
              Como a WebMarcas Intelligence PI coleta, utiliza e protege seus dados pessoais em conformidade com a LGPD.
            </p>
          </div>
        </div>
      </section>

      {/* Conteúdo em cards */}
      <main className="container mx-auto px-4 -mt-12 md:-mt-16 pb-20 relative z-20">
        <div className="max-w-3xl mx-auto space-y-6 md:space-y-8">
          <Card icon={FileText} title="1. Dados coletados">
            <p className="mb-4">Coletamos, através do formulário de contato disponível neste site, os seguintes dados fornecidos voluntariamente pelo titular:</p>
            <ul className="space-y-3">
              {dadosColetados.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 w-6 h-6 rounded-full bg-[hsl(20_100%_55%)]/15 text-[hsl(20_100%_45%)] flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5" strokeWidth={3} />
                  </span>
                  <span className="text-foreground/85">{item}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card icon={Shield} title="2. Finalidade">
            <p>Os dados são utilizados exclusivamente para contato comercial via WhatsApp sobre o serviço de registro de marca solicitado. Não há compartilhamento com terceiros para fins de marketing.</p>
          </Card>

          <Card icon={Scale} title="3. Base legal e conformidade">
            <p>O tratamento dos dados pessoais é realizado em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018), com base no consentimento do titular e na execução de procedimentos preliminares relacionados a contrato do qual o titular é parte interessada.</p>
          </Card>

          <Card icon={UserCheck} title="4. Direitos do titular">
            <p>O titular pode, a qualquer tempo, solicitar acesso, correção ou exclusão dos seus dados pessoais. As solicitações devem ser enviadas para o e-mail de contato indicado no rodapé deste site.</p>
          </Card>

          <Card icon={Building2} title="5. Identificação do controlador">
            <p className="mb-4">O controlador dos dados pessoais é:</p>
            <dl className="grid grid-cols-1 sm:grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-foreground/85">
              <dt className="font-bold text-foreground">Razão social</dt><dd>WebMarcas Intelligence PI</dd>
              <dt className="font-bold text-foreground">CNPJ</dt><dd>39.528.012/0001-29</dd>
              <dt className="font-bold text-foreground">Endereço</dt><dd>Av. Brigadeiro Luís Antônio, 2696 — Jardim Paulista, São Paulo/SP — CEP 01402-000</dd>
              <dt className="font-bold text-foreground">E-mail</dt><dd>ola@webmarcas.net</dd>
              <dt className="font-bold text-foreground">Telefone</dt><dd>(11) 91112-0225</dd>
            </dl>
          </Card>

          <p className="text-sm text-muted-foreground text-center pt-4">Data de última atualização: {lastUpdate}.</p>
        </div>

        <div className="mt-16 md:mt-20 flex flex-col items-center gap-4">
          <Seal48h size={140} mainText="LGPD" subText="DADOS PROTEGIDOS" />
          <p className="text-sm font-semibold text-foreground/70 tracking-wide uppercase flex items-center gap-2">
            <Lock className="w-4 h-4 text-[hsl(222_92%_54%)]" />
            Conformidade LGPD · Lei nº 13.709/2018
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
};

interface CardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}

const Card = ({ icon: Icon, title, children }: CardProps) => (
  <section className="bg-white rounded-2xl border border-border/60 shadow-[0_10px_30px_-15px_hsla(222,60%,20%,0.15)] p-6 md:p-8">
    <div className="flex items-center gap-4 mb-4">
      <span className="w-12 h-12 rounded-full bg-gradient-to-br from-[hsl(20_100%_55%)] to-[hsl(14_100%_48%)] text-white flex items-center justify-center shadow-[0_8px_20px_-8px_hsla(20,100%,45%,0.6)] shrink-0">
        <Icon className="w-5 h-5" />
      </span>
      <h2 className="font-display text-xl md:text-2xl font-black text-foreground leading-tight">{title}</h2>
    </div>
    <div className="text-foreground/85 leading-relaxed space-y-3">
      {children}
    </div>
  </section>
);

export default Privacidade;