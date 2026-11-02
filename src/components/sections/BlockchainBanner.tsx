import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Shield } from "lucide-react";
import blockchain3d from "@/assets/blockchain-3d.webp";

const BlockchainBanner = () => {
  return (
    <section className="py-12 md:py-16">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="blockchain-banner-3d relative overflow-hidden rounded-[2rem] px-6 pb-8 pt-0 md:px-12 md:pb-12 text-center"
        >
          <img
            src={blockchain3d}
            alt="Documento 3D protegido por blockchain com cubos e anéis dourados"
            className="mx-auto -mt-2 w-full max-w-[420px] md:max-w-[520px] rounded-b-[1.5rem]"
            loading="lazy"
            decoding="async"
          />
          <div className="relative z-10 mt-6 md:mt-8">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-[#06cb66]" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#06cb66]">Novo Serviço</span>
            </div>
            <h3 className="font-display text-2xl md:text-3xl font-black tracking-tight text-white mb-3">
              Registro de Documentos em <span className="text-[#2ee57f]">Blockchain</span>
            </h3>
            <p className="text-white/70 text-sm md:text-base max-w-lg mx-auto">
              Garanta a autenticidade dos seus documentos com registro imutável na rede Bitcoin.{" "}
              <span className="font-semibold text-[#2ee57f]">1º registro grátis!</span>
            </p>
            <Link
              to="/registro-blockchain"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-[#0bd36c] to-[#05a352] px-8 py-3.5 font-bold text-[#062d1b] shadow-[0_10px_20px_-6px_rgba(5,163,82,.5)] transition-transform hover:scale-[1.02]"
            >
              Saiba Mais
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default BlockchainBanner;
