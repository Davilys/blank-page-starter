import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

const Privacidade = () => {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const lastUpdate = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
  });

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Política de Privacidade | WebMarcas</title>
        <meta name="description" content="Política de Privacidade da WebMarcas Intelligence PI: dados coletados no formulário do site, finalidade, base legal (LGPD) e direitos do titular." />
        <link rel="canonical" href="https://webmarcas.net/privacidade" />
        <meta name="robots" content="index, follow" />
      </Helmet>
      <Header />
      <main className="container mx-auto px-4 py-16 md:py-24">
        <article className="prose prose-neutral max-w-3xl mx-auto">
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">Política de Privacidade</h1>
          <p className="text-muted-foreground text-sm mb-8">Última atualização: {lastUpdate}</p>

          <section className="mb-8">
            <h2>1. Dados coletados</h2>
            <p>Coletamos, através do formulário de contato disponível neste site, os seguintes dados fornecidos voluntariamente pelo titular:</p>
            <ul>
              <li>Nome</li>
              <li>WhatsApp</li>
              <li>E-mail</li>
              <li>Resposta ao campo de qualificação ("já tem marca registrada?")</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2>2. Finalidade</h2>
            <p>Os dados são utilizados exclusivamente para contato comercial via WhatsApp sobre o serviço de registro de marca solicitado. Não há compartilhamento com terceiros para fins de marketing.</p>
          </section>

          <section className="mb-8">
            <h2>3. Base legal e conformidade</h2>
            <p>O tratamento dos dados pessoais é realizado em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018), com base no consentimento do titular e na execução de procedimentos preliminares relacionados a contrato do qual o titular é parte interessada.</p>
          </section>

          <section className="mb-8">
            <h2>4. Direitos do titular</h2>
            <p>O titular pode, a qualquer tempo, solicitar acesso, correção ou exclusão dos seus dados pessoais. As solicitações devem ser enviadas para o e-mail de contato indicado no rodapé deste site.</p>
          </section>

          <section className="mb-8">
            <h2>5. Identificação do controlador</h2>
            <p>O controlador dos dados pessoais é:</p>
            <ul>
              <li><strong>Razão social:</strong> WebMarcas Intelligence PI</li>
              <li><strong>CNPJ:</strong> 39.528.012/0001-29</li>
              <li><strong>Endereço:</strong> Av. Brigadeiro Luís Antônio, 2696 — Jardim Paulista, São Paulo/SP — CEP 01402-000</li>
              <li><strong>E-mail:</strong> ola@webmarcas.net</li>
              <li><strong>Telefone:</strong> (11) 91112-0225</li>
            </ul>
          </section>

          <p className="text-sm text-muted-foreground mt-12">Data de última atualização: {lastUpdate}.</p>
        </article>
      </main>
      <Footer />
    </div>
  );
};

export default Privacidade;