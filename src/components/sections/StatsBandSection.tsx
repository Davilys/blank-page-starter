import { motion } from "framer-motion";
import { BarChart3 } from "lucide-react";

const items = [
  { value: "+11.000", label: "marcas registradas" },
  { value: "+15", label: "anos de experiência" },
  { value: "98%", label: "de taxa de sucesso" },
  { value: "48h", label: "para o protocolo no INPI" },
];

const StatsBandSection = () => {
  return (
    <section className="relative bg-background py-20 md:py-28">
      <div className="container mx-auto max-w-6xl px-4">
        {/* Badge + heading */}
        <div className="text-center mb-14 md:mb-20">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-4 py-1.5 text-primary mb-5">
            <BarChart3 className="w-3.5 h-3.5" strokeWidth={2.5} />
            <span className="text-[11px] font-black uppercase tracking-[0.22em]">Nossos Números</span>
          </div>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-black text-foreground leading-tight">
            Uma trajetória construída
            <br />
            em <span className="text-primary italic">confiança</span>
          </h2>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-10 md:gap-6">
          {items.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="text-center md:text-left"
            >
              <div
                className="font-display font-black leading-none text-primary"
                style={{ fontSize: "clamp(3rem, 6vw, 5rem)", letterSpacing: "-0.03em" }}
              >
                {s.value}
              </div>
              {/* Orange underline */}
              <div className="h-[3px] w-14 bg-[hsl(20_100%_55%)] rounded-full my-4 mx-auto md:mx-0" />
              <div className="font-body text-base md:text-lg text-muted-foreground">
                {s.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsBandSection;
