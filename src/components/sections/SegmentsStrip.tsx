import { ShoppingBag, Rocket, Scale, Factory, Sparkles, Utensils, GraduationCap, Stethoscope } from "lucide-react";

const segments = [
  { icon: ShoppingBag, label: "Varejo" },
  { icon: Rocket, label: "Startups & Tech" },
  { icon: Scale, label: "Escritórios & Advocacia" },
  { icon: Factory, label: "Indústria & Serviços" },
  { icon: Sparkles, label: "Moda & Beleza" },
  { icon: Utensils, label: "Alimentação" },
  { icon: GraduationCap, label: "Educação" },
  { icon: Stethoscope, label: "Saúde & Bem-estar" },
];

const SegmentsStrip = () => {
  const row = [...segments, ...segments];
  return (
    <section className="bg-background py-10 md:py-14 border-b border-border/50">
      <div className="container mx-auto max-w-6xl px-4 text-center mb-6">
        <p className="font-display text-[11px] md:text-xs font-black uppercase tracking-[0.28em] text-muted-foreground">
          Confiam na WebMarcas em todos os segmentos
        </p>
      </div>
      <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
        <div className="flex gap-10 md:gap-14 animate-scroll-left whitespace-nowrap">
          {row.map((s, i) => (
            <div key={i} className="flex items-center gap-3 shrink-0">
              <span className="inline-flex w-9 h-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <s.icon className="w-5 h-5" strokeWidth={2.2} />
              </span>
              <span className="font-display font-black uppercase tracking-wider text-sm md:text-base text-foreground">
                {s.label}
              </span>
              <span className="text-primary/50 text-xl">•</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SegmentsStrip;