import { ArrowRight, MessageCircle, Zap } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const CTASection = () => {
  const { t } = useLanguage();

  return (
    <section className="relative py-12 md:py-20 px-4">
      <div className="mx-auto max-w-6xl rounded-[2rem] md:rounded-[2.5rem] hero-blue-bg relative overflow-hidden px-6 py-14 md:px-16 md:py-20 text-center">
        {/* soft dotted texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)",
            backgroundSize: "30px 30px",
          }}
          aria-hidden="true"
        />
        <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-[hsl(20_100%_55%_/_0.25)] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />

        <div className="relative z-10">
          {/* Orange badge */}
          <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[hsl(20_100%_55%)] to-[hsl(14_100%_48%)] px-5 py-2.5 text-white shadow-[0_10px_24px_-8px_hsla(20,100%,45%,0.6)] mb-8">
            <Zap className="w-4 h-4 fill-white" />
            <span className="text-xs font-black uppercase tracking-[0.18em]">Última chamada</span>
          </div>

          {/* Heading */}
          <h2
            className="font-display font-black leading-[1.05] tracking-[-0.03em] text-4xl md:text-6xl lg:text-7xl max-w-4xl mx-auto"
            style={{ color: "#ffffff" }}
          >
            {t("cta.title")}{" "}
            <span style={{ color: "#ffffff" }}>{t("cta.titleHighlight")}</span>
          </h2>

          <p className="mt-6 text-white/85 text-base md:text-lg max-w-2xl mx-auto">
            {t("cta.subtitle")}
          </p>

          {/* Investment box */}
          <div className="mt-10 mx-auto max-w-2xl rounded-3xl border border-white/25 bg-white/10 backdrop-blur px-6 py-8 md:px-10 md:py-10">
            <div className="text-[hsl(20_100%_65%)] text-xs md:text-sm font-black uppercase tracking-[0.28em]">
              Investimento
            </div>
            <div className="mt-3 font-display font-black text-white leading-none tracking-[-0.03em] text-[2.5rem] md:text-[4rem]">
              A partir de <span className="whitespace-nowrap">R$ 699</span>
            </div>
            <div className="mt-3 text-sm text-white/80">à vista no PIX (ou parcelado no cartão)</div>
          </div>

          <p className="mt-5 text-white/85 text-xs md:text-sm max-w-2xl mx-auto leading-relaxed">
            * Valor referente aos honorários. Taxas oficiais do INPI não incluídas,
            pagas à parte pelo cliente diretamente ao órgão.
          </p>

          <div className="mt-6 mx-auto max-w-3xl rounded-2xl border border-white/20 bg-white/5 backdrop-blur px-5 py-4 text-left">
            <p className="text-white/90 text-xs md:text-sm leading-relaxed">
              <span className="font-bold text-white">Garantia WebMarcas:</span> Se, por qualquer motivo, o processo de registro da marca for definitivamente arquivado pelo INPI, a WebMarcas realizará um novo pedido de registro de outra marca, sem cobrar novos honorários pelo serviço.
              {" "}O cliente será responsável apenas pelo pagamento das novas taxas oficiais do INPI, quando exigidas pela legislação vigente.
              {" "}Essa garantia refere-se exclusivamente aos honorários da WebMarcas e demonstra nosso compromisso em acompanhar o cliente até uma nova tentativa de registro, sem custo adicional de honorários.
            </p>
          </div>

          {/* CTAs */}
          <div className="mt-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
            <a
              href="#consultar"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-white text-[hsl(226_95%_28%)] font-black uppercase tracking-wide text-sm px-8 py-4 shadow-[0_18px_38px_-14px_rgba(0,0,0,0.4)] hover:-translate-y-0.5 transition"
            >
              {t("cta.button1")}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition" />
            </a>
            <a
              href="https://wa.me/5511911120225?text=Olá! Gostaria de falar com um especialista sobre registro de marca."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-white/50 bg-white/10 backdrop-blur text-white font-black uppercase tracking-wide text-sm px-8 py-4 hover:bg-white/20 transition"
            >
              <MessageCircle className="w-4 h-4" />
              {t("cta.button2")}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
