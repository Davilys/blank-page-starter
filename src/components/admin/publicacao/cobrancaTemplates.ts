export interface CobrancaTemplate {
  id: 1 | 2 | 3 | 4;
  label: string;
  dueDays: number;
  subject: (marca: string) => string;
  whatsapp: (nome: string) => string;
  email: (nome: string, marca: string) => string;
}

const safe = (s: string | null | undefined, fallback = 'Cliente') => (s && s.trim()) || fallback;

export const COBRANCA_TEMPLATES: CobrancaTemplate[] = [
  {
    id: 1,
    label: '1ª Notificação (15 dias)',
    dueDays: 15,
    subject: (marca) => `Lembrete: prazo de 60 dias junto ao INPI — ${marca || 'sua marca'}`,
    whatsapp: (nome) => `Olá, ${safe(nome)}. Tudo bem?\n\nEstamos entrando em contato para lembrar que a publicação do seu processo possui um prazo legal de 60 dias junto ao INPI para cumprimento.\n\nAté o momento, não recebemos seu posicionamento referente à continuidade desta etapa.\n\nCaso tenha alguma dúvida, estamos à disposição para esclarecê-la e evitar qualquer prejuízo ao andamento do seu processo.\n\nQual é o melhor horário para conversarmos?`,
    email: (nome, marca) => `<p>Olá, <strong>${safe(nome)}</strong>. Tudo bem?</p><p>Estamos entrando em contato para lembrar que a publicação do seu processo da marca <strong>${marca || 'sua marca'}</strong> possui um prazo legal de <strong>60 dias</strong> junto ao INPI para cumprimento.</p><p>Até o momento, não recebemos seu posicionamento referente à continuidade desta etapa.</p><p>Caso tenha alguma dúvida, estamos à disposição para esclarecê-la e evitar qualquer prejuízo ao andamento do seu processo.</p><p><strong>Qual é o melhor horário para conversarmos?</strong></p>`,
  },
  {
    id: 2,
    label: '2ª Notificação (30 dias)',
    dueDays: 30,
    subject: (marca) => `Atenção: prazo do INPI próximo de vencer — ${marca || 'sua marca'}`,
    whatsapp: (nome) => `Olá, ${safe(nome)}.\n\nJá se passaram 39 dias desde a publicação da exigência do seu processo e ainda não recebemos seu posicionamento.\n\nO prazo concedido pelo INPI é de 60 dias e, sem o cumprimento desta etapa, o processo poderá ser arquivado automaticamente pelo órgão.\n\nEstamos tentando resolver a situação de forma amigável e evitar qualquer prejuízo ao seu registro.\n\nPor favor, informe ainda hoje se deseja dar continuidade ao processo.`,
    email: (nome, marca) => `<p>Olá, <strong>${safe(nome)}</strong>.</p><p>Já se passaram <strong>39 dias</strong> desde a publicação da exigência do seu processo da marca <strong>${marca || 'sua marca'}</strong> e ainda não recebemos seu posicionamento.</p><p>O prazo concedido pelo INPI é de <strong>60 dias</strong> e, sem o cumprimento desta etapa, o processo poderá ser <strong>arquivado automaticamente</strong> pelo órgão.</p><p>Estamos tentando resolver a situação de forma amigável e evitar qualquer prejuízo ao seu registro.</p><p><strong>Por favor, informe ainda hoje se deseja dar continuidade ao processo.</strong></p>`,
  },
  {
    id: 3,
    label: '3ª Notificação Final (50 dias)',
    dueDays: 50,
    subject: (marca) => `Notificação formal: cumprimento de exigência INPI — ${marca || 'sua marca'}`,
    whatsapp: (nome) => `Olá, ${safe(nome)}.\n\nInformamos que já realizamos diversos contatos por telefone, WhatsApp e e-mail, sem sucesso na obtenção de um posicionamento definitivo.\n\nO prazo da publicação está próximo do encerramento e, caso não haja manifestação, o INPI poderá arquivar o processo por ausência de cumprimento da exigência, sendo essa uma consequência decorrente da falta de retorno do titular.\n\nTambém esclarecemos que o débito de R$ 1.621,00 permanece devido, conforme previsto no contrato assinado. O serviço não foi concluído exclusivamente pela ausência de autorização e regularização por parte do cliente, e não por falha da empresa.\n\nNosso objetivo continua sendo resolver a situação de forma amigável. Caso ainda tenha dúvidas, podemos agendar uma reunião para apresentar o histórico, o contrato, a publicação no Diário Oficial e esclarecer todos os pontos necessários.\n\nQual é o melhor horário para realizarmos essa reunião?\n\nCaso não haja resposta ainda hoje, considere esta mensagem como notificação formal.`,
    email: (nome, marca) => `<p>Olá, <strong>${safe(nome)}</strong>.</p><p>Informamos que já realizamos diversos contatos por telefone, WhatsApp e e-mail, sem sucesso na obtenção de um posicionamento definitivo sobre o processo da marca <strong>${marca || 'sua marca'}</strong>.</p><p>O prazo da publicação está próximo do encerramento e, caso não haja manifestação, o INPI poderá <strong>arquivar o processo</strong> por ausência de cumprimento da exigência, sendo essa uma consequência decorrente da falta de retorno do titular.</p><p>Também esclarecemos que o <strong>débito de R$ 1.621,00</strong> permanece devido, conforme previsto no contrato assinado. O serviço não foi concluído exclusivamente pela ausência de autorização e regularização por parte do cliente, e não por falha da empresa.</p><p>Nosso objetivo continua sendo resolver a situação de forma amigável. Caso ainda tenha dúvidas, podemos agendar uma reunião para apresentar o histórico, o contrato, a publicação no Diário Oficial e esclarecer todos os pontos necessários.</p><p><strong>Qual é o melhor horário para realizarmos essa reunião?</strong></p><p><em>Caso não haja resposta ainda hoje, considere esta mensagem como notificação formal.</em></p>`,
  },
];

export const VENCIDO_FORMAL_TEMPLATE: CobrancaTemplate = {
  id: 4,
  label: 'Notificação Formal — Prazo Vencido',
  dueDays: 60,
  subject: (marca) => `Notificação Formal — prazo do INPI encerrado (${marca || 'sua marca'})`,
  whatsapp: (nome) => `Olá, ${safe(nome)}.\n\nInformamos que o prazo concedido pelo INPI para cumprimento da exigência referente ao seu processo foi encerrado.\n\nDurante os 60 dias legais, realizamos diversas tentativas de contato por WhatsApp, telefone e e-mail, incluindo notificações formais, porém não obtivemos retorno dentro do prazo estabelecido.\n\nDessa forma, o processo poderá ser arquivado pelo INPI por falta de manifestação do titular, não sendo esta uma responsabilidade da WebMarcas, uma vez que todas as comunicações foram realizadas e registradas.\n\nCaso deseje mais informações, estamos à disposição para apresentar o histórico completo dos contatos realizados.\n\nEsta mensagem possui caráter formal de notificação.\n\nAtenciosamente,\nWebMarcas – Registro de Marcas e Patentes\n📞 (11) 91112-0225\n📧 ola@webmarcas.net`,
  email: (nome, marca) => `<p>Olá, <strong>${safe(nome)}</strong>.</p><p>Informamos que o <strong>prazo concedido pelo INPI</strong> para cumprimento da exigência referente ao seu processo da marca <strong>${marca || 'sua marca'}</strong> foi <strong>encerrado</strong>.</p><p>Durante os <strong>60 dias legais</strong>, realizamos diversas tentativas de contato por WhatsApp, telefone e e-mail, incluindo notificações formais, porém não obtivemos retorno dentro do prazo estabelecido.</p><p>Dessa forma, o processo poderá ser arquivado pelo INPI por falta de manifestação do titular, <strong>não sendo esta uma responsabilidade da WebMarcas</strong>, uma vez que todas as comunicações foram realizadas e registradas.</p><p>Caso deseje mais informações, estamos à disposição para apresentar o histórico completo dos contatos realizados.</p><p><em>Esta mensagem possui caráter formal de notificação.</em></p><p>Atenciosamente,<br/><strong>WebMarcas – Registro de Marcas e Patentes</strong><br/>📞 (11) 91112-0225<br/>📧 ola@webmarcas.net</p>`,
};