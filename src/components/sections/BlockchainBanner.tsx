import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Blocks, ArrowRight, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

const BlockchainBanner = () => {
  return (
    <section className="py-12 md:py-16">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border border-primary/20 p-8 md:p-12"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 md:gap-10">
            <div className="flex-shrink-0">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-primary/15 flex items-center justify-center">
                <Blocks className="w-8 h-8 md:w-10 md:h-10 text-primary" />
              </div>
            </div>

            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                <Shield className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">Novo Serviço</span>
              </div>
              <h3 className="font-display text-xl md:text-2xl font-bold mb-2">
                Registro de Documentos em Blockchain
              </h3>
              <p className="text-muted-foreground text-sm md:text-base max-w-lg">
                Garanta a autenticidade dos seus documentos com registro imutável na rede Bitcoin.{" "}
                <span className="font-semibold text-foreground">1º registro grátis!</span>
              </p>
            </div>

            <div className="flex-shrink-0">
              <Link to="/registro-blockchain">
                <Button size="lg" className="gap-2 whitespace-nowrap">
                  Saiba Mais
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default BlockchainBanner;
