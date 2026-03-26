import absMoto from "@/assets/clients/abs-moto.png";
import acaoCupido from "@/assets/clients/acao-cupido.png";
import velocross from "@/assets/clients/velocross.png";
import velocrossMoto from "@/assets/clients/velocross-moto.png";
import elenco from "@/assets/clients/elenco.png";
import turboEdition from "@/assets/clients/turbo-edition.png";
import agroPet from "@/assets/clients/agro-pet.png";
import chamelCar from "@/assets/clients/chamel-car.png";
import ajeumOya from "@/assets/clients/ajeum-oya.png";
import rox from "@/assets/clients/rox.png";
import derc from "@/assets/clients/derc.png";
import equilibrio from "@/assets/clients/equilibrio.png";
import fiveFit from "@/assets/clients/5fit.png";
import ecoBioma from "@/assets/clients/eco-bioma.png";
import msSolar from "@/assets/clients/ms-solar.png";
import penseVerde from "@/assets/clients/pense-verde.png";
import duChef from "@/assets/clients/du-chef.png";
import danadoDeBom from "@/assets/clients/danado-de-bom.png";

const row1Logos = [
  { src: absMoto, alt: "ABS Moto Peças" },
  { src: acaoCupido, alt: "Ação Cupido" },
  { src: velocross, alt: "Velocross" },
  { src: elenco, alt: "Elenco" },
  { src: turboEdition, alt: "Turbo Edition" },
  { src: agroPet, alt: "Agro Pet Valente" },
  { src: ajeumOya, alt: "Ajeum de Oyá" },
  { src: derc, alt: "DERC" },
  { src: ecoBioma, alt: "Eco Bioma" },
];

const row2Logos = [
  { src: chamelCar, alt: "Chamel Car" },
  { src: velocrossMoto, alt: "Velocross Moto" },
  { src: rox, alt: "ROX" },
  { src: equilibrio, alt: "Equilíbrio" },
  { src: fiveFit, alt: "5fit" },
  { src: msSolar, alt: "MS Solar Clean" },
  { src: penseVerde, alt: "Pense Verde" },
  { src: duChef, alt: "Du Chef" },
  { src: danadoDeBom, alt: "Danado de Bom" },
];

const LogoCard = ({ src, alt }: { src: string; alt: string }) => (
  <div className="flex-shrink-0 w-[140px] h-[100px] md:w-[200px] md:h-[130px] rounded-2xl bg-card border border-border/50 flex items-center justify-center p-4 md:p-6">
    <img
      src={src}
      alt={alt}
      className="max-w-full max-h-full object-contain grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all duration-500"
      loading="lazy"
    />
  </div>
);

const ClientLogosSection = ({ embedded }: { embedded?: boolean }) => {
  const content = (
    <>
      <div className="container mx-auto px-4 mb-10 text-center">
        <h2 className="font-display text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-2">
          <span className="gradient-text">Consulte grátis</span> se sua marca já está registrada
        </h2>
        <p className="text-muted-foreground text-base md:text-lg mb-6">
          Somos a maior empresa de registro de marcas do Brasil!
        </p>
        <a
          href="#precos"
          className="inline-flex items-center justify-center rounded-xl bg-primary text-primary-foreground font-semibold px-8 py-3 text-base hover:bg-primary/90 transition-all duration-200 shadow-lg shadow-primary/25"
        >
          Saiba Mais
        </a>
      </div>

      <div className="space-y-5 -mx-4">
        {/* Row 1 - Left to Right */}
        <div className="overflow-hidden">
          <div className="flex gap-5 animate-scroll-left hover:[animation-play-state:paused]">
            {[...row1Logos, ...row1Logos, ...row1Logos].map((logo, i) => (
              <LogoCard key={`r1-${i}`} src={logo.src} alt={logo.alt} />
            ))}
          </div>
        </div>

        {/* Row 2 - Right to Left */}
        <div className="overflow-hidden">
          <div className="flex gap-5 animate-scroll-right hover:[animation-play-state:paused]">
            {[...row2Logos, ...row2Logos, ...row2Logos].map((logo, i) => (
              <LogoCard key={`r2-${i}`} src={logo.src} alt={logo.alt} />
            ))}
          </div>
        </div>
      </div>
    </>
  );

  if (embedded) return <div className="overflow-hidden">{content}</div>;

  return (
    <section className="py-12 md:py-16 bg-muted/30 relative overflow-hidden">
      {content}
    </section>
  );
};

export default ClientLogosSection;
