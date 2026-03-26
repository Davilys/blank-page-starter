-- First, create a contract type for "Registro de Marca" if it doesn't exist
INSERT INTO public.contract_types (id, name, description)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Registro de Marca',
  'Contrato para serviços de registro de marca junto ao INPI'
)
ON CONFLICT (id) DO NOTHING;

-- Insert the complete contract template with all 12 clauses
INSERT INTO public.contract_templates (
  name,
  content,
  contract_type_id,
  is_active,
  variables
) VALUES (
  'Contrato Padrão - Registro de Marca INPI',
  'CONTRATO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS DE ASSESSORAMENTO PARA REGISTRO DE MARCA JUNTO AO INPI

Por este instrumento particular de prestação de serviços, que fazem, de um lado:

I) WEB MARCAS PATENTES EIRELI, com sede na cidade de SÃO PAULO, Estado de SP, na AVENIDA BRIGADEIRO LUIS ANTONIO, Nº: 2696, CEP: 01402-000, inscrita no CNPJ/MF sob o Nº: 39.528.012/0001-29, neste ato representada por seu titular, senhor Davilys Danques de Oliveira Cunha, brasileiro, casado, regularmente inscrito no RG sob o Nº 50.688.779-0 e CPF sob o Nº 393.239.118-79, a seguir denominada CONTRATADA.

II) {{razao_social_ou_nome}}, {{dados_cnpj}}com sede na {{endereco_completo}}, neste ato representada por {{nome_cliente}}, CPF sob o nº {{cpf}}, com endereço de e-mail para faturamento {{email}} e Tel: {{telefone}}, ("Contratante").

As partes celebram o presente Acordo de Tarifas, que se regerá pelas cláusulas e condições abaixo:

1. CLÁUSULA PRIMEIRA – DO OBJETO

1.1 A CONTRATADA prestará os serviços de preparo, protocolo e acompanhamento do pedido de registro da marca "{{marca}}" junto ao INPI até a conclusão do processo, no ramo de atividade: {{ramo_atividade}}.

2. CLÁUSULA SEGUNDA – DA RESPONSABILIDADE SOBRE OS SERVIÇOS CONTRATADOS

2.1 Executar os serviços com responsabilidade e qualidade;
2.2 Fornecer cópia digital dos atos praticados junto ao INPI;
2.3 Comunicar à CONTRATANTE eventuais impedimentos ou exigências;
2.4 Acompanhar semanalmente o processo no INPI e informar colidências, exigências ou publicações;
2.5 Garantir o investimento da CONTRATANTE com nova tentativa sem custos adicionais de honorários caso o registro seja negado.

3. CLÁUSULA TERCEIRA - DAS OBRIGAÇÕES GERAIS DA CONTRATADA

3.1 Enviar cópias digitais por e-mail e relatório anual do processo;
3.2 Executar os serviços conforme o contrato e a legislação;
3.3 Cumprir prazos e exigências do INPI;
3.4 Comunicar impedimentos imediatamente, a fim de cumprir as normas do INPI para garantir o registro.

4. CLÁUSULA QUARTA – DAS OBRIGAÇÕES GERAIS DA CONTRATANTE

4.1 A CONTRATANTE obriga-se a efetuar os pagamentos na forma, prazos e condições estabelecidas neste instrumento.
4.2 A CONTRATANTE compromete-se a fornecer à CONTRATADA todas as informações, documentos e materiais solicitados, de forma completa e dentro dos prazos estipulados.
4.3 A CONTRATANTE poderá solicitar ajustes ou correções nos serviços prestados somente quando houver divergência comprovada com o objeto deste contrato.
4.4 A CONTRATANTE reconhece que a CONTRATADA atua como assessoria técnica e jurídica especializada, sendo que a decisão final sobre a concessão do registro de marca cabe exclusivamente ao INPI.

5. CLÁUSULA QUINTA – DAS CONDIÇÕES DE PAGAMENTO

5.1 Os pagamentos à CONTRATADA serão efetuados conforme a opção escolhida:
{{forma_pagamento_detalhada}}
5.2 Taxas do INPI: As taxas federais obrigatórias (GRU) serão de responsabilidade exclusiva do CONTRATANTE, devendo ser recolhidas diretamente ao INPI.
5.3 O cadastro do CONTRATANTE junto ao INPI é realizado pela CONTRATADA previamente ao pagamento das taxas federais.
5.4 Em caso de parcelamento, o atraso de qualquer parcela implicará no vencimento antecipado de todas as demais, com acréscimo de multa e juros conforme cláusula sétima.

6. CLÁUSULA SEXTA – DO PRAZO DE VIGÊNCIA

6.1 O presente contrato terá vigência a partir da data de sua assinatura e perdurará até o final do decênio de registro de marca junto ao INPI, podendo ser renovado mediante termo aditivo.

7. CLÁUSULA SÉTIMA – DA INADIMPLÊNCIA

7.1 No caso de inadimplência, a CONTRATANTE estará sujeita a:
a) Multa de 10% (dez por cento) sobre o valor total devido;
b) Juros de mora de 1% (um por cento) ao mês;
c) Correção monetária pelo IGPM/FGV;
d) Suspensão imediata dos serviços até a regularização do débito;
e) Inscrição em cadastros de proteção ao crédito após 30 dias de inadimplência.

8. CLÁUSULA OITAVA – DA CONFIDENCIALIDADE

8.1 As partes se comprometem a manter em sigilo absoluto todas as informações confidenciais trocadas durante a execução do contrato, incluindo dados pessoais, comerciais e estratégicos.
8.2 Esta obrigação de confidencialidade permanecerá vigente por prazo indeterminado, mesmo após o término deste contrato.

9. CLÁUSULA NONA – DA RESCISÃO

9.1 Este contrato poderá ser rescindido por qualquer das partes mediante aviso prévio de 30 (trinta) dias, por escrito.
9.2 A CONTRATANTE somente poderá cancelar o contrato se não houver débitos pendentes com a CONTRATADA.
9.3 Em caso de rescisão antecipada por iniciativa da CONTRATANTE, não haverá devolução de valores já pagos referentes a serviços executados ou em andamento.

10. CLÁUSULA DÉCIMA – DAS CONDIÇÕES GERAIS

10.1 Fica pactuada entre as partes a prestação dos serviços de acompanhamento e vigilância do(s) processo(s) referentes à marca {{marca}}.
10.2 Durante a tramitação do processo junto ao INPI, poderão surgir situações que exijam a apresentação de documentos adicionais, os quais deverão ser providenciados pela CONTRATANTE em tempo hábil.
10.3 A CONTRATADA não se responsabiliza por decisões do INPI contrárias ao pedido de registro, desde que tenha cumprido integralmente suas obrigações contratuais.

11. CLÁUSULA DÉCIMA PRIMEIRA – DAS DISPOSIÇÕES FINAIS

11.1 Este contrato representa o acordo integral entre as partes, substituindo quaisquer negociações ou acordos anteriores, verbais ou escritos.
11.2 A tolerância de uma das partes quanto ao descumprimento de qualquer obrigação pela outra não implica novação ou renúncia de direitos.
11.3 Qualquer alteração deste contrato somente será válida se formalizada por escrito e assinada por ambas as partes.

12. CLÁUSULA DÉCIMA SEGUNDA – DO FORO

12.1 Para dirimir quaisquer dúvidas ou controvérsias oriundas do presente instrumento, as partes elegem o Foro da Comarca de São Paulo – SP, com renúncia expressa a qualquer outro, por mais privilegiado que seja.

Por estarem justas e contratadas, as partes assinam o presente instrumento em 02 (duas) vias de igual teor e forma, na presença das testemunhas abaixo.

São Paulo, {{data_extenso}}.

_______________________________
WEB MARCAS PATENTES EIRELI
CNPJ: 39.528.012/0001-29

_______________________________
{{nome_cliente}}
CPF: {{cpf}}',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  true,
  '["{{nome_cliente}}", "{{cpf}}", "{{email}}", "{{telefone}}", "{{marca}}", "{{ramo_atividade}}", "{{endereco_completo}}", "{{razao_social_ou_nome}}", "{{dados_cnpj}}", "{{forma_pagamento_detalhada}}", "{{data_extenso}}"]'::jsonb
);