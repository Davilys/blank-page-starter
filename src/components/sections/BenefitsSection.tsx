import { Clock, Headphones, FileSignature, Wallet, ChevronRight } from "lucide-react";
import ScribbleUnderline from "@/components/decorative/ScribbleUnderline";
import certificateImg from "@/assets/certificate-inpi.png";

const benefits = [
  {
    icon: Clock,
    title: "Protocolo em até 48h",
    description: "Seu pedido entra no INPI em até 48h após a contratação.",
  },
  {
    icon: Headphones,
    title: "Acompanhamento humano",
    description: "Um especialista real cuida do seu processo — nada de robô sumindo no meio.",
  },
  {
    icon: FileSignature,
    title: "Contrato digital",
    description: "Você assina online, em minutos, sem precisar imprimir ou reconhecer firma.",
  },
  {
    icon: Wallet,
    title: "Pagamento flexível",
    description: "À vista no PIX ou parcelado no cartão — condições adaptadas ao seu momento.",
  },
];

const BenefitsSection = () => {
  return (
    <section
      id="beneficios"
      className="relative overflow-hidden bg-background py-20 md:py-28"
    >
      {/* soft ambient glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />

      <div className="container relative z-10 mx-auto px-4">
        {/* Header */}
        <div className="mx-auto mb-14 max-w-3xl text-center md:mb-20">
          <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.22em] text-[hsl(var(--brand-orange))]">
            Por que a WebMarcas
          </p>
          <h2 className="font-display text-4xl font-black leading-[1.05] tracking-[-0.02em] text-foreground sm:text-5xl md:text-6xl">
            Cuidado{" "}
            <span className="relative inline-block whitespace-nowrap">
              de fim a fim,
              <ScribbleUnderline />
            </span>
            <br />
            sem pegadinhas.
          </h2>
        </div>

        {/* Content grid */}
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
          {/* Certificate illustration */}
          <div className="relative mx-auto w-full max-w-[520px]">
            <div className="pointer-events-none absolute -inset-6 rounded-[3rem] bg-gradient-to-br from-primary/10 via-transparent to-[hsl(var(--brand-orange))]/10 blur-2xl" />
            <img
              src={certificateImg}
              alt="Certificado de registro de marca no INPI"
              width={1024}
              height={1024}
              loading="lazy"
              className="relative w-full drop-shadow-[0_30px_60px_rgba(15,40,90,0.18)]"
            />
          </div>

          {/* Benefit list */}
          <ul className="flex flex-col gap-4">
            {benefits.map((b) => (
              <li
                key={b.title}
                className="group flex cursor-default items-start gap-5 rounded-2xl border border-border/60 bg-card p-5 shadow-[0_4px_20px_-8px_rgba(15,40,90,0.08)] transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_18px_40px_-18px_rgba(15,40,90,0.25)] md:p-6"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
                  <b.icon className="h-5 w-5" strokeWidth={2.2} />
                </div>
                <div className="flex-1">
                  <h3 className="font-display text-lg font-bold text-foreground md:text-xl">
                    {b.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground md:text-base">
                    {b.description}
                  </p>
                </div>
                <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-1 group-hover:text-primary" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

export default BenefitsSection;
