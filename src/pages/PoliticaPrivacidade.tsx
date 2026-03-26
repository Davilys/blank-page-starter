import { useEffect } from "react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

const PoliticaPrivacidade = () => {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-16 md:py-24">
        <article className="prose prose-neutral dark:prose-invert max-w-3xl mx-auto">
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">Política de Privacidade</h1>
          <p className="text-muted-foreground text-sm mb-8">Última atualização: 25 de fevereiro de 2026</p>

          <section className="mb-8">
            <h2>1. Introdução</h2>
            <p>A <strong>WebMarcas Intelligence PI</strong> ("nós", "nosso") está comprometida com a proteção da privacidade dos seus usuários. Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e protegemos suas informações pessoais ao utilizar nossos serviços de registro de marcas, propriedade intelectual e demais funcionalidades oferecidas em nossa plataforma.</p>
          </section>

          <section className="mb-8">
            <h2>2. Dados Coletados</h2>
            <p>Podemos coletar as seguintes categorias de dados:</p>
            <ul>
              <li><strong>Dados de identificação:</strong> nome completo, CPF/CNPJ, e-mail, telefone e endereço.</li>
              <li><strong>Dados de marca:</strong> nome da marca, classes NCL, área de atuação e documentos relacionados.</li>
              <li><strong>Dados de pagamento:</strong> informações necessárias para processamento de pagamentos (não armazenamos dados completos de cartão de crédito).</li>
              <li><strong>Dados de navegação:</strong> endereço IP, tipo de navegador, páginas acessadas e tempo de permanência.</li>
              <li><strong>Dados de comunicação:</strong> mensagens enviadas via chat, e-mail ou WhatsApp.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2>3. Uso dos Dados</h2>
            <p>Utilizamos seus dados para:</p>
            <ul>
              <li>Prestar os serviços de registro e acompanhamento de marcas junto ao INPI.</li>
              <li>Processar pagamentos e emitir documentos fiscais.</li>
              <li>Enviar notificações sobre o andamento dos seus processos.</li>
              <li>Melhorar a experiência do usuário e personalizar nossos serviços.</li>
              <li>Cumprir obrigações legais e regulatórias.</li>
              <li>Realizar análises de viabilidade de registro de marcas.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2>4. Compartilhamento de Dados</h2>
            <p>Seus dados pessoais podem ser compartilhados com:</p>
            <ul>
              <li><strong>INPI (Instituto Nacional da Propriedade Industrial):</strong> conforme necessário para os processos de registro de marcas.</li>
              <li><strong>Processadores de pagamento:</strong> para viabilizar transações financeiras de forma segura.</li>
              <li><strong>Prestadores de serviços:</strong> que auxiliam na operação da plataforma, sempre sob acordos de confidencialidade.</li>
              <li><strong>Autoridades competentes:</strong> quando exigido por lei ou ordem judicial.</li>
            </ul>
            <p>Não vendemos, alugamos ou compartilhamos seus dados pessoais com terceiros para fins de marketing sem seu consentimento expresso.</p>
          </section>

          <section className="mb-8">
            <h2>5. Cookies e Tecnologias de Rastreamento</h2>
            <p>Utilizamos cookies e tecnologias similares para melhorar a experiência de navegação, analisar o tráfego do site e personalizar conteúdos. Você pode gerenciar suas preferências de cookies através das configurações do seu navegador.</p>
          </section>

          <section className="mb-8">
            <h2>6. Segurança dos Dados</h2>
            <p>Adotamos medidas técnicas e organizacionais apropriadas para proteger seus dados pessoais contra acesso não autorizado, alteração, divulgação ou destruição, incluindo:</p>
            <ul>
              <li>Criptografia de dados em trânsito e em repouso.</li>
              <li>Controles de acesso restritos.</li>
              <li>Monitoramento contínuo de segurança.</li>
              <li>Registro de atividades em blockchain para contratos assinados digitalmente.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2>7. Seus Direitos (LGPD)</h2>
            <p>Em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você tem os seguintes direitos:</p>
            <ul>
              <li>Confirmação da existência de tratamento de dados.</li>
              <li>Acesso aos dados pessoais coletados.</li>
              <li>Correção de dados incompletos, inexatos ou desatualizados.</li>
              <li>Anonimização, bloqueio ou eliminação de dados desnecessários.</li>
              <li>Portabilidade dos dados a outro fornecedor de serviço.</li>
              <li>Eliminação dos dados tratados com consentimento.</li>
              <li>Revogação do consentimento a qualquer tempo.</li>
            </ul>
            <p>Para exercer qualquer desses direitos, entre em contato conosco pelos canais abaixo.</p>
          </section>

          <section className="mb-8">
            <h2>8. Retenção de Dados</h2>
            <p>Mantemos seus dados pessoais pelo tempo necessário para cumprir as finalidades para as quais foram coletados, incluindo obrigações legais, contratuais e regulatórias. Dados relacionados a processos de registro de marcas podem ser mantidos por período superior, conforme exigências do INPI.</p>
          </section>

          <section className="mb-8">
            <h2>9. Contato</h2>
            <p>Para dúvidas, solicitações ou reclamações relacionadas a esta Política de Privacidade, entre em contato:</p>
            <ul>
              <li><strong>E-mail:</strong> ola@webmarcas.net</li>
              <li><strong>Telefone:</strong> (11) 91112-0225</li>
              <li><strong>Endereço:</strong> São Paulo - SP, Brasil</li>
            </ul>
          </section>

          <section>
            <h2>10. Atualizações desta Política</h2>
            <p>Esta Política de Privacidade pode ser atualizada periodicamente. Recomendamos que você a revise regularmente. A data da última atualização estará sempre indicada no topo desta página.</p>
          </section>
        </article>
      </main>
      <Footer />
    </div>
  );
};

export default PoliticaPrivacidade;
