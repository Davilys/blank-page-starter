import { motion } from "framer-motion";
import { AnimatedCounter } from "@/components/admin/dashboard/AnimatedCounter";

const items = [
  { value: 11000, suffix: "+", label: "Marcas registradas" },
  { value: 2430, suffix: "+", label: "Cidades" },
  { value: 26, suffix: "+", label: "Estados" },
];

const StatsBandSection = () => {
  return (
    <section className="relative bg-[hsl(226_60%_10%)] py-16 md:py-24 overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
        aria-hidden="true"
      />
      <div className="container mx-auto max-w-6xl px-4 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/10">
          {items.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="px-6 py-8 md:py-4 text-center md:text-left"
            >
              <div
                className="font-display font-black leading-none text-[hsl(222_92%_60%)]"
                style={{ fontSize: "clamp(3.5rem, 8vw, 6rem)", letterSpacing: "-0.04em" }}
              >
                <AnimatedCounter value={s.value} suffix={s.suffix} duration={2.5} />
              </div>
              <div className="mt-4 font-display font-bold text-white text-xl md:text-2xl">
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
