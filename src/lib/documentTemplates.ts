import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DocumentVariables {
  nome_empresa: string;
  cnpj: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
  nome_representante: string;
  cpf_representante: string;
  email?: string;
  telefone?: string;
  marca?: string;
  data_distrato?: string;
  valor_multa?: string;
  numero_parcela?: string;
}

const formatDateExtended = (date: Date): string => {
  return format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
};

export function generateProcuracaoContent(vars: DocumentVariables): string {
  const dataHoje = formatDateExtended(new Date());
  
  return `OUTORGANTE:

${vars.nome_empresa}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${vars.cnpj}, com sede na ${vars.endereco}, ${vars.cidade} - ${vars.estado}, CEP ${vars.cep}, neste ato representada por ${vars.nome_representante}, portador(a) do CPF nº ${vars.cpf_representante}.

Pelo presente instrumento particular de PROCURAÇÃO, o(a) outorgante acima identificado(a) nomeia e constitui como seu bastante PROCURADOR o Sr. Davilys Danques de Oliveira Cunha, brasileiro, casado, portador do RG nº 50.688.779-0 e CPF nº 393.239.118-79, com endereço profissional na Av. Brigadeiro Luís Antônio, nº 2696, Centro, São Paulo - SP, para representá-lo(a) de forma exclusiva junto ao INSTITUTO NACIONAL DA PROPRIEDADE INDUSTRIAL – INPI, podendo praticar todos os atos necessários, legais e administrativos relacionados ao pedido, acompanhamento, defesa e manutenção do registro de marca, inclusive apresentação de requerimentos, cumprimento de exigências, interposição de recursos e recebimento de notificações.

A presente procuração é válida pelo prazo indeterminado, podendo ser revogada a qualquer tempo mediante comunicação expressa ao procurador.

São Paulo, ${dataHoje}.`;
}

export function generateDistratoComMultaContent(vars: DocumentVariables): string {
  const dataHoje = formatDateExtended(new Date());
  
  return `Pelo presente instrumento particular de distrato, de um lado:

I) WebMarcas Intelligence PI, pessoa jurídica de direito privado, inscrita no CNPJ/MF sob o Nº: 39.528.012/0001-29, com sede na cidade de SÃO PAULO, Estado de SP, na Av. Brigadeiro Luís Antônio, 2696 - andar 2, sala 202 - Jardim Paulista, CEP: 01402-000, doravante denominada CONTRATADA;

E, de outro lado:

II) ${vars.nome_empresa}, com sede na ${vars.endereco}, na cidade de ${vars.cidade}, estado de ${vars.estado}, CEP ${vars.cep}, inscrita no CNPJ sob nº ${vars.cnpj}, neste ato representada por ${vars.nome_representante}, CPF sob o nº ${vars.cpf_representante}, com endereço de e-mail para faturamento ${vars.email || ''} e Tel: ${vars.telefone || ''}, doravante denominada CONTRATANTE.

As partes acima qualificadas, em comum e recíproco acordo, resolvem, por este instrumento e na melhor forma de direito, DISTRATAR o Contrato de Prestação de Serviços celebrado para preparo de depósito de registro de marca junto ao INSTITUTO NACIONAL DA PROPRIEDADE INDUSTRIAL, referente à marca ${vars.marca || '[Nome da Marca]'}, bem como o acompanhamento e supervisão do processo até sua fase processual seguinte, doravante denominado "Contrato Original", mediante as cláusulas e condições seguintes:

CLÁUSULA PRIMEIRA – DO OBJETO DO DISTRATO E CONDIÇÕES DE RESCISÃO

1.1. O presente instrumento tem como objeto o distrato do Contrato Original, celebrado entre as partes, que tinha como fundamento a prestação de serviços de preparo e depósito de registro de marca junto ao INSTITUTO NACIONAL DA PROPRIEDADE INDUSTRIAL, referente à marca ${vars.marca || '[Nome da Marca]'}, bem como o acompanhamento e supervisão do processo até sua fase processual seguinte.

1.2. As partes, de forma livre e espontânea, e no pleno exercício de suas faculdades, declaram dissolver, a partir da data de assinatura deste distrato, todos os direitos e obrigações decorrentes do Contrato Original. Fica expressamente acordado que, em virtude do cancelamento, haverá um ônus financeiro correspondente ao valor de ${vars.numero_parcela || '1'} parcela(s) de R$ ${vars.valor_multa || '0,00'}. A falta de pagamento deste ônus implicará na cobrança do valor total do serviço contratado, sujeito a protesto e demais medidas legais cabíveis.

1.3. As partes declaram que, com a assinatura do presente distrato, o Contrato Original é considerado integralmente cumprido e extinto, ressalvadas as obrigações financeiras expressamente previstas neste instrumento, não havendo quaisquer outras pendências recíprocas, sejam elas financeiras, contratuais, ou de qualquer outra ordem, exceto as aqui estabelecidas.

1.4. Este Distrato passa a vigorar entre as partes a partir da data de sua assinatura, independentemente do estágio de desenvolvimento financeiro ou jurídico das partes.

CLÁUSULA SEGUNDA – DA QUITAÇÃO PLENA, IRREVOGÁVEL E IRRETRATÁVEL

2.1. A CONTRATANTE, por este ato, concede à CONTRATADA, e esta à CONTRATANTE, a mais ampla, geral, rasa, plena, irrevogável e irretratável quitação de todas e quaisquer obrigações, direitos, deveres, créditos, débitos, responsabilidades, indenizações, multas, penalidades, perdas e danos, de qualquer natureza, presentes ou futuras, decorrentes ou relacionadas ao Contrato Original, para nada mais reclamar, a qualquer título e a qualquer tempo, judicial ou extrajudicialmente, ressalvadas as obrigações financeiras expressamente estabelecidas na Cláusula Primeira deste distrato.

2.2. O presente distrato é celebrado em caráter irretratável e irrevogável, obrigando as partes por si, seus herdeiros e sucessores, a qualquer tempo e grau de desenvolvimento financeiro ou jurídico, não sendo admitida qualquer alegação de vício de consentimento, erro, dolo, coação, simulação ou fraude, para fins de sua anulação ou revisão.

CLÁUSULA TERCEIRA – DA VEDAÇÃO A RECLAMAÇÕES E MEDIDAS ADVERSAS

3.1. A CONTRATANTE, ao assinar o presente instrumento, reconhece e concorda expressamente que, em virtude da quitação plena, irrevogável e irretratável concedida na Cláusula Segunda, NÃO PODERÁ propor, iniciar, dar continuidade ou participar de qualquer tipo de reclamação, ação judicial, procedimento administrativo, queixa, denúncia, ou qualquer outra medida, de qualquer natureza, que vise a discutir, questionar, ou imputar responsabilidade à CONTRATADA, seus sócios, administradores, empregados, prepostos ou representantes, por fatos, atos ou omissões ocorridos durante a vigência ou em decorrência do Contrato Original, ressalvadas as obrigações financeiras expressamente estabelecidas na Cláusula Primeira deste distrato.

3.2. A CONTRATANTE se compromete a abster-se de qualquer conduta que possa, direta ou indiretamente, causar prejuízo à imagem, reputação, bom nome, ou quaisquer outros direitos da CONTRATADA, de seus sócios, administradores, empregados, prepostos ou representantes, sob pena de responder por perdas e danos, sem prejuízo das demais medidas legais cabíveis.

CLÁUSULA QUARTA – DA CONFIDENCIALIDADE

4.1. As partes comprometem-se a manter sigilo e confidencialidade sobre todas as informações e termos do presente distrato, bem como sobre quaisquer informações comerciais, técnicas ou estratégicas da outra parte, que tenham tido acesso em razão do Contrato Original e deste distrato, sob pena de responderem por perdas e danos.

CLÁUSULA QUINTA – DA INDEPENDÊNCIA DAS CLÁUSULAS

5.1. Caso qualquer disposição deste distrato seja considerada inválida, ilegal ou inexequível em qualquer jurisdição, tal invalidade, ilegalidade ou inexequibilidade não afetará a validade, legalidade ou exequibilidade das demais disposições deste distrato, nem a validade, legalidade ou exequibilidade de tal disposição em qualquer outra jurisdição.

CLÁUSULA SEXTA – DA LEGISLAÇÃO APLICÁVEL E ELEIÇÃO DE FORO

6.1. O presente distrato será regido e interpretado de acordo com as leis da República Federativa do Brasil.

6.2. Fica eleito o Foro da Comarca de São Paulo, Estado de São Paulo, para dirimir quaisquer dúvidas ou litígios oriundos do presente distrato, com expressa renúncia a qualquer outro, por mais privilegiado que seja.

Por estarem justas e contratadas, as partes assinam o presente de igual teor e forma, de forma digital válida juridicamente.

São Paulo, ${vars.data_distrato || dataHoje}.`;
}

export function generateDistratoSemMultaContent(vars: DocumentVariables): string {
  const dataHoje = formatDateExtended(new Date());
  
  return `Pelo presente instrumento particular de distrato, de um lado:

I) WebMarcas Intelligence PI, pessoa jurídica de direito privado, inscrita no CNPJ/MF sob o Nº: 39.528.012/0001-29, com sede na cidade de SÃO PAULO, Estado de SP, na Av. Brigadeiro Luís Antônio, 2696 - andar 2, sala 202 - Jardim Paulista, CEP: 01402-000, doravante denominada CONTRATADA;

E, de outro lado:

II) ${vars.nome_empresa}, com sede na ${vars.endereco}, na cidade de ${vars.cidade}, estado de ${vars.estado}, CEP ${vars.cep}, inscrita no CNPJ sob nº ${vars.cnpj}, neste ato representada por ${vars.nome_representante}, CPF sob o nº ${vars.cpf_representante}, com endereço de e-mail para faturamento ${vars.email || ''} e Tel: ${vars.telefone || ''}, doravante denominada CONTRATANTE.

As partes acima qualificadas, em comum e recíproco acordo, resolvem, por este instrumento e na melhor forma de direito, DISTRATAR o Contrato de Prestação de Serviços celebrado para preparo de depósito de registro de marca junto ao INSTITUTO NACIONAL DA PROPRIEDADE INDUSTRIAL, referente à marca ${vars.marca || '[Nome da Marca]'}, bem como o acompanhamento e supervisão do processo até sua fase processual seguinte, doravante denominado "Contrato Original", mediante as cláusulas e condições seguintes:

CLÁUSULA PRIMEIRA – DO OBJETO DO DISTRATO

1.1. O presente instrumento tem como objeto o distrato do Contrato Original, celebrado entre as partes, que tinha como fundamento a prestação de serviços de preparo e depósito de registro de marca junto ao INSTITUTO NACIONAL DA PROPRIEDADE INDUSTRIAL, referente à marca ${vars.marca || '[Nome da Marca]'}, bem como o acompanhamento e supervisão do processo até sua fase processual seguinte.

1.2. As partes, de forma livre e espontânea, e no pleno exercício de suas faculdades, declaram dissolver, a partir da data de assinatura deste distrato, todos os direitos e obrigações decorrentes do Contrato Original, de modo que não subsistam quaisquer resquícios de ônus financeiro, obrigacional, ou de qualquer outra natureza, relativos ao referido contrato.

CLÁUSULA SEGUNDA – DA QUITAÇÃO PLENA, IRREVOGÁVEL E IRRETRATÁVEL

2.1. A CONTRATANTE, por este ato, concede à CONTRATADA, e esta à CONTRATANTE, a mais ampla, geral, rasa, plena, irrevogável e irretratável quitação de todas e quaisquer obrigações, direitos, deveres, créditos, débitos, responsabilidades, indenizações, multas, penalidades, perdas e danos, de qualquer natureza, presentes ou futuras, decorrentes ou relacionadas ao Contrato Original, para nada mais reclamar, a qualquer título e a qualquer tempo, judicial ou extrajudicialmente.

2.2. As partes declaram, expressamente, que, com a assinatura do presente distrato, o Contrato Original é considerado integralmente cumprido e extinto, não havendo quaisquer pendências recíprocas, sejam elas financeiras, contratuais, ou de qualquer outra ordem.

2.3. O presente distrato é celebrado em caráter irretratável e irrevogável, obrigando as partes por si, seus herdeiros e sucessores, a qualquer tempo e grau de desenvolvimento financeiro ou jurídico, não sendo admitida qualquer alegação de vício de consentimento, erro, dolo, coação, simulação ou fraude, para fins de sua anulação ou revisão.

CLÁUSULA TERCEIRA – DA VEDAÇÃO A RECLAMAÇÕES E MEDIDAS ADVERSAS

3.1. A CONTRATANTE, ao assinar o presente instrumento, reconhece e concorda expressamente que, em virtude da quitação plena, irrevogável e irretratável concedida na Cláusula Segunda, NÃO PODERÁ propor, iniciar, dar continuidade ou participar de qualquer tipo de reclamação, ação judicial, procedimento administrativo, queixa, denúncia, ou qualquer outra medida, de qualquer natureza, que vise a discutir, questionar, ou imputar responsabilidade à CONTRATADA, seus sócios, administradores, empregados, prepostos ou representantes, por fatos, atos ou omissões ocorridos durante a vigência ou em decorrência do Contrato Original.

3.2. A CONTRATANTE se compromete a abster-se de qualquer conduta que possa, direta ou indiretamente, causar prejuízo à imagem, reputação, bom nome, ou quaisquer outros direitos da CONTRATADA, de seus sócios, administradores, empregados, prepostos ou representantes, sob pena de responder por perdas e danos, sem prejuízo das demais medidas legais cabíveis.

CLÁUSULA QUARTA – DA CONFIDENCIALIDADE

4.1. As partes comprometem-se a manter sigilo e confidencialidade sobre todas as informações e termos do presente distrato, bem como sobre quaisquer informações comerciais, técnicas ou estratégicas da outra parte, que tenham tido acesso em razão do Contrato Original e deste distrato, sob pena de responderem por perdas e danos.

CLÁUSULA QUINTA – DA INDEPENDÊNCIA DAS CLÁUSULAS

5.1. Caso qualquer disposição deste distrato seja considerada inválida, ilegal ou inexequível em qualquer jurisdição, tal invalidade, ilegalidade ou inexequibilidade não afetará a validade, legalidade ou exequibilidade das demais disposições deste distrato, nem a validade, legalidade ou exequibilidade de tal disposição em qualquer outra jurisdição.

CLÁUSULA SEXTA – DA LEGISLAÇÃO APLICÁVEL E ELEIÇÃO DE FORO

6.1. O presente distrato será regido e interpretado de acordo com as leis da República Federativa do Brasil.

6.2. Fica eleito o Foro da Comarca de São Paulo, Estado de São Paulo, para dirimir quaisquer dúvidas ou litígios oriundos do presente distrato, com expressa renúncia a qualquer outro, por mais privilegiado que seja.

Por estarem justas e contratadas, as partes assinam o presente de igual teor e forma, de forma digital válida juridicamente.

São Paulo, ${vars.data_distrato || dataHoje}.`;
}

export function generateDocumentContent(
  documentType: 'procuracao' | 'distrato_multa' | 'distrato_sem_multa',
  vars: DocumentVariables
): string {
  switch (documentType) {
    case 'procuracao':
      return generateProcuracaoContent(vars);
    case 'distrato_multa':
      return generateDistratoComMultaContent(vars);
    case 'distrato_sem_multa':
      return generateDistratoSemMultaContent(vars);
    default:
      return '';
  }
}
