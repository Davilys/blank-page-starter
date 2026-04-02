import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  indeferimento: 'RECURSO CONTRA INDEFERIMENTO',
  exigencia_merito: 'CUMPRIMENTO DE EXIGÊNCIA DE MÉRITO / RECURSO ADMINISTRATIVO',
  oposicao: 'MANIFESTAÇÃO À OPOSIÇÃO',
  notificacao_extrajudicial: 'NOTIFICAÇÃO EXTRAJUDICIAL',
  resposta_notificacao_extrajudicial: 'RESPOSTA A NOTIFICAÇÃO EXTRAJUDICIAL',
  troca_procurador: 'PETIÇÃO DE TROCA DE PROCURADOR',
  nomeacao_procurador: 'PETIÇÃO DE NOMEAÇÃO DE PROCURADOR'
};

// ═══════════════════════════════════════════════════════════
// HELPER: Call OpenAI Responses API
// ═══════════════════════════════════════════════════════════
async function callOpenAI(
  apiKey: string,
  systemPrompt: string,
  userParts: any[],
  maxTokens: number = 16000
): Promise<{ content: string; error?: string; status?: number }> {
  const inputMessages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userParts },
  ];

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-2024-11-20',
      input: inputMessages,
      max_output_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI API error:', response.status, errorText.substring(0, 500));
    return { content: '', error: errorText, status: response.status };
  }

  const data = await response.json();
  let content = '';
  if (data.output && Array.isArray(data.output)) {
    for (const item of data.output) {
      if (item.type === 'message' && item.content) {
        for (const part of item.content) {
          if (part.type === 'output_text') {
            content += part.text;
          }
        }
      }
    }
  }

  return { content };
}

// ═══════════════════════════════════════════════════════════
// HELPER: Convert file parts to Responses API format
// ═══════════════════════════════════════════════════════════
function convertToResponsesFormat(userContent: any[]): any[] {
  const parts: any[] = [];
  for (const part of userContent) {
    if (part.type === 'text') {
      parts.push({ type: 'input_text', text: part.text });
    } else if (part.type === 'file') {
      parts.push({
        type: 'input_file',
        filename: part.file.filename,
        file_data: part.file.file_data,
      });
    } else if (part.type === 'image_url') {
      parts.push({
        type: 'input_image',
        image_url: part.image_url.url,
        detail: 'high',
      });
    }
  }
  return parts;
}

// ═══════════════════════════════════════════════════════════
// HELPER: Clean AI response
// ═══════════════════════════════════════════════════════════
function cleanAIContent(raw: string): string {
  let cleaned = raw;
  
  // Remove markdown code blocks
  cleaned = cleaned.replace(/```json[\s\S]*?```/g, '');
  cleaned = cleaned.replace(/```plaintext/g, '');
  cleaned = cleaned.replace(/```/g, '');
  
  // Remove introductory AI text before the actual resource
  const startPatterns = [
    /RECURSO ADMINISTRATIVO/,
    /EXCELENTÍSSIMO SENHOR/,
    /NOTIFICAÇÃO EXTRAJUDICIAL/,
    /PETIÇÃO DE/,
    /MANIFESTAÇÃO/,
  ];
  
  for (const pattern of startPatterns) {
    const match = cleaned.match(pattern);
    if (match && match.index && match.index > 0) {
      const before = cleaned.substring(0, match.index);
      if (/para elaborar|extraímos|abaixo|apresento|análise detalhada|dados extraídos|informações necessárias|segue|elaborei|conforme solicitado/i.test(before)) {
        cleaned = cleaned.substring(match.index);
      }
      break;
    }
  }
  
  // Remove embedded JSON dumps
  cleaned = cleaned.replace(/Dados Extraídos\s*\{[\s\S]*?\}\s*\}/g, '');
  cleaned = cleaned.replace(/\{\s*"extracted_?data"[\s\S]*?\}\s*\}/g, '');
  
  // Clean up multiple blank lines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
  
  return cleaned;
}

// ═══════════════════════════════════════════════════════════
// HELPER: Build mandatory opening block deterministically
// ═══════════════════════════════════════════════════════════
function buildMandatoryOpeningBlock(
  resourceTypeLabel: string,
  data: {
    process_number?: string;
    brand_name?: string;
    ncl_class?: string;
    holder?: string;
    examiner_or_opponent?: string;
  }
): string {
  const brandUpper = (data.brand_name || 'N/I').toUpperCase();
  const processNum = (data.process_number || 'N/I').replace(/[^\d./-]/g, '').trim() || 'N/I';
  const brandLine = data.brand_name
    ? `${data.brand_name}${/nominativ|mist|figurativ/i.test(data.ncl_class || '') ? '' : ' (nominativa)'}`
    : 'N/I';
  const nclClass = data.ncl_class || 'N/I';
  const holder = data.holder || 'N/I';
  const examinerOrOpponent = data.examiner_or_opponent || 'N/I';
  const isOposicao = /OPOSIÇÃO/i.test(resourceTypeLabel);
  const personLabel = isOposicao ? 'Oponente' : 'Examinador(a)';

  return `RECURSO ADMINISTRATIVO – ${resourceTypeLabel}

MARCA: ${brandUpper}

EXCELENTÍSSIMO SENHOR PRESIDENTE DA DIRETORIA DE MARCAS,
PATENTES E DESENHOS INDUSTRIAIS DO INSTITUTO NACIONAL
DA PROPRIEDADE INDUSTRIAL – INPI

Processo INPI nº: ${processNum}
Marca: ${brandLine}
Classe NCL (12ª Ed.): ${nclClass}
Titular/Requerente: ${holder}
${personLabel}: ${examinerOrOpponent}
Procurador: Davilys Danques de Oliveira Cunha – CPF 393.239.118-79`;
}

// ═══════════════════════════════════════════════════════════
// HELPER: Extract body starting from Section I
// ═══════════════════════════════════════════════════════════
function extractBodyFromSectionI(content: string): string {
  // Find the first section marker (I – ..., I. ..., I - ...)
  const sectionMatch = content.match(/\n\s*(I\s*[–—\-\.]\s*)/);
  if (sectionMatch && sectionMatch.index !== undefined) {
    return content.substring(sectionMatch.index).trim();
  }
  // Fallback: try to find "SÍNTESE" or "HISTÓRICO"
  const fallback = content.match(/\n\s*(I\s*[–—\-\.]\s*SÍNTESE|SÍNTESE DOS FATOS)/i);
  if (fallback && fallback.index !== undefined) {
    return content.substring(fallback.index).trim();
  }
  // Last resort: return as-is
  return content;
}

// ═══════════════════════════════════════════════════════════
// HELPER: Enforce mandatory opening on final content
// ═══════════════════════════════════════════════════════════
function enforceMandatoryOpening(
  content: string,
  resourceTypeLabel: string,
  data: {
    process_number?: string;
    brand_name?: string;
    ncl_class?: string;
    holder?: string;
    examiner_or_opponent?: string;
  }
): string {
  const header = buildMandatoryOpeningBlock(resourceTypeLabel, data);
  const body = extractBodyFromSectionI(content);
  return `${header}\n\n${body}`;
}

// ═══════════════════════════════════════════════════════════
// HELPER: Try to extract metadata from AI-generated text as fallback
// ═══════════════════════════════════════════════════════════
function enrichExtractedData(
  data: { process_number?: string; brand_name?: string; ncl_class?: string; holder?: string; examiner_or_opponent?: string },
  content: string
): typeof data {
  const enriched = { ...data };
  if (!enriched.process_number || enriched.process_number === 'N/I') {
    const m = content.match(/Processo\s*(?:INPI\s*)?n[ºo°]?\s*:?\s*([\d.\/-]+)/i);
    if (m) enriched.process_number = m[1].trim();
  }
  if (!enriched.brand_name || enriched.brand_name === 'N/I') {
    const m = content.match(/Marca:\s*([^\n(]+)/i);
    if (m) enriched.brand_name = m[1].trim();
  }
  if (!enriched.ncl_class || enriched.ncl_class === 'N/I') {
    const m = content.match(/Classe\s*NCL[^:]*:\s*([^\n]+)/i);
    if (m) enriched.ncl_class = m[1].trim();
  }
  if (!enriched.holder || enriched.holder === 'N/I') {
    const m = content.match(/(?:Titular|Requerente)[^:]*:\s*([^\n]+)/i);
    if (m) enriched.holder = m[1].trim();
  }
  if (!enriched.examiner_or_opponent || enriched.examiner_or_opponent === 'N/I') {
    const m = content.match(/(?:Oponente|Citante|Examinador(?:a)?)[^:]*:\s*([^\n]+)/i);
    if (m) enriched.examiner_or_opponent = m[1].trim();
  }
  return enriched;
}

// ═══════════════════════════════════════════════════════════
// AGENT IDENTITY STRINGS (for two-pass prompts)
// ═══════════════════════════════════════════════════════════
function getAgentIdentity(agentName?: string, agentStrategy?: string): string {
  if (!agentName && !agentStrategy) return '';

  return `
#identidade_do_agente
AGENTE: ${agentName || 'Padrão'}

${agentStrategy ? `#estrategia_obrigatoria_do_agente
APLIQUE A ESTRATÉGIA ABAIXO em TODAS as seções. Cada parágrafo deve refletir o TOM, ESTILO e TÉCNICAS deste agente:
${agentStrategy}` : ''}
`;
}

// ═══════════════════════════════════════════════════════════
// CORE LEGAL KNOWLEDGE (shared across both passes)
// ═══════════════════════════════════════════════════════════
const LEGAL_KNOWLEDGE = `
#protocolo_jurisprudencia_webmarcas

⚠️ PROTOCOLO OBRIGATÓRIO DE USO DE JURISPRUDÊNCIA — PADRÃO WEBMARCAS ⚠️

REGRA 1 — PROIBIÇÃO ABSOLUTA DE JURISPRUDÊNCIA FICTÍCIA:
- É TERMINANTEMENTE PROIBIDO inventar jurisprudência
- É PROIBIDO adaptar trechos sem fonte real verificável
- Qualquer jurisprudência inventada INVALIDA toda a peça processual

REGRA 2 — HIERARQUIA DE ARGUMENTAÇÃO:
1º) Lei da Propriedade Industrial (Lei 9.279/96) — FUNDAMENTO PRINCIPAL
2º) Manual de Marcas do INPI (Resolução INPI/PR nº 288/2023) — FUNDAMENTO PRINCIPAL
3º) Portarias e Resoluções do INPI — COMPLEMENTAR
4º) Doutrina: Denis Borges Barbosa, J. da Gama Cerqueira, Tinoco Soares — REFORÇO
5º) Jurisprudência — APENAS REFORÇO COMPLEMENTAR

REGRA 3 — PRECEDENTES PRÉ-VALIDADOS (REAIS E VERIFICÁVEIS):
STJ:
- REsp 1.188.105/RJ — coexistência em segmentos diversos (Min. Luis Felipe Salomão, 4ª Turma)
- REsp 1.315.621/SP — convivência marcária e especialidade (Min. Nancy Andrighi, 3ª Turma)
- REsp 862.117/RJ — segmento diverso como fator de convivência (Min. Ari Pargendler)
- REsp 1.166.498/RJ — distinção suficiente no conjunto (Min. Nancy Andrighi)
- REsp 1.095.362/SP — convivência pacífica como prova (Min. Massami Uyeda)
- AgRg no REsp 1.346.089/RJ — impressão de conjunto vs. elementos isolados
- AgRg no REsp 1.255.654/RJ — coexistência e não-confusão
- REsp 1.032.014/RS — marca fraca e convivência (Min. Nancy Andrighi)
- REsp 949.514/RJ — princípio da especialidade (Min. Fernando Gonçalves)
- REsp 1.340.933/SP — notoriedade e diluição
- EREsp 1.403.979/PR — trade dress e concorrência desleal

TRF-2 (2ª Turma Especializada):
- Apelação 0800858-92.2014.4.02.5101 — reforma de indeferimento
- Apelação 0004389-61.2009.4.02.5101 — coexistência em classes distintas
- Apelação 0096695-18.2017.4.02.5101 — erro de análise comparativa do INPI
- Agravo 0501803-49.2019.4.02.5101 — falha na fundamentação

TRF-3:
- Apelação 5003471-64.2019.4.03.6100 — nulidade por falta de confusão efetiva
- Apelação 0013264-04.2011.4.03.6100 — princípio da especialidade

⚠️ Qualquer precedente fora desta lista só pode ser citado se você tiver CERTEZA ABSOLUTA de sua existência real.
Se houver QUALQUER dúvida → NÃO CITAR → substituir por fundamentação legal direta.

#legislacao_dominio
- Lei da Propriedade Industrial (Lei nº 9.279/96) — todos os artigos
- Convenção da União de Paris (CUP) — arts. 6bis, 6ter, 6quinquies
- Acordo TRIPS/OMC — arts. 15 a 21
- Manual de Marcas do INPI (Resolução INPI/PR nº 288/2023)
- Classificação Internacional de Nice (12ª edição)

#doutrina_autorizada
- Denis Borges Barbosa — "Uma Introdução à Propriedade Intelectual" (2ª ed.) e "Proteção das Marcas"
- J. da Gama Cerqueira — "Tratado da Propriedade Industrial" (vol. II, tomo I)
- Lélio Denicoli Schmidt — "Marcas em Semiótica"
- Carlos Alberto Bittar — "Teoria e Prática da Propriedade Industrial"
- Tinoco Soares — "Lei de Patentes, Marcas e Direitos Conexos"
`;

// ═══════════════════════════════════════════════════════════
// NOTIFICAÇÃO EXTRAJUDICIAL PROMPT (unchanged from original logic)
// ═══════════════════════════════════════════════════════════
function buildNotificacaoPrompt(
  currentDate: string,
  notificanteData: any,
  notificadoData: any,
  userInstructions: string,
  agentStrategy?: string,
  agentName?: string
): string {
  return `#instruction

Você é um ADVOGADO ESPECIALISTA EM PROPRIEDADE INDUSTRIAL de ELITE,
com décadas de atuação em DEFESA DE MARCAS E NOTIFICAÇÕES EXTRAJUDICIAIS.
Elabore uma NOTIFICAÇÃO EXTRAJUDICIAL COMPLETA, ROBUSTA E JURIDICAMENTE VIÁVEL.

IMPORTANTE: Este documento NÃO é recurso administrativo no INPI.
É NOTIFICAÇÃO EXTRAJUDICIAL dirigida diretamente ao INFRATOR.
NÃO inclua "Pede deferimento", nem referências ao INPI como destinatário.

O documento deve ter NO MÍNIMO 4.000 palavras (equivalente a 10+ páginas).
Cada seção deve ser desenvolvida com MÁXIMA PROFUNDIDADE.

#dados_das_partes

NOTIFICANTE: ${notificanteData.nome || 'N/I'} | CPF/CNPJ: ${notificanteData.cpf_cnpj || 'N/I'} | Endereço: ${notificanteData.endereco || 'N/I'}
Marca: ${notificanteData.marca || 'N/I'} | Processo INPI: ${notificanteData.processo_inpi || 'N/I'} | Registro: ${notificanteData.registro_marca || 'N/I'}

NOTIFICADO: ${notificadoData.nome || 'N/I'} | CPF/CNPJ: ${notificadoData.cpf_cnpj || 'N/I'} | Endereço: ${notificadoData.endereco || 'N/I'}

#instrucoes_usuario
${userInstructions || 'Elabore a notificação com base nos dados fornecidos.'}

#identidade_institucional
WEBMARCAS INTELLIGENCE PI™ | CNPJ: 39.528.012/0001-29
Av. Brigadeiro Luiz Antônio, 2696, Centro — São Paulo/SP — CEP 01402-000
Tel: (11) 9 1112-0225 | E-mail: juridico@webmarcas.net | Site: www.webmarcas.net

ENCERRAMENTO: São Paulo, ${currentDate} — Davilys Danques de Oliveira Cunha, Procurador (SEM CPF, SEM "Pede deferimento")

${LEGAL_KNOWLEDGE}

${getAgentIdentity(agentName, agentStrategy)}

Responda APENAS com o texto completo da notificação (mínimo 4.000 palavras). SEM JSON. SEM explicações. Apenas o documento jurídico.`;
}

// ═══════════════════════════════════════════════════════════
// PROCURADOR PROMPT (unchanged from original logic)
// ═══════════════════════════════════════════════════════════
function buildProcuradorPrompt(
  currentDate: string,
  procuradorData: any,
  resourceType: string,
  agentStrategy?: string,
  agentName?: string
): string {
  const isTroca = resourceType === 'troca_procurador';
  const tipoLabel = isTroca ? 'TROCA DE PROCURADOR' : 'NOMEAÇÃO DE PROCURADOR';

  return `#instruction

Você é um ADVOGADO ESPECIALISTA em PROPRIEDADE INDUSTRIAL de ELITE.
Elabore uma PETIÇÃO DE ${tipoLabel} COMPLETA e ROBUSTA para protocolo no INPI.
O documento deve ter NO MÍNIMO 2.500 palavras.

#dados
TITULAR: ${procuradorData.titular || 'N/I'} | CPF/CNPJ: ${procuradorData.cpf_cnpj_titular || 'N/I'}
Marca: ${procuradorData.marca || 'N/I'} | Processo INPI: ${procuradorData.processo_inpi || 'N/I'} | NCL: ${procuradorData.ncl_class || 'N/I'}
${isTroca ? `PROCURADOR ANTERIOR: ${procuradorData.procurador_antigo || 'N/I'}` : ''}
NOVO PROCURADOR: Davilys Danques de Oliveira Cunha | CPF: 393.239.118-79 | RG: 50.688.779-0
Endereço: Av. Brigadeiro Luís Antônio, Nº 2696 - Centro, São Paulo/SP - CEP 01402-000

MOTIVO: ${procuradorData.motivo || 'N/I'}

#identidade_institucional
WEBMARCAS INTELLIGENCE PI™ | CNPJ: 39.528.012/0001-29

${getAgentIdentity(agentName, agentStrategy)}

Responda APENAS com o texto completo da petição. SEM JSON. SEM explicações. Apenas o documento jurídico.`;
}

// ═══════════════════════════════════════════════════════════
// TWO-PASS SYSTEM: PASS 1 — Sections I to IV
// ═══════════════════════════════════════════════════════════
function buildPass1SystemPrompt(
  resourceTypeLabel: string,
  currentDate: string,
  agentName?: string,
  agentStrategy?: string
): string {
  return `#instruction

Você é um ADVOGADO ESPECIALISTA EM PROPRIEDADE INDUSTRIAL de ELITE.
Você está elaborando a PRIMEIRA PARTE (Seções I a IV) de um RECURSO ADMINISTRATIVO
de ALTÍSSIMO NÍVEL JURÍDICO, no padrão dos melhores escritórios de PI do Brasil.

⚠️ REGRAS ABSOLUTAS:
- JAMAIS inventar fatos, decisões ou jurisprudência
- JAMAIS simplificar ou superficializar a argumentação
- CADA seção DEVE ter a extensão MÍNIMA especificada
- A argumentação deve ser DENSA, PROFUNDA e ESPECÍFICA ao caso concreto
- DESENVOLVA cada argumento em MÚLTIPLOS PARÁGRAFOS com fundamentação robusta
- O recurso TOTAL terá entre 10 e 20 páginas — esta é a PRIMEIRA METADE

#tipo_recurso: ${resourceTypeLabel}

${LEGAL_KNOWLEDGE}

${getAgentIdentity(agentName, agentStrategy)}

#estrutura_obrigatoria_parte_1

COMECE O DOCUMENTO COM:

═══════════════════════════════════════════════════════════
RECURSO ADMINISTRATIVO – ${resourceTypeLabel}
MARCA: [NOME DA MARCA EXTRAÍDO DO PDF]
═══════════════════════════════════════════════════════════

EXCELENTÍSSIMO SENHOR PRESIDENTE DA DIRETORIA DE MARCAS,
PATENTES E DESENHOS INDUSTRIAIS DO INSTITUTO NACIONAL
DA PROPRIEDADE INDUSTRIAL – INPI

Processo INPI nº: [extraído]
Marca: [extraído + natureza]
Classe NCL (12ª Ed.): [extraído + especificação completa]
Titular/Requerente: [extraído]
Oponente/Citante: [quando identificável]
Procurador: Davilys Danques de Oliveira Cunha – CPF 393.239.118-79

═══════════════════════════════════════════════════════════

I – SÍNTESE DOS FATOS E DO HISTÓRICO PROCESSUAL
(MÍNIMO 800 palavras — NÃO ENCURTE)
- Narrar CRONOLOGICAMENTE todo o histórico do processo em detalhes minuciosos
- Transcrever trechos relevantes do despacho/decisão do INPI
- Explicar detalhadamente o fundamento usado pelo INPI (artigo, inciso, alínea)
- Contextualizar a decisão no panorama administrativo do INPI
- Identificar TODOS os fatos relevantes do caso
- Descrever a marca, seu significado, sua origem e sua importância para o titular
- Narrar tentativas anteriores de registro se houver
- Detalhar a especificação de produtos/serviços

II – DA TEMPESTIVIDADE E LEGITIMIDADE
(MÍNIMO 300 palavras)
- Demonstrar tempestividade (prazo art. 212 LPI)
- Confirmar legitimidade do recorrente com citação legal completa
- Citar art. 212 e parágrafos da Lei 9.279/96 com transcrição do dispositivo
- Mencionar recolhimento da GRU código 271
- Demonstrar capacidade postulatória do procurador constituído
- Citar a IN INPI aplicável sobre representação

III – FUNDAMENTAÇÃO JURÍDICA APROFUNDADA
(MÍNIMO 1.500 palavras — SEÇÃO MAIS IMPORTANTE — DESENVOLVA EXTENSIVAMENTE)
- Analisar DETALHADAMENTE CADA fundamento utilizado pelo INPI na decisão
- Demonstrar com precisão POR QUE a decisão está equivocada
- Transcrever TEXTUALMENTE cada artigo da LPI aplicável com análise de cada inciso
- Aplicar doutrina de Denis Borges Barbosa com citação de obra e páginas
- Aplicar doutrina de J. da Gama Cerqueira com citação específica
- Aplicar Tinoco Soares quando pertinente
- Demonstrar como o Manual de Marcas do INPI fundamenta a tese do recurso
- Citar capítulos e seções específicos do Manual de Marcas (5.10, 5.11, etc.)
- Analisar CADA inciso do art. 124 invocado pelo INPI e REFUTAR com argumentos sólidos
- Desenvolver sub-argumentos em parágrafos densos
- Fazer análise comparativa com casos análogos deferidos pelo INPI
- Demonstrar que a interpretação do INPI é restritiva ou contra a própria normativa

IV – ANÁLISE TÉCNICA DO CONJUNTO MARCÁRIO
(MÍNIMO 1.200 palavras — DESENVOLVA EXTENSIVAMENTE)
- IMPRESSÃO DE CONJUNTO: fundamentar com Manual de Marcas INPI (Cap. 5, Seção 5.10.1)
- ANÁLISE FONÉTICA DETALHADA: pronúncia sílaba a sílaba, número de sílabas, tonicidade, sonoridade, cadência rítmica, comparação fonema por fonema
- ANÁLISE VISUAL DETALHADA: grafismo, tipografia, elementos figurativos, cores, disposição espacial, peso visual, estilização
- ANÁLISE IDEOLÓGICA/CONCEITUAL: significado semântico, campo conceitual, associação mental, evocação, origem etimológica, referência cultural
- ANÁLISE DE MERCADO: segmentos diferentes, canais de venda distintos, público-alvo diferenciado, faixa de preço, forma de comercialização
- Teoria da Distância (Abstandslehre) aplicada ao caso
- TABELA COMPARATIVA detalhada: coluna marca requerente vs. marca citada com análise ponto a ponto
- Conclusão parcial demonstrando distinção suficiente

⚠️ RESPONDA APENAS com o texto jurídico completo das Seções I a IV. SEM JSON. SEM explicações. SEM markdown. Apenas o texto jurídico profissional.
⚠️ NÃO termine com "continuação na próxima parte" ou similar — termine a Seção IV normalmente.
⚠️ O texto desta parte deve ter NO MÍNIMO 3.800 palavras.`;
}

// ═══════════════════════════════════════════════════════════
// TWO-PASS SYSTEM: PASS 2 — Sections V to VIII + closing
// ═══════════════════════════════════════════════════════════
function buildPass2SystemPrompt(
  resourceTypeLabel: string,
  currentDate: string,
  agentName?: string,
  agentStrategy?: string
): string {
  return `#instruction

Você é um ADVOGADO ESPECIALISTA EM PROPRIEDADE INDUSTRIAL de ELITE.
Você está elaborando a SEGUNDA PARTE (Seções V a VIII + encerramento) de um RECURSO ADMINISTRATIVO
de ALTÍSSIMO NÍVEL JURÍDICO, no padrão dos melhores escritórios de PI do Brasil.

O usuário já gerou as Seções I a IV. Agora você deve continuar com as Seções V a VIII + encerramento.

⚠️ REGRAS ABSOLUTAS:
- JAMAIS inventar fatos, decisões ou jurisprudência
- JAMAIS simplificar a argumentação — cada seção deve ser EXTENSA e DENSA
- MANTENHA o mesmo tom, estilo e nível de profundidade da Parte 1
- USE os dados do caso (marca, processo, classe, titular) conforme apresentados na Parte 1
- CADA seção DEVE ter a extensão MÍNIMA especificada

#tipo_recurso: ${resourceTypeLabel}

${LEGAL_KNOWLEDGE}

${getAgentIdentity(agentName, agentStrategy)}

#estrutura_obrigatoria_parte_2

CONTINUE DIRETAMENTE com a Seção V (sem repetir cabeçalho):

V – DA INEXISTÊNCIA DE CONFUSÃO OU ASSOCIAÇÃO INDEVIDA
(MÍNIMO 1.000 palavras — DESENVOLVA EXTENSIVAMENTE)
- Demonstrar TECNICAMENTE que não há risco de confusão para o consumidor
- Aplicar a Teoria da Distância com profundidade — demonstrar distância suficiente
- Diferenciar o público consumidor (médio vs. especializado) com detalhamento
- Citar exemplos concretos de convivência no mercado (se aplicável)
- Aplicar o "teste do consumidor distraído" conforme jurisprudência do STJ
- Analisar a força distintiva dos elementos em cotejo (fraco vs. dominante)
- Demonstrar que elementos comuns são de uso corrente/genérico e não geram exclusividade
- Discutir o conceito de "marca fraca" e suas implicações (REsp 1.032.014/RS)
- Analisar se há possibilidade de diluição ou parasitismo — e refutar
- Demonstrar a convivência pacífica em outros registros do INPI
- Invocar o princípio da especialidade com análise detalhada das classes NCL

VI – DOS PRECEDENTES, DOUTRINA E JURISPRUDÊNCIA APLICÁVEL
(MÍNIMO 1.200 palavras — DESENVOLVA COM MÁXIMA PROFUNDIDADE)
⚠️ JURISPRUDÊNCIA É REFORÇO COMPLEMENTAR — fundamentação principal é LPI + Manual INPI
- Citar APENAS precedentes da LISTA PRÉ-VALIDADA ou que tenha CERTEZA ABSOLUTA
- Para CADA precedente citado: tribunal, número completo, relator, síntese FIEL da tese, e explicação de POR QUE se aplica ao caso
- Organizar por TESE: especialidade, conjunto marcário, convivência, boa-fé, marca fraca
- Desenvolver análise doutrinária APROFUNDADA:
  * Denis Borges Barbosa: teoria da marca fraca, princípio da especialidade, limites da exclusividade
  * Gama Cerqueira: registro e proteção, critérios de confusão
  * Tinoco Soares: análise comparativa de marcas
- Citar e transcrever trechos relevantes das obras doutrinárias
- Análise de direito comparado: como EUIPO e USPTO tratam casos similares
- Concluir demonstrando que a jurisprudência e doutrina CONVERGEM para o deferimento

VII – DA CONCLUSÃO E DEMONSTRAÇÃO DE REGISTRABILIDADE
(MÍNIMO 800 palavras)
- Sintetizar TODOS os argumentos das 6 seções anteriores
- Demonstrar OBJETIVAMENTE a registrabilidade da marca em lista numerada
- Reforçar que o indeferimento/exigência é contrário à lei, doutrina e jurisprudência
- Demonstrar o PREJUÍZO causado ao titular pelo indeferimento
- Invocar princípios da RAZOABILIDADE e PROPORCIONALIDADE (art. 5º, LIV, CF)
- Invocar LIVRE INICIATIVA (art. 170, CF/88)
- Demonstrar que o INPI, em casos análogos, deferiu marcas com semelhança igual ou maior
- Conclusão enfática pela reforma da decisão

VIII – DOS PEDIDOS
(MÍNIMO 400 palavras — pedidos ESPECÍFICOS e detalhados)

Ante o exposto, requer:

a) Seja CONHECIDO o presente recurso administrativo, por tempestivo e regular, conforme art. 212 e parágrafos da Lei nº 9.279/96;
b) No mérito, seja PROVIDO o recurso, para REFORMAR integralmente a decisão recorrida de [descrever a decisão], publicada na RPI nº [se identificável];
c) Seja DEFERIDO o registro da marca [NOME DA MARCA] na classe NCL [CLASSE] — [ESPECIFICAÇÃO COMPLETA DOS PRODUTOS/SERVIÇOS], conforme especificação originalmente requerida;
d) Subsidiariamente, caso assim não se entenda, seja a marca deferida com limitação de especificação aos produtos/serviços diretamente vinculados à atividade do titular, nos termos do art. 128, §1º da LPI;
e) Ainda subsidiariamente, seja determinada a CONVERSÃO DO JULGAMENTO EM DILIGÊNCIA para melhor instrução do feito, nos termos do art. 220 da LPI;
f) Seja determinada a publicação do deferimento na Revista da Propriedade Industrial (RPI), para fins de oposição tempestiva;
g) Sejam considerados todos os documentos e provas juntados a este recurso como parte integrante da fundamentação;

Protesta provar o alegado por todos os meios de prova em direito admitidos, especialmente documental e pericial.

#encerramento_obrigatorio

Nestes termos,
Pede e espera deferimento.

São Paulo, ${currentDate}.

_______________________________________
Davilys Danques de Oliveira Cunha
Procurador(a) Constituído(a)
CPF: 393.239.118-79

⚠️ RESPONDA APENAS com o texto jurídico das Seções V a VIII + encerramento. SEM JSON. SEM explicações. SEM markdown. Apenas o texto jurídico profissional.
⚠️ O texto desta parte deve ter NO MÍNIMO 3.400 palavras.`;
}

// ═══════════════════════════════════════════════════════════
// EXTRACT DATA PROMPT (quick extraction call)
// ═══════════════════════════════════════════════════════════
function buildExtractionPrompt(): string {
  return `Extraia os seguintes dados do documento INPI anexado. Responda APENAS com JSON válido:
{
  "process_number": "número do processo INPI",
  "brand_name": "nome da marca",
  "ncl_class": "classe NCL com descrição",
  "holder": "nome do titular/requerente",
  "examiner_or_opponent": "oponente ou examinador identificado",
  "legal_basis": "fundamento legal usado pelo INPI na decisão"
}`;
}

// ═══════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: isAdmin, error: roleError } = await supabase.rpc('has_role', {
      _user_id: userData.user.id,
      _role: 'admin'
    });

    if (roleError || !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Acesso de administrador necessário' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { resourceType, agentStrategy, agentName } = body;

    if (!resourceType) {
      return new Response(
        JSON.stringify({ error: 'Tipo de recurso não informado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const currentDate = new Date().toLocaleDateString('pt-BR', {
      day: 'numeric', month: 'long', year: 'numeric'
    });

    // ═════════════════════════════════════════════════════
    // NOTIFICAÇÃO EXTRAJUDICIAL FLOW (single pass)
    // ═════════════════════════════════════════════════════
    if (resourceType === 'notificacao_extrajudicial') {
      const { notificanteData, notificadoData, userInstructions, files } = body;
      const systemPrompt = buildNotificacaoPrompt(currentDate, notificanteData || {}, notificadoData || {}, userInstructions || '', agentStrategy, agentName);
      
      const userContent: any[] = [{ type: 'text', text: 'Elabore a NOTIFICAÇÃO EXTRAJUDICIAL COMPLETA com no mínimo 4.000 palavras (10+ páginas).' }];
      if (files && Array.isArray(files)) {
        for (const file of files) {
          if (file.type === 'application/pdf') {
            userContent.push({ type: 'file', file: { filename: file.name || 'doc.pdf', file_data: `data:application/pdf;base64,${file.base64}` } });
          } else if (file.type?.startsWith('image/')) {
            userContent.push({ type: 'image_url', image_url: { url: `data:${file.type};base64,${file.base64}` } });
          }
        }
      }

      const parts = convertToResponsesFormat(userContent);
      const result = await callOpenAI(OPENAI_API_KEY, systemPrompt, parts, 16000, 0.25);
      if (result.error) {
        return new Response(JSON.stringify({ error: `Erro IA: ${result.status}` }), { status: result.status || 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      const finalContent = cleanAIContent(result.content);
      if (finalContent.length < 500) {
        return new Response(JSON.stringify({ error: 'Conteúdo incompleto. Tente novamente.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({
        success: true,
        extracted_data: {},
        resource_content: finalContent,
        resource_type: resourceType,
        resource_type_label: RESOURCE_TYPE_LABELS[resourceType]
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ═════════════════════════════════════════════════════
    // RESPOSTA A NOTIFICAÇÃO EXTRAJUDICIAL FLOW
    // Uses Lovable AI Gateway (faster, avoids timeout)
    // ═════════════════════════════════════════════════════
    if (resourceType === 'resposta_notificacao_extrajudicial') {
      const { files, userInstructions } = body;

      console.log('=== RESPOSTA NOTIFICAÇÃO (OpenAI Responses API) ===');
      console.log('Agent:', agentName, '| Files:', files?.length || 0);

      const systemPrompt = `#instruction

Você é um ADVOGADO ESPECIALISTA EM PROPRIEDADE INDUSTRIAL de ELITE,
com décadas de atuação em DEFESA DE MARCAS e CONTENCIOSO MARCÁRIO.

Sua tarefa é elaborar uma RESPOSTA/DEFESA JURÍDICA COMPLETA a uma NOTIFICAÇÃO EXTRAJUDICIAL recebida pelo cliente.
O documento deve ter NO MÍNIMO 4.000 palavras (equivalente a 10+ páginas).

⚠️ CONTEXTO: O cliente RECEBEU uma notificação extrajudicial de terceiro alegando uso indevido de marca.
Você deve DEFENDER o cliente, demonstrando a LEGITIMIDADE do uso e REFUTANDO as alegações do notificante.

#estrutura_obrigatoria

RESPOSTA À NOTIFICAÇÃO EXTRAJUDICIAL

I – IDENTIFICAÇÃO DAS PARTES E DO OBJETO
(MÍNIMO 500 palavras)
- Identificar as partes com base na notificação recebida (notificante e notificado)
- Descrever o objeto da notificação
- Contextualizar a situação factual

II – DA SÍNTESE DAS ALEGAÇÕES DO NOTIFICANTE
(MÍNIMO 600 palavras)
- Resumir CADA alegação feita pelo notificante na notificação
- Transcrever os fundamentos legais utilizados pelo notificante
- Identificar as pretensões e prazos impostos

III – DA DEFESA E REFUTAÇÃO DAS ALEGAÇÕES
(MÍNIMO 1.500 palavras — SEÇÃO MAIS IMPORTANTE)
- Refutar CADA alegação do notificante com argumentação jurídica robusta
- Demonstrar a LEGITIMIDADE do uso da marca pelo notificado
- Analisar a ANTERIORIDADE do uso (quando aplicável)
- Demonstrar DISTINÇÃO SUFICIENTE entre as marcas (fonética, visual, ideológica)
- Aplicar o PRINCÍPIO DA ESPECIALIDADE (classes NCL diferentes, segmentos distintos)
- Demonstrar COEXISTÊNCIA PACÍFICA no mercado
- Demonstrar a BOA-FÉ do notificado
- Questionar a LEGITIMIDADE do notificante para formular tal pedido

IV – DA FUNDAMENTAÇÃO JURÍDICA
(MÍNIMO 1.000 palavras)
- Fundamentar com a Lei da Propriedade Industrial (Lei 9.279/96)
- Aplicar o Manual de Marcas do INPI
- Citar doutrina especializada (Denis Borges Barbosa, Gama Cerqueira)
- Aplicar princípios constitucionais (livre iniciativa, livre concorrência)

V – DA JURISPRUDÊNCIA APLICÁVEL
(MÍNIMO 600 palavras)
⚠️ APENAS jurisprudência REAL e VERIFICÁVEL

VI – DA CONCLUSÃO E POSICIONAMENTO
(MÍNIMO 400 palavras)

#encerramento_obrigatorio

Sem mais para o momento, firmamos a presente.

São Paulo, ${currentDate}.

_______________________________________
Davilys Danques de Oliveira Cunha
Procurador(a) Constituído(a)

WEBMARCAS INTELLIGENCE PI™
CNPJ: 39.528.012/0001-29

${LEGAL_KNOWLEDGE}

${getAgentIdentity(agentName, agentStrategy)}

${userInstructions ? '#instrucoes_adicionais_do_usuario\n' + userInstructions : ''}

Responda APENAS com o texto completo da RESPOSTA À NOTIFICAÇÃO (mínimo 4.000 palavras). SEM JSON. SEM explicações.`;

      // Build user content parts for OpenAI Responses API
      const userContent: any[] = [
        { type: 'text', text: 'Analise a NOTIFICAÇÃO EXTRAJUDICIAL anexada e elabore uma RESPOSTA/DEFESA JURÍDICA COMPLETA com no mínimo 4.000 palavras, refutando todas as alegações do notificante.' }
      ];

      if (files && Array.isArray(files)) {
        for (const file of files) {
          if (file.type === 'application/pdf') {
            userContent.push({
              type: 'file',
              file: { filename: file.name || 'notificacao.pdf', file_data: `data:application/pdf;base64,${file.base64}` }
            });
          } else if (file.type?.startsWith('image/')) {
            userContent.push({
              type: 'image_url',
              image_url: { url: `data:${file.type};base64,${file.base64}` }
            });
          }
        }
      }

      const parts = convertToResponsesFormat(userContent);
      const result = await callOpenAI(OPENAI_API_KEY, systemPrompt, parts, 16000);
      
      if (result.error) {
        console.error('OpenAI error for resposta_notificacao:', result.status, result.error.substring(0, 300));
        return new Response(JSON.stringify({ error: `Erro IA: ${result.status}` }), { status: result.status || 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const finalContent = cleanAIContent(result.content);
      console.log('Resposta Notificação complete:', finalContent.length, 'chars (~', Math.round(finalContent.split(/\s+/).length), 'words)');

      if (finalContent.length < 500) {
        return new Response(JSON.stringify({ error: 'Conteúdo incompleto. Tente novamente.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const extractedData = enrichExtractedData({}, finalContent);

      return new Response(JSON.stringify({
        success: true,
        extracted_data: extractedData,
        resource_content: finalContent,
        resource_type: resourceType,
        resource_type_label: RESOURCE_TYPE_LABELS[resourceType]
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ═════════════════════════════════════════════════════
    // PROCURADOR FLOW (single pass)
    // ═════════════════════════════════════════════════════
    if (resourceType === 'troca_procurador' || resourceType === 'nomeacao_procurador') {
      const { procuradorData, files } = body;
      const systemPrompt = buildProcuradorPrompt(currentDate, procuradorData || {}, resourceType, agentStrategy, agentName);
      
      const userContent: any[] = [{ type: 'text', text: 'Elabore a PETIÇÃO COMPLETA.' }];
      if (files && Array.isArray(files)) {
        for (const file of files) {
          if (file.type === 'application/pdf') {
            userContent.push({ type: 'file', file: { filename: file.name || 'doc.pdf', file_data: `data:application/pdf;base64,${file.base64}` } });
          } else if (file.type?.startsWith('image/')) {
            userContent.push({ type: 'image_url', image_url: { url: `data:${file.type};base64,${file.base64}` } });
          }
        }
      }

      const parts = convertToResponsesFormat(userContent);
      const result = await callOpenAI(OPENAI_API_KEY, systemPrompt, parts, 16000, 0.25);
      if (result.error) {
        return new Response(JSON.stringify({ error: `Erro IA: ${result.status}` }), { status: result.status || 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      const finalContent = cleanAIContent(result.content);
      return new Response(JSON.stringify({
        success: true,
        extracted_data: {},
        resource_content: finalContent,
        resource_type: resourceType,
        resource_type_label: RESOURCE_TYPE_LABELS[resourceType]
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ═════════════════════════════════════════════════════
    // STANDARD INPI RESOURCE FLOW — TWO-PASS GENERATION
    // (indeferimento, exigencia_merito, oposicao)
    // ═════════════════════════════════════════════════════
    const { fileBase64, fileType, files: multiFiles } = body;
    const resourceTypeLabel = RESOURCE_TYPE_LABELS[resourceType] || 'RECURSO ADMINISTRATIVO';

    // Build file parts for all calls
    const fileParts: any[] = [];
    if (multiFiles && multiFiles.length > 0) {
      for (const file of multiFiles) {
        if (file.type === 'application/pdf') {
          fileParts.push({ type: 'file', file: { filename: file.name || 'doc.pdf', file_data: `data:application/pdf;base64,${file.base64}` } });
        } else {
          fileParts.push({ type: 'image_url', image_url: { url: `data:${file.type};base64,${file.base64}` } });
        }
      }
    } else if (fileBase64 && fileType) {
      if (fileType === 'application/pdf') {
        fileParts.push({ type: 'file', file: { filename: 'documento_inpi.pdf', file_data: `data:application/pdf;base64,${fileBase64}` } });
      } else {
        fileParts.push({ type: 'image_url', image_url: { url: `data:${fileType};base64,${fileBase64}` } });
      }
    } else {
      return new Response(JSON.stringify({ error: 'Nenhum arquivo fornecido' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const fileResponseParts = convertToResponsesFormat(fileParts);

    console.log('=== TWO-PASS GENERATION START ===');
    console.log('Resource type:', resourceType, '| Agent:', agentName || 'default', '| Files:', fileResponseParts.length);

    // ─────────────────────────────────────────────────────
    // PASS 0: Quick data extraction (parallel-ready)
    // ─────────────────────────────────────────────────────
    const extractionParts = [
      { type: 'input_text', text: buildExtractionPrompt() },
      ...fileResponseParts,
    ];

    // ─────────────────────────────────────────────────────
    // PASS 1: Generate Sections I to IV
    // ─────────────────────────────────────────────────────
    const pass1System = buildPass1SystemPrompt(resourceTypeLabel, currentDate, agentName, agentStrategy);
    const pass1User = [
      { type: 'input_text', text: `Analise o(s) documento(s) do INPI anexado(s) e elabore as SEÇÕES I a IV do recurso administrativo. CADA seção deve ter a extensão MÍNIMA especificada. O texto total desta parte deve ter NO MÍNIMO 3.800 palavras. Desenvolva CADA argumento com máxima profundidade, como um escritório de PI de elite faria.` },
      ...fileResponseParts,
    ];

    console.log('PASS 1: Generating Sections I-IV...');
    
    // Run extraction and pass 1 in parallel
    const [extractionResult, pass1Result] = await Promise.all([
      callOpenAI(OPENAI_API_KEY, 'Extraia dados do documento INPI. Responda APENAS com JSON válido.', extractionParts, 1000, 0.1),
      callOpenAI(OPENAI_API_KEY, pass1System, pass1User, 16000, 0.25),
    ]);

    // Parse extracted data
    let extractedData = {
      process_number: '', brand_name: '', ncl_class: '',
      holder: '', examiner_or_opponent: '', legal_basis: ''
    };
    try {
      const jsonStr = extractionResult.content.replace(/```json\s*/g, '').replace(/```/g, '').trim();
      extractedData = JSON.parse(jsonStr);
    } catch {
      console.warn('Could not parse extraction data, continuing...');
    }

    if (pass1Result.error) {
      console.error('PASS 1 failed:', pass1Result.status, pass1Result.error?.substring(0, 300));
      return new Response(JSON.stringify({ error: `Erro na geração (Parte 1): ${pass1Result.status}` }), { status: pass1Result.status || 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const pass1Content = cleanAIContent(pass1Result.content);
    console.log('PASS 1 complete:', pass1Content.length, 'chars');

    if (pass1Content.length < 1000) {
      console.error('PASS 1 too short:', pass1Content.length);
      return new Response(JSON.stringify({ error: 'Parte 1 do recurso ficou incompleta. Tente novamente.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ─────────────────────────────────────────────────────
    // PASS 2: Generate Sections V to VIII + closing
    // ─────────────────────────────────────────────────────
    const pass2System = buildPass2SystemPrompt(resourceTypeLabel, currentDate, agentName, agentStrategy);
    const pass2User = [
      { type: 'input_text', text: `Contexto: Você já gerou as Seções I a IV do recurso. Abaixo está o conteúdo já gerado para referência de dados e continuidade de estilo.

SEÇÕES I A IV JÁ GERADAS:
---
${pass1Content.substring(0, 8000)}
---

Agora elabore as SEÇÕES V a VIII + encerramento. Mantenha o MESMO tom, estilo e nível de profundidade. O texto total desta parte deve ter NO MÍNIMO 3.400 palavras. Use os dados do caso (marca: ${extractedData.brand_name}, processo: ${extractedData.process_number}, classe: ${extractedData.ncl_class}, titular: ${extractedData.holder}) conforme a Parte 1.` },
      ...fileResponseParts,
    ];

    console.log('PASS 2: Generating Sections V-VIII...');
    const pass2Result = await callOpenAI(OPENAI_API_KEY, pass2System, pass2User, 16000, 0.25);

    if (pass2Result.error) {
      console.error('PASS 2 failed:', pass2Result.status, pass2Result.error?.substring(0, 300));
      // Return pass 1 content with enforced header
      const enriched = enrichExtractedData(extractedData, pass1Content);
      const normalizedPartial = enforceMandatoryOpening(pass1Content, resourceTypeLabel, enriched);
      return new Response(JSON.stringify({
        success: true,
        extracted_data: enriched,
        resource_content: normalizedPartial,
        resource_type: resourceType,
        resource_type_label: resourceTypeLabel,
        partial: true
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const pass2Content = cleanAIContent(pass2Result.content);
    console.log('PASS 2 complete:', pass2Content.length, 'chars');

    // ─────────────────────────────────────────────────────
    // CONCATENATE both passes + ENFORCE mandatory opening
    // ─────────────────────────────────────────────────────
    const rawFullContent = pass1Content + '\n\n' + pass2Content;
    const enriched = enrichExtractedData(extractedData, rawFullContent);
    const fullContent = enforceMandatoryOpening(rawFullContent, resourceTypeLabel, enriched);
    
    console.log('=== TWO-PASS GENERATION COMPLETE ===');
    console.log('Total length:', fullContent.length, 'chars (~', Math.round(fullContent.split(/\s+/).length), 'words)');

    return new Response(
      JSON.stringify({
        success: true,
        extracted_data: enriched,
        resource_content: fullContent,
        resource_type: resourceType,
        resource_type_label: resourceTypeLabel
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing INPI resource:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
