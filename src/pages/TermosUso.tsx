import { useEffect } from "react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

const TermosUso = () => {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-16 md:py-24">
        <article className="prose prose-neutral dark:prose-invert max-w-3xl mx-auto">
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">Termos de Uso</h1>
          <p className="text-muted-foreground text-sm mb-8">Última atualização: 25 de fevereiro de 2026</p>

          <section className="mb-8">
            <h2>1. Aceitação dos Termos</h2>
            <p>Ao acessar e utilizar a plataforma <strong>WebMarcas Intelligence PI</strong>, você concorda integralmente com estes Termos de Uso. Caso não concorde com qualquer disposição, recomendamos que não utilize nossos serviços.</p>
          </section>

          <section className="mb-8">
            <h2>2. Descrição dos Serviços</h2>
            <p>A WebMarcas Intelligence PI oferece serviços relacionados à propriedade intelectual, incluindo:</p>
            <ul>
              <li>Pesquisa de viabilidade de registro de marcas.</li>
              <li>Acompanhamento e gestão de processos junto ao INPI.</li>
              <li>Elaboração e assinatura digital de contratos.</li>
              <li>Registro de documentos com verificação em blockchain.</li>
              <li>Monitoramento de publicações na Revista da Propriedade Industrial (RPI).</li>
              <li>Elaboração de recursos administrativos junto ao INPI.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2>3. Cadastro e Conta</h2>
            <p>Para utilizar determinados serviços, é necessário criar uma conta fornecendo informações verdadeiras e completas. Você é responsável por manter a confidencialidade de suas credenciais de acesso e por todas as atividades realizadas em sua conta.</p>
          </section>

          <section className="mb-8">
            <h2>4. Obrigações do Usuário</h2>
            <p>Ao utilizar nossos serviços, você se compromete a:</p>
            <ul>
              <li>Fornecer informações verdadeiras, precisas e atualizadas.</li>
              <li>Não utilizar a plataforma para fins ilícitos ou não autorizados.</li>
              <li>Não tentar acessar áreas restritas do sistema sem autorização.</li>
              <li>Respeitar os direitos de propriedade intelectual de terceiros.</li>
              <li>Não reproduzir, distribuir ou modificar o conteúdo da plataforma sem autorização.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2>5. Pagamentos e Reembolsos</h2>
            <p>Os valores dos serviços são informados previamente à contratação. Os pagamentos podem ser realizados via PIX, boleto bancário ou cartão de crédito. As taxas oficiais do INPI são de responsabilidade do cliente e não estão incluídas nos valores dos serviços da WebMarcas.</p>
            <p>Solicitações de reembolso devem ser feitas em até 7 (sete) dias corridos após a contratação, desde que o serviço ainda não tenha sido iniciado junto ao INPI. Após o protocolo do pedido, não será possível realizar reembolso das taxas governamentais já pagas.</p>
          </section>

          <section className="mb-8">
            <h2>6. Propriedade Intelectual</h2>
            <p>Todo o conteúdo da plataforma, incluindo textos, imagens, logotipos, layout, software e funcionalidades, é de propriedade exclusiva da WebMarcas Intelligence PI ou de seus licenciadores, protegido pelas leis de propriedade intelectual brasileiras e internacionais.</p>
          </section>

          <section className="mb-8">
            <h2>7. Limitação de Responsabilidade</h2>
            <p>A WebMarcas Intelligence PI atua como intermediária nos processos de registro de marcas junto ao INPI. Não garantimos a aprovação do registro, uma vez que a decisão final é de competência exclusiva do INPI. Nossa responsabilidade limita-se à prestação diligente dos serviços contratados.</p>
            <p>Não nos responsabilizamos por danos indiretos, incidentais ou consequenciais decorrentes do uso ou impossibilidade de uso da plataforma.</p>
          </section>

          <section className="mb-8">
            <h2>8. Rescisão</h2>
            <p>Podemos suspender ou encerrar seu acesso à plataforma a qualquer momento, mediante notificação prévia, em caso de violação destes Termos de Uso. Você também pode encerrar sua conta a qualquer momento entrando em contato conosco.</p>
          </section>

          <section className="mb-8">
            <h2>9. Lei Aplicável e Foro</h2>
            <p>Estes Termos de Uso são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da Comarca de São Paulo - SP para dirimir quaisquer controvérsias decorrentes destes termos, com renúncia a qualquer outro, por mais privilegiado que seja.</p>
          </section>

          <section>
            <h2>10. Contato</h2>
            <p>Para dúvidas ou esclarecimentos sobre estes Termos de Uso, entre em contato:</p>
            <ul>
              <li><strong>E-mail:</strong> ola@webmarcas.net</li>
              <li><strong>Telefone:</strong> (11) 91112-0225</li>
              <li><strong>Endereço:</strong> São Paulo - SP, Brasil</li>
            </ul>
          </section>
        </article>
      </main>
      <Footer />
    </div>
  );
};

export default TermosUso;
