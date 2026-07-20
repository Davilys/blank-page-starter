import { Clock, Headphones, FileSignature, Wallet, ChevronRight, CheckCircle2, QrCode } from "lucide-react";
import ScribbleUnderline from "@/components/decorative/ScribbleUnderline";
import Seal48h from "@/components/decorative/Seal48h";

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
      className="relative overflow-hidden bg-gradient-to-b from-[#f6f8fc] via-background to-background py-20 md:py-28"
    >
      {/* ambient glows */}
      <div className="pointer-events-none absolute -top-40 left-1/3 h-[520px] w-[720px] -translate-x-1/2 rounded-full bg-primary/8 blur-3xl" />
      <div className="pointer-events-none absolute top-1/2 right-0 h-[420px] w-[520px] rounded-full bg-[hsl(var(--brand-orange))]/8 blur-3xl" />

      <div className="container relative z-10 mx-auto px-4">
        {/* Header */}
        <div className="mx-auto mb-12 max-w-3xl text-center md:mb-16">
          <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.22em] text-[hsl(var(--brand-orange))]">
            Por que a WebMarcas
          </p>
          <h2 className="font-display text-3xl font-black leading-[1.08] tracking-[-0.02em] text-foreground sm:text-4xl md:text-5xl">
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
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
          {/* Stylized certificate card */}
          <div className="relative mx-auto w-full max-w-[560px]">
            {/* ambient */}
            <div className="pointer-events-none absolute -inset-8 rounded-[3rem] bg-gradient-to-br from-primary/10 via-transparent to-[hsl(var(--brand-orange))]/10 blur-2xl" />

            <div
              className="relative rounded-[1.75rem] bg-white p-7 shadow-[0_40px_80px_-30px_rgba(11,22,60,0.35)] ring-1 ring-black/5 md:p-8"
              style={{ transform: "rotate(-2.2deg)" }}
            >
              {/* header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-black">W</div>
                  <div className="leading-tight">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">WebMarcas · INPI</p>
                    <p className="text-[10px] text-muted-foreground">Processo Nº 925.678.432</p>
                  </div>
                </div>
                <span className="rounded-full bg-[hsl(var(--brand-orange))]/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[hsl(var(--brand-orange))]">
                  Marca registrada
                </span>
              </div>

              {/* title */}
              <div className="mt-6">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Certificado de Registro
                </p>
                <h3 className="mt-1 font-display text-2xl font-black tracking-tight text-foreground md:text-[26px]">
                  VITALUX Comércio LTDA.
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">Classe 25 · Vestuário e calçados</p>
              </div>

              {/* progress */}
              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-foreground/70">
                  <span>Andamento no INPI</span>
                  <span className="text-primary">100%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-primary/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-500"
                    style={{ width: "100%" }}
                  />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] font-medium text-muted-foreground">
                  <span>Protocolado</span>
                  <span className="text-center">Publicado</span>
                  <span className="text-right text-emerald-600">Concedido</span>
                </div>
              </div>

              {/* footer */}
              <div className="mt-6 flex items-end justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span className="text-xs font-semibold text-foreground">Vigência 10 anos</span>
                  </div>
                  <div className="flex h-9 w-24 items-center justify-center rounded-md border-2 border-emerald-500/60 bg-emerald-50 text-[11px] font-black uppercase tracking-widest text-emerald-600">
                    Aprovado
                  </div>
                  <p className="pt-1 font-[cursive] text-lg text-primary/80">Diretor de Marcas</p>
                </div>
                <div className="flex h-16 w-16 items-center justify-center rounded-md bg-foreground/90 text-background">
                  <QrCode className="h-10 w-10" strokeWidth={1.5} />
                </div>
              </div>
            </div>

            {/* 48h seal overlay */}
            <Seal48h
              size={140}
              mainText="10"
              subText="ANOS"
              className="absolute -top-16 -right-4 z-10 sm:-top-20 sm:-right-6 md:-top-24 md:w-[160px] md:h-[160px]"
            />
          </div>

          {/* Benefit list */}
          <ul className="flex flex-col gap-3.5">
            {benefits.map((b, i) => {
              const active = i === 0;
              return (
                <li
                  key={b.title}
                  className={`group flex cursor-default items-center gap-4 rounded-2xl border bg-card px-5 py-4 transition-all hover:-translate-y-0.5 md:gap-5 md:px-6 md:py-5 ${
                    active
                      ? "border-primary/25 shadow-[0_18px_40px_-18px_rgba(0,95,230,0.35)] ring-1 ring-primary/10"
                      : "border-border/60 shadow-[0_4px_20px_-8px_rgba(15,40,90,0.08)] hover:border-primary/25 hover:shadow-[0_18px_40px_-18px_rgba(15,40,90,0.2)]"
                  }`}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20 md:h-12 md:w-12">
                    <b.icon className="h-5 w-5" strokeWidth={2.2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display text-base font-bold leading-tight text-foreground md:text-[17px]">
                      {b.title}
                    </h3>
                    <p className="mt-1 text-[13px] leading-snug text-muted-foreground md:text-sm">
                      {b.description}
                    </p>
                  </div>
                  <ChevronRight
                    className={`h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1 ${
                      active ? "text-primary" : "text-muted-foreground/50 group-hover:text-primary"
                    }`}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
};

export default BenefitsSection;
