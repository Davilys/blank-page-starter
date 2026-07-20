import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useLanguage } from "@/contexts/LanguageContext";
import { MessageCircle } from "lucide-react";

const FAQSection = () => {
  const { t } = useLanguage();

  const faqs = [
    { question: t("faq.q1"), answer: t("faq.a1") },
    { question: t("faq.q2"), answer: t("faq.a2") },
    { question: t("faq.q3"), answer: t("faq.a3") },
    { question: t("faq.q4"), answer: t("faq.a4") },
    { question: t("faq.q5"), answer: t("faq.a5") },
    { question: t("faq.q6"), answer: t("faq.a6") },
    { question: t("faq.q7"), answer: t("faq.a7") },
    { question: t("faq.q8"), answer: t("faq.a8") },
  ];

  return (
    <section id="faq" className="section-padding relative overflow-hidden">
      {/* Background */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="badge-premium mb-4 inline-flex">{t("faq.badge")}</span>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            {t("faq.title")}{" "}
            <span className="gradient-text">{t("faq.titleHighlight")}</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            {t("faq.subtitle")}
          </p>
        </div>

        {/* FAQ Accordion */}
        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="glass-card px-6 border-none"
              >
                <AccordionTrigger className="text-left font-display font-semibold hover:no-underline py-5">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-5">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          {/* CTA WhatsApp */}
          <a
            href="https://api.whatsapp.com/send/?phone=5511911120225&text=Ol%C3%A1%21+Estava+no+site+da+WebMarcas+e+quero+registrar+minha+marca.&type=phone_number&app_absent=0"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 block relative overflow-hidden rounded-2xl p-8 md:p-10 group"
            style={{
              background:
                "radial-gradient(120% 140% at 30% 40%, #22c55e 0%, #16a34a 45%, #052e16 100%)",
            }}
          >
            <MessageCircle
              className="absolute top-6 right-6 md:top-8 md:right-10 w-24 h-24 md:w-32 md:h-32 text-white/25"
              strokeWidth={1.5}
            />
            <div className="relative z-10 max-w-md">
              <h3 className="font-display text-2xl md:text-3xl font-bold text-white leading-tight">
                Ainda ficou com<br />alguma dúvida?
              </h3>
              <p className="text-white/90 mt-3 text-base md:text-lg">
                Entre em contato com nosso time de especialistas pelo WhatsApp.
              </p>
              <span className="inline-flex items-center gap-2 mt-6 bg-white text-green-600 font-semibold px-6 py-3 rounded-full shadow-lg group-hover:scale-[1.02] transition-transform">
                Falar com especialista
                <MessageCircle className="w-5 h-5" strokeWidth={2} />
              </span>
            </div>
          </a>
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
