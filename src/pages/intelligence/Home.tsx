/**
 * WebMarcas Intelligence — Home (FASE 05, Foundation).
 *
 * Isolated route: reuses the public Header/Footer and the `.brand-public`
 * token scope so the visual identity is identical, without touching any
 * existing page, style, route or API.
 */
import { Helmet } from "react-helmet-async";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import WhatsAppButton from "@/components/layout/WhatsAppButton";
import IntelligenceHero from "@/modules/intelligence/presentation/components/IntelligenceHero";
import SearchResults from "@/modules/intelligence/presentation/components/SearchResults";
import {
  AboutSection,
  ExploreSection,
  FeaturedQuestionsSection,
  IntelligenceCTA,
  RecentUpdatesSection,
  ThemesSection,
} from "@/modules/intelligence/presentation/components/HomeSections";
import {
  useHomeOverview,
  useKnowledgeSearch,
} from "@/modules/intelligence/presentation/hooks/useIntelligence";

const IntelligenceHome = () => {
  const { data } = useHomeOverview();
  const { resultado, buscando, buscar } = useKnowledgeSearch();

  return (
    <div className="brand-public min-h-screen bg-background">
      <Helmet>
        <title>WebMarcas Intelligence — Base de conhecimento sobre marcas e INPI</title>
        <meta
          name="description"
          content="Base de conhecimento verificada sobre registro de marca, INPI e Propriedade Intelectual. Conteúdo com fonte, autor e data de revisão."
        />
        <link rel="canonical" href="https://webmarcas.net/intelligence" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://webmarcas.net/intelligence" />
        <meta property="og:title" content="WebMarcas Intelligence — Base de conhecimento sobre marcas e INPI" />
        <meta
          property="og:description"
          content="Conhecimento estruturado sobre marcas e INPI, com fonte primária e revisão de especialistas."
        />
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>

      <Header />

      <main>
        <IntelligenceHero onSearch={buscar} buscando={buscando} />
        <SearchResults resultado={resultado} />
        <AboutSection />
        <ThemesSection temas={data?.temas ?? []} />
        <FeaturedQuestionsSection perguntas={data?.perguntasDestaque ?? []} />
        <RecentUpdatesSection
          atualizacoes={data?.atualizacoesRecentes ?? { items: [], total: 0 }}
        />
        <ExploreSection />
        <IntelligenceCTA />
      </main>

      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default IntelligenceHome;