import { Star, Quote } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

// Import avatars
import avatar1 from "@/assets/avatars/avatar-1.jpg";
import avatar2 from "@/assets/avatars/avatar-2.jpg";
import avatar3 from "@/assets/avatars/avatar-3.jpg";
import avatar4 from "@/assets/avatars/avatar-4.jpg";
import avatar5 from "@/assets/avatars/avatar-5.jpg";
import avatar6 from "@/assets/avatars/avatar-6.jpg";
import avatar7 from "@/assets/avatars/avatar-7.jpg";
import avatar8 from "@/assets/avatars/avatar-8.jpg";
import avatar9 from "@/assets/avatars/avatar-9.jpg";
import avatar10 from "@/assets/avatars/avatar-10.jpg";
import avatar11 from "@/assets/avatars/avatar-11.jpg";
import avatar12 from "@/assets/avatars/avatar-12.jpg";

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="#25D366">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4">
    <defs>
      <linearGradient id="instagram-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#FFDC80" />
        <stop offset="25%" stopColor="#FCAF45" />
        <stop offset="50%" stopColor="#F77737" />
        <stop offset="75%" stopColor="#F56040" />
        <stop offset="100%" stopColor="#FD1D1D" />
      </linearGradient>
    </defs>
    <path fill="url(#instagram-gradient)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
);

const testimonials = [
  // Row 1 - Left to Right
  {
    name: "Carla Mendes",
    role: "CEO, Doce Arte Confeitaria",
    content: "Processo super simples e rápido! Em menos de uma semana minha marca já estava protocolada. Recomendo demais!",
    rating: 5,
    avatar: avatar1,
    platform: "whatsapp" as const,
  },
  {
    name: "Roberto Almeida",
    role: "Fundador, Tech Solutions",
    content: "Excelente atendimento e muito profissionais. O acompanhamento pelo painel do cliente é muito prático. Nota 10!",
    rating: 5,
    avatar: avatar2,
    platform: "instagram" as const,
  },
  {
    name: "Juliana Costa",
    role: "Proprietária, Bella Moda",
    content: "Tinha medo do processo ser complicado, mas a equipe explicou tudo direitinho. Minha marca foi aprovada sem problemas!",
    rating: 5,
    avatar: avatar3,
    platform: "whatsapp" as const,
  },
  {
    name: "Fernando Silva",
    role: "Empresário, FS Importados",
    content: "Atendimento impecável do início ao fim. Minha marca está protegida e posso expandir meu negócio com tranquilidade.",
    rating: 5,
    avatar: avatar4,
    platform: "whatsapp" as const,
  },
  {
    name: "Margareth Oliveira",
    role: "Diretora, MO Consultoria",
    content: "Profissionalismo exemplar! Responderam todas as minhas dúvidas rapidamente. Super recomendo a WebMarcas.",
    rating: 5,
    avatar: avatar5,
    platform: "instagram" as const,
  },
  {
    name: "Lucas Ferreira",
    role: "Criador, LF Digital",
    content: "Registrei minha marca em tempo recorde. O processo online é muito intuitivo e o suporte é excelente!",
    rating: 5,
    avatar: avatar6,
    platform: "whatsapp" as const,
  },
];

const testimonials2 = [
  // Row 2 - Right to Left
  {
    name: "Patricia Santos",
    role: "Fundadora, PS Cosméticos",
    content: "Finalmente consegui proteger minha marca! A WebMarcas tornou tudo muito fácil e acessível.",
    rating: 5,
    avatar: avatar7,
    platform: "instagram" as const,
  },
  {
    name: "Ricardo Nunes",
    role: "CEO, RN Tecnologia",
    content: "Investimento que vale cada centavo. A segurança de ter minha marca registrada não tem preço.",
    rating: 5,
    avatar: avatar8,
    platform: "whatsapp" as const,
  },
  {
    name: "Amanda Ribeiro",
    role: "Proprietária, AR Boutique",
    content: "Equipe muito atenciosa e competente. Me senti segura durante todo o processo de registro.",
    rating: 5,
    avatar: avatar9,
    platform: "whatsapp" as const,
  },
  {
    name: "Bruno Cardoso",
    role: "Empreendedor, BC Store",
    content: "O melhor custo-benefício do mercado! Processo rápido, transparente e com suporte incrível.",
    rating: 5,
    avatar: avatar10,
    platform: "instagram" as const,
  },
  {
    name: "Camila Araújo",
    role: "Fundadora, CA Fashion",
    content: "Já indiquei para vários amigos empreendedores. Serviço de primeira qualidade!",
    rating: 5,
    avatar: avatar11,
    platform: "whatsapp" as const,
  },
  {
    name: "Diego Martins",
    role: "Dono, DM Eletrônicos",
    content: "Proteção da marca garantida! Agora posso focar no crescimento do meu negócio sem preocupações.",
    rating: 5,
    avatar: avatar12,
    platform: "instagram" as const,
  },
];

interface TestimonialCardProps {
  testimonial: {
    name: string;
    role: string;
    content: string;
    rating: number;
    avatar: string;
    platform: "whatsapp" | "instagram";
  };
}

const TestimonialCard = ({ testimonial }: TestimonialCardProps) => (
  <div className="flex-shrink-0 w-[340px] md:w-[380px] glass-card p-6 relative group hover:border-primary/30 transition-all duration-300">
    {/* Quote icon */}
    <Quote className="w-8 h-8 text-primary/20 absolute top-6 right-6" />

    {/* Rating */}
    <div className="flex gap-1 mb-4">
      {Array.from({ length: testimonial.rating }).map((_, i) => (
        <Star key={i} className="w-4 h-4 fill-primary text-primary" />
      ))}
    </div>

    {/* Content */}
    <p className="text-muted-foreground mb-6 leading-relaxed text-sm">
      "{testimonial.content}"
    </p>

    {/* Author */}
    <div className="flex items-center gap-3">
      <div className="relative">
        <img
          src={testimonial.avatar}
          alt={testimonial.name}
          className="w-12 h-12 rounded-full object-cover border-2 border-primary/30"
        />
        <div className="absolute -bottom-1 -right-1 bg-card rounded-full p-1 border border-border">
          {testimonial.platform === "whatsapp" ? <WhatsAppIcon /> : <InstagramIcon />}
        </div>
      </div>
      <div>
        <div className="font-semibold text-sm text-foreground">{testimonial.name}</div>
        <div className="text-xs text-muted-foreground">{testimonial.role}</div>
      </div>
    </div>
  </div>
);

const TestimonialsSection = () => {
  const { t } = useLanguage();

  return (
    <section className="section-padding bg-background relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="badge-premium mb-4 inline-flex">{t("testimonials.badge")}</span>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            {t("testimonials.title")}{" "}
            <span className="gradient-text">{t("testimonials.titleHighlight")}</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            {t("testimonials.subtitle")}
          </p>
        </div>

        {/* Carousel Container */}
        <div className="space-y-6 -mx-4 md:-mx-8 lg:-mx-16">
          {/* Row 1 - Left to Right */}
          <div className="relative overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-primary/30 scrollbar-track-transparent group">
            <div className="flex gap-6 animate-scroll-left hover:[animation-play-state:paused] cursor-grab active:cursor-grabbing">
              {/* Duplicate for seamless loop */}
              {[...testimonials, ...testimonials, ...testimonials].map((testimonial, index) => (
                <TestimonialCard key={`row1-${index}`} testimonial={testimonial} />
              ))}
            </div>
          </div>

          {/* Row 2 - Right to Left */}
          <div className="relative overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-primary/30 scrollbar-track-transparent group">
            <div className="flex gap-6 animate-scroll-right hover:[animation-play-state:paused] cursor-grab active:cursor-grabbing">
              {/* Duplicate for seamless loop */}
              {[...testimonials2, ...testimonials2, ...testimonials2].map((testimonial, index) => (
                <TestimonialCard key={`row2-${index}`} testimonial={testimonial} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
