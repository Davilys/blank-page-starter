import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, Outlet } from "react-router-dom";
import { useEffect, lazy, Suspense, Component, ReactNode, ComponentType } from "react";
import { connectivityRetry, connectivityRetryDelay } from "@/lib/networkResilience";

// Lazy import with automatic reload on stale/failed dynamic chunk (fixes
// "Failed to fetch dynamically imported module" white screens after deploys).
const lazyWithRetry = <T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) =>
  lazy<T>(async () => {
    try {
      return await factory();
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (/dynamically imported module|Importing a module script failed|Failed to fetch/i.test(msg)) {
        const key = "__lovable_chunk_reload__";
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, "1");
          window.location.reload();
          return new Promise<{ default: T }>(() => {});
        }
      }
      throw err;
    }
  });

class RouteErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error("Route error:", error); }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center bg-background">
          <h1 className="text-xl font-semibold">Algo deu errado ao carregar a página</h1>
          <p className="text-sm text-muted-foreground max-w-md">{this.state.error.message}</p>
          <button
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground"
            onClick={() => window.location.reload()}
          >
            Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const PDFTestHarness = lazyWithRetry(() => import("./pages/dev/PDFTestHarness"));

const SectionRedirect = ({ section }: { section: string }) => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/', { replace: true });
    setTimeout(() => {
      const el = document.getElementById(section);
      el?.scrollIntoView({ behavior: 'smooth' });
    }, 300);
  }, []);
  return null;
};

import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ChatModeProvider } from "@/contexts/ChatModeContext";

// Only the landing page is eagerly loaded for instant first paint
import Index from "./pages/Index";

// All other pages are lazy-loaded for code splitting
const Registrar = lazyWithRetry(() => import("./pages/Registrar"));
const StatusPedido = lazyWithRetry(() => import("./pages/StatusPedido"));
const Obrigado = lazyWithRetry(() => import("./pages/Obrigado"));
const VerificarContrato = lazyWithRetry(() => import("./pages/VerificarContrato"));
const AssinarDocumento = lazyWithRetry(() => import("./pages/AssinarDocumento"));
const RegistroBlockchain = lazyWithRetry(() => import("./pages/RegistroBlockchain"));
const PoliticaPrivacidade = lazyWithRetry(() => import("./pages/PoliticaPrivacidade"));
const Privacidade = lazyWithRetry(() => import("./pages/Privacidade"));
const TermosUso = lazyWithRetry(() => import("./pages/TermosUso"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const Blog = lazyWithRetry(() => import("./pages/Blog"));
const BlogPost = lazyWithRetry(() => import("./pages/BlogPost"));

// WebMarcas Knowledge OS — isolated Intelligence module (FASE 05)
const IntelligenceHome = lazyWithRetry(() => import("./pages/intelligence/Home"));
const IntelligenceAdminShell = lazyWithRetry(() => import("./pages/intelligence/admin/AdminShell"));
const IntelligenceAdminHome = lazyWithRetry(() => import("./pages/intelligence/admin/AdminHome"));
const IntelligenceModulePlaceholder = lazyWithRetry(
  () => import("./pages/intelligence/admin/ModulePlaceholder"),
);
// FASE 06 — Knowledge Factory
const FactoryDashboard = lazyWithRetry(() => import("./pages/intelligence/admin/factory/FactoryDashboard"));
const FactoryList = lazyWithRetry(() => import("./pages/intelligence/admin/factory/FactoryList"));
const FactoryEditor = lazyWithRetry(() => import("./pages/intelligence/admin/factory/FactoryEditor"));
// FASE 07 — Knowledge Ingestion
const IngestionDashboard = lazyWithRetry(() => import("./pages/intelligence/admin/ingestion/IngestionDashboard"));
const IngestionCandidateList = lazyWithRetry(() => import("./pages/intelligence/admin/ingestion/CandidateList"));
const IngestionCandidateDetail = lazyWithRetry(() => import("./pages/intelligence/admin/ingestion/CandidateDetail"));
// FASE 08 — Fact Ledger
const FactsDashboard = lazyWithRetry(() => import("./pages/intelligence/admin/facts/FactsDashboard"));
const FactsList = lazyWithRetry(() => import("./pages/intelligence/admin/facts/FactsList"));
const FactEditor = lazyWithRetry(() => import("./pages/intelligence/admin/facts/FactEditor"));

const GraphDashboard = lazyWithRetry(() => import("./pages/intelligence/admin/graph/GraphDashboard"));
const GraphExplorer = lazyWithRetry(() => import("./pages/intelligence/admin/graph/GraphExplorer"));
const GraphRelations = lazyWithRetry(() => import("./pages/intelligence/admin/graph/GraphRelations"));
const GraphImpact = lazyWithRetry(() => import("./pages/intelligence/admin/graph/GraphImpact"));
const GraphNodes = lazyWithRetry(() => import("./pages/intelligence/admin/graph/GraphNodes"));
const GraphAudit = lazyWithRetry(() => import("./pages/intelligence/admin/graph/GraphAudit"));

const VaultDashboard = lazyWithRetry(() => import("./pages/intelligence/admin/vault/VaultDashboard"));
const VaultList = lazyWithRetry(() => import("./pages/intelligence/admin/vault/VaultList"));
const VaultFactEditor = lazyWithRetry(() => import("./pages/intelligence/admin/vault/VaultFactEditor"));

// Cliente pages
const ClienteLogin = lazyWithRetry(() => import("./pages/cliente/Login"));
const ClienteDashboard = lazyWithRetry(() => import("./pages/cliente/Dashboard"));
const ClienteProcessos = lazyWithRetry(() => import("./pages/cliente/Processos"));
const ClienteProcessoDetalhe = lazyWithRetry(() => import("./pages/cliente/ProcessoDetalhe"));
const ClienteDocumentos = lazyWithRetry(() => import("./pages/cliente/Documentos"));
const ClienteFinanceiro = lazyWithRetry(() => import("./pages/cliente/Financeiro"));
const ClienteChatSuporte = lazyWithRetry(() => import("./pages/cliente/ChatSuporte"));
const ClienteConfiguracoes = lazyWithRetry(() => import("./pages/cliente/Configuracoes"));
const ClienteRegistrarMarca = lazyWithRetry(() => import("./pages/cliente/RegistrarMarca"));
const ClienteStatusPedido = lazyWithRetry(() => import("./pages/cliente/StatusPedido"));
const ClientePedidoConfirmado = lazyWithRetry(() => import("./pages/cliente/PedidoConfirmado"));
const ClienteRecuperarSenha = lazyWithRetry(() => import("./pages/cliente/RecuperarSenha"));
const ClienteRedefinirSenha = lazyWithRetry(() => import("./pages/cliente/RedefinirSenha"));
const ClienteAnaliseInteligente = lazyWithRetry(() => import("./pages/cliente/AnaliseInteligente"));

// Admin pages
const AdminLogin = lazyWithRetry(() => import("./pages/admin/Login"));
const AdminDashboard = lazyWithRetry(() => import("./pages/admin/Dashboard"));
const AdminLeads = lazyWithRetry(() => import("./pages/admin/Leads"));
const AdminClientes = lazyWithRetry(() => import("./pages/admin/Clientes"));
const AdminContratos = lazyWithRetry(() => import("./pages/admin/Contratos"));
const AdminModelosContrato = lazyWithRetry(() => import("./pages/admin/ModelosContrato"));
const AdminProcessos = lazyWithRetry(() => import("./pages/admin/Processos"));
const AdminDocumentos = lazyWithRetry(() => import("./pages/admin/Documentos"));
const AdminFinanceiro = lazyWithRetry(() => import("./pages/admin/Financeiro"));
const AdminFinanceiroVencidos = lazyWithRetry(() => import("./pages/admin/FinanceiroVencidos"));
const AdminFinanceiroAguardando = lazyWithRetry(() => import("./pages/admin/FinanceiroAguardando"));
const AdminDevedores = lazyWithRetry(() => import("./pages/admin/Devedores"));
const AdminNotificacoes = lazyWithRetry(() => import("./pages/admin/Notificacoes"));
const AdminConfiguracoes = lazyWithRetry(() => import("./pages/admin/Configuracoes"));
const AdminRecursosINPI = lazyWithRetry(() => import("./pages/admin/RecursosINPI"));
const AdminRevistaINPI = lazyWithRetry(() => import("./pages/admin/RevistaINPI"));
const AdminPublicacoes = lazyWithRetry(() => import("./pages/admin/Publicacoes"));
const AdminEmails = lazyWithRetry(() => import("./pages/admin/Emails"));
const AdminChatAoVivo = lazyWithRetry(() => import("./pages/admin/ChatAoVivo"));
const AdminPremiacao = lazyWithRetry(() => import("./pages/admin/Premiacao"));
const AdminMarketingIntelligence = lazyWithRetry(() => import("./pages/admin/MarketingIntelligence"));

// Minimal loading fallback
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

// Lazy-load AdminLayout once for route wrapper
const AdminLayout = lazyWithRetry(() => import("@/components/admin/AdminLayout").then(m => ({ default: m.AdminLayout })));

const AdminRouteWrapper = () => (
  <AdminLayout>
    <Outlet />
  </AdminLayout>
);

// Initialize query client with resilient defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,     // 5 min
      gcTime: 10 * 60 * 1000,        // 10 min
      retry: connectivityRetry,
      retryDelay: connectivityRetryDelay,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
<QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <LanguageProvider>
        <ChatModeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <RouteErrorBoundary>
            <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              {import.meta.env.DEV && (
                <Route path="/__pdf-test" element={<PDFTestHarness />} />
              )}
              <Route path="/registro" element={<Navigate to="/registrar" replace />} />
              <Route path="/registrar" element={<Registrar />} />
              <Route path="/status-pedido" element={<StatusPedido />} />
              <Route path="/obrigado" element={<Obrigado />} />
              <Route path="/verificar-contrato" element={<VerificarContrato />} />
              <Route path="/assinar/:token" element={<AssinarDocumento />} />
              <Route path="/registro-blockchain" element={<RegistroBlockchain />} />
              <Route path="/politica-de-privacidade" element={<PoliticaPrivacidade />} />
              <Route path="/privacidade" element={<Privacidade />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogPost />} />
              <Route path="/termos-de-uso" element={<TermosUso />} />

              {/* ── WebMarcas Knowledge OS (isolado, não afeta rotas existentes) ── */}
              <Route path="/intelligence" element={<IntelligenceHome />} />
              <Route path="/intelligence/admin" element={<IntelligenceAdminShell />}>
                <Route index element={<IntelligenceAdminHome />} />
                <Route path="factory" element={<FactoryDashboard />} />
                <Route path="factory/objetos" element={<FactoryList />} />
                <Route path="factory/novo" element={<FactoryEditor />} />
                <Route path="factory/objetos/:id" element={<FactoryEditor />} />
                <Route path="ingestion" element={<IngestionDashboard />} />
                <Route path="ingestion/candidatos" element={<IngestionCandidateList />} />
                <Route path="ingestion/candidatos/:id" element={<IngestionCandidateDetail />} />
                <Route path="fatos" element={<FactsDashboard />} />
                <Route path="fatos/lista" element={<FactsList />} />
                <Route path="fatos/:id" element={<FactEditor />} />
                <Route path="graph" element={<GraphDashboard />} />
                <Route path="graph/explorer" element={<GraphExplorer />} />
                <Route path="graph/relacoes" element={<GraphRelations />} />
                <Route path="graph/impacto" element={<GraphImpact />} />
                <Route path="graph/nos" element={<GraphNodes />} />
                <Route path="graph/auditoria" element={<GraphAudit />} />
                <Route path="vault" element={<VaultDashboard />} />
                <Route path="vault/fatos" element={<VaultList />} />
                <Route path="vault/fatos/:id" element={<VaultFactEditor />} />
                <Route
                  path="objetos"
                  element={<Navigate to="/intelligence/admin/factory/objetos" replace />}
                />
                <Route
                  path="entidades"
                  element={
                    <IntelligenceModulePlaceholder
                      titulo="Entity Engine"
                      descricao="Entidades canônicas, relações e ancoragem externa (sameAs)."
                      fase="Fase 06"
                    />
                  }
                />
                <Route
                  path="autoridade"
                  element={
                    <IntelligenceModulePlaceholder
                      titulo="Authority Engine"
                      descricao="Trust Score, Knowledge Authority Score e evolução da autoridade."
                      fase="Fase 07"
                    />
                  }
                />
                <Route
                  path="sinais"
                  element={
                    <IntelligenceModulePlaceholder
                      titulo="Signals Engine"
                      descricao="Propagação de mudanças a partir de fontes oficiais monitoradas."
                      fase="Fase 07"
                    />
                  }
                />
                <Route path="reasoning" element={<ReasoningLayout />}>
                  <Route index element={<ReasoningDashboard />} />
                  <Route path="impacto" element={<ReasoningImpact />} />
                  <Route path="simulacao" element={<ReasoningSimulation />} />
                  <Route path="inconsistencias" element={<ReasoningBroken />} />
                  <Route path="confianca" element={<ReasoningConfidence />} />
                  <Route path="cobertura" element={<ReasoningCoverage />} />
                  <Route path="sugestoes" element={<ReasoningSuggestions />} />
                  <Route path="auditoria" element={<ReasoningAudit />} />
                </Route>
                <Route
                  path="learning"
                  element={
                    <IntelligenceModulePlaceholder
                      titulo="Learning Engine"
                      descricao="Candidatos gerados por demanda real — sempre com revisão humana."
                      fase="Fase 08"
                    />
                  }
                />
                <Route
                  path="analytics"
                  element={
                    <IntelligenceModulePlaceholder
                      titulo="Analytics"
                      descricao="Cobertura, frescor e distribuição de confiança das respostas."
                      fase="Fase 07"
                    />
                  }
                />
                <Route
                  path="crawlers"
                  element={
                    <IntelligenceModulePlaceholder
                      titulo="AI Crawler Center"
                      descricao="Visitas de Googlebot, GPTBot, ClaudeBot e demais agentes."
                      fase="Fase 07"
                    />
                  }
                />
                <Route
                  path="health"
                  element={
                    <IntelligenceModulePlaceholder
                      titulo="AI Health Center"
                      descricao="AI Readiness e indicadores de saúde do conhecimento."
                      fase="Fase 07"
                    />
                  }
                />
              </Route>
              
              {/* Section redirects - handle URLs without # */}
              <Route path="/beneficios" element={<SectionRedirect section="beneficios" />} />
              <Route path="/como-funciona" element={<SectionRedirect section="como-funciona" />} />
              <Route path="/precos" element={<SectionRedirect section="precos" />} />
              <Route path="/faq" element={<SectionRedirect section="faq" />} />
              <Route path="/consultar" element={<SectionRedirect section="consultar" />} />
              <Route path="/home" element={<SectionRedirect section="home" />} />
              
              {/* Área do Cliente */}
              <Route path="/cliente/login" element={<ClienteLogin />} />
              <Route path="/cliente/dashboard" element={<ClienteDashboard />} />
              <Route path="/cliente/processos" element={<ClienteProcessos />} />
              <Route path="/cliente/processos/:id" element={<ClienteProcessoDetalhe />} />
              <Route path="/cliente/documentos" element={<ClienteDocumentos />} />
              <Route path="/cliente/financeiro" element={<ClienteFinanceiro />} />
              <Route path="/cliente/suporte" element={<ClienteChatSuporte />} />
              <Route path="/cliente/configuracoes" element={<ClienteConfiguracoes />} />
              <Route path="/cliente/registrar-marca" element={<ClienteRegistrarMarca />} />
              <Route path="/cliente/status-pedido" element={<ClienteStatusPedido />} />
              <Route path="/cliente/pedido-confirmado" element={<ClientePedidoConfirmado />} />
              <Route path="/cliente/recuperar-senha" element={<ClienteRecuperarSenha />} />
              <Route path="/cliente/redefinir-senha" element={<ClienteRedefinirSenha />} />
              <Route path="/cliente/analise-inteligente" element={<ClienteAnaliseInteligente />} />
              {/* Painel Administrativo */}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={<AdminRouteWrapper />}>
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="leads" element={<AdminLeads />} />
                <Route path="clientes" element={<AdminClientes />} />
                <Route path="contratos" element={<AdminContratos />} />
                <Route path="modelos-contrato" element={<AdminModelosContrato />} />
                <Route path="processos" element={<AdminProcessos />} />
                <Route path="documentos" element={<AdminDocumentos />} />
                <Route path="financeiro" element={<AdminFinanceiro />} />
                <Route path="financeiro/vencidos" element={<AdminFinanceiroVencidos />} />
                <Route path="financeiro/aguardando" element={<AdminFinanceiroAguardando />} />
                <Route path="devedores" element={<Navigate to="/admin/financeiro/vencidos" replace />} />
                <Route path="notificacoes" element={<AdminNotificacoes />} />
                <Route path="recursos-inpi" element={<AdminRecursosINPI />} />
                <Route path="revista-inpi" element={<AdminRevistaINPI />} />
                <Route path="publicacao" element={<AdminPublicacoes />} />
                <Route path="configuracoes" element={<AdminConfiguracoes />} />
                <Route path="emails" element={<AdminEmails />} />
                <Route path="chat-ao-vivo" element={<AdminChatAoVivo />} />
                <Route path="premiacao" element={<AdminPremiacao />} />
                <Route path="marketing" element={<AdminMarketingIntelligence />} />
              </Route>
              
              
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
            </RouteErrorBoundary>
          </BrowserRouter>
        </TooltipProvider>
        </ChatModeProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
