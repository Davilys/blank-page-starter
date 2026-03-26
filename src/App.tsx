import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, Outlet } from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";
import { connectivityRetry, connectivityRetryDelay } from "@/lib/networkResilience";

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
const Registro = lazy(() => import("./pages/Registro"));
const Registrar = lazy(() => import("./pages/Registrar"));
const StatusPedido = lazy(() => import("./pages/StatusPedido"));
const Obrigado = lazy(() => import("./pages/Obrigado"));
const VerificarContrato = lazy(() => import("./pages/VerificarContrato"));
const AssinarDocumento = lazy(() => import("./pages/AssinarDocumento"));
const RegistroBlockchain = lazy(() => import("./pages/RegistroBlockchain"));
const PoliticaPrivacidade = lazy(() => import("./pages/PoliticaPrivacidade"));
const TermosUso = lazy(() => import("./pages/TermosUso"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));

// Cliente pages
const ClienteLogin = lazy(() => import("./pages/cliente/Login"));
const ClienteDashboard = lazy(() => import("./pages/cliente/Dashboard"));
const ClienteProcessos = lazy(() => import("./pages/cliente/Processos"));
const ClienteProcessoDetalhe = lazy(() => import("./pages/cliente/ProcessoDetalhe"));
const ClienteDocumentos = lazy(() => import("./pages/cliente/Documentos"));
const ClienteFinanceiro = lazy(() => import("./pages/cliente/Financeiro"));
const ClienteChatSuporte = lazy(() => import("./pages/cliente/ChatSuporte"));
const ClienteConfiguracoes = lazy(() => import("./pages/cliente/Configuracoes"));
const ClienteRegistrarMarca = lazy(() => import("./pages/cliente/RegistrarMarca"));
const ClienteStatusPedido = lazy(() => import("./pages/cliente/StatusPedido"));
const ClientePedidoConfirmado = lazy(() => import("./pages/cliente/PedidoConfirmado"));
const ClienteRecuperarSenha = lazy(() => import("./pages/cliente/RecuperarSenha"));
const ClienteRedefinirSenha = lazy(() => import("./pages/cliente/RedefinirSenha"));
const ClienteAnaliseInteligente = lazy(() => import("./pages/cliente/AnaliseInteligente"));

// Admin pages
const AdminLogin = lazy(() => import("./pages/admin/Login"));
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminLeads = lazy(() => import("./pages/admin/Leads"));
const AdminClientes = lazy(() => import("./pages/admin/Clientes"));
const AdminContratos = lazy(() => import("./pages/admin/Contratos"));
const AdminModelosContrato = lazy(() => import("./pages/admin/ModelosContrato"));
const AdminProcessos = lazy(() => import("./pages/admin/Processos"));
const AdminDocumentos = lazy(() => import("./pages/admin/Documentos"));
const AdminFinanceiro = lazy(() => import("./pages/admin/Financeiro"));
const AdminNotificacoes = lazy(() => import("./pages/admin/Notificacoes"));
const AdminConfiguracoes = lazy(() => import("./pages/admin/Configuracoes"));
const AdminRecursosINPI = lazy(() => import("./pages/admin/RecursosINPI"));
const AdminRevistaINPI = lazy(() => import("./pages/admin/RevistaINPI"));
const AdminPublicacoes = lazy(() => import("./pages/admin/Publicacoes"));
const AdminEmails = lazy(() => import("./pages/admin/Emails"));
const AdminChatAoVivo = lazy(() => import("./pages/admin/ChatAoVivo"));
const AdminPremiacao = lazy(() => import("./pages/admin/Premiacao"));
const AdminMarketingIntelligence = lazy(() => import("./pages/admin/MarketingIntelligence"));

// Minimal loading fallback
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

// Lazy-load AdminLayout once for route wrapper
const AdminLayout = lazy(() => import("@/components/admin/AdminLayout").then(m => ({ default: m.AdminLayout })));

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
            <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/registro" element={<Registro />} />
              <Route path="/registrar" element={<Registrar />} />
              <Route path="/status-pedido" element={<StatusPedido />} />
              <Route path="/obrigado" element={<Obrigado />} />
              <Route path="/verificar-contrato" element={<VerificarContrato />} />
              <Route path="/assinar/:token" element={<AssinarDocumento />} />
              <Route path="/registro-blockchain" element={<RegistroBlockchain />} />
              <Route path="/politica-de-privacidade" element={<PoliticaPrivacidade />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogPost />} />
              <Route path="/termos-de-uso" element={<TermosUso />} />
              
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
          </BrowserRouter>
        </TooltipProvider>
        </ChatModeProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
