export const FERNANDA_FLOW = '1- INSTINC' as const;
export const PRESERVED_FLOW = '1- AT FINAL SEMANA' as const;

export type PaymentMethod = 'avista' | 'cartao6x' | 'boleto3x';
export const COLLECTION_OPENING = 'Preciso destes dados para te enviar a proposta personalizada e, aprovando, iniciar o registro no INPI:' as const;

export const COLLECTION_FIELD_ORDER = [
  'fullName', 'cpf', 'cep', 'addressNumber', 'email', 'brandName', 'businessArea', 'cnpj', 'paymentMethod',
] as const;

export type Stage =
  | 'discover_name' | 'discover_brand' | 'discover_business' | 'check_exact_mark'
  | 'recommend_classes' | 'collect_email' | 'collect_cpf' | 'collect_cep'
  | 'collect_address_number' | 'choose_payment' | 'ready_for_contract'
  | 'waiting_contract_link' | 'contract_link_sent' | 'waiting_caroline' | 'closed';

export type Memory = {
  fullName?: string; brandName?: string; businessArea?: string; email?: string;
  cpf?: string; cep?: string; addressNumber?: string; cnpj?: string | null; paymentMethod?: PaymentMethod;
  suggestedClasses?: number[]; principalClass?: number; exactSearchCompleted?: boolean;
  phoneFromSubscriber?: string; carolineReason?: string;
};

export type Conversation = {
  conversationId: string; subscriberId: string; stage: Stage; memory: Memory;
  lastInboundAt?: string; followupsCancelledAt?: string; pendingQuestion?: string;
};

export const PRICES = Object.freeze({
  avista: { label: 'PIX', total: 699, display: 'R$ 699' },
  cartao6x: { label: 'Cartão', total: 1194, display: '6x de R$ 199 (R$ 1.194)' },
  boleto3x: { label: 'Boleto', total: 1197, display: '3x de R$ 399 (R$ 1.197)' },
});

export const FOLLOW_UP_DELAYS_MS = Object.freeze([
  10 * 60 * 1000,
  24 * 60 * 60 * 1000,
  5 * 24 * 60 * 60 * 1000,
]);

export function followUpSchedule(from: Date) {
  return FOLLOW_UP_DELAYS_MS.map((delay, index) => ({ step: index + 1, dueAt: new Date(from.getTime() + delay).toISOString() }));
}

export function mergeCapturedMemory(conversation: Conversation, captured: Partial<Memory>): Conversation {
  const memory = { ...conversation.memory, ...Object.fromEntries(Object.entries(captured).filter(([, value]) => value !== undefined && value !== '')) };
  return { ...conversation, memory };
}

export function closeConversation(conversation: Conversation, occurredAt: string): Conversation {
  return { ...cancelFollowUpsOnInbound(conversation, occurredAt), stage: 'closed', pendingQuestion: undefined };
}

export function cancelFollowUpsOnInbound(conversation: Conversation, occurredAt: string): Conversation {
  return { ...conversation, lastInboundAt: occurredAt, followupsCancelledAt: occurredAt };
}

export function shouldEscalateToCaroline(message: string) {
  return /(?:quest[aã]o|d[uú]vida).*(?:jur[ií]dic|legal)|(?:oposi[cç][aã]o|recurso|processo judicial|notifica[cç][aã]o extrajudicial|cess[aã]o de marca|licenciamento)/i.test(message);
}

export function requestCarolineEscalation(conversation: Conversation, reason: string): Conversation {
  return {
    ...conversation,
    stage: 'waiting_caroline',
    memory: { ...conversation.memory, carolineReason: reason },
    pendingQuestion: 'Essa questão precisa da Caroline. Posso verificar uma opção concreta de horário com ela para você?',
  };
}

const questions: Partial<Record<Stage, string>> = {
  discover_name: 'Como você prefere que eu te chame?',
  discover_brand: 'Qual é o nome exato da marca que você quer registrar?',
  discover_business: 'Qual é a principal atividade ou produto dessa marca?',
  check_exact_mark: 'Posso fazer a busca textual exata dessa marca no INPI agora?',
  recommend_classes: 'Posso te mostrar as classes recomendadas e destacar a principal?',
  collect_email: 'Qual e-mail deve constar no contrato?',
  collect_cpf: 'Qual CPF deve constar no contrato?',
  collect_cep: 'Qual é o CEP do endereço do contrato?',
  collect_address_number: 'Qual é o número do endereço?',
  choose_payment: `Qual forma você prefere: ${PRICES.avista.display} no PIX, ${PRICES.cartao6x.display} no cartão ou ${PRICES.boleto3x.display} no boleto?`,
};


const collectionQuestions: Record<(typeof COLLECTION_FIELD_ORDER)[number], string> = {
  fullName: 'Qual é o seu nome completo?',
  cpf: 'Qual é o seu CPF?',
  cep: 'Qual é o CEP?',
  addressNumber: 'Qual é o número da residência?',
  email: 'Qual é o seu e-mail?',
  brandName: 'Qual é o nome da marca?',
  businessArea: 'Qual é o ramo de atividade da marca?',
  cnpj: 'A empresa tem CNPJ? Se tiver, qual é?',
  paymentMethod: `Qual forma você prefere: ${PRICES.avista.display} no PIX, ${PRICES.boleto3x.display} no boleto ou ${PRICES.cartao6x.display} no cartão?`,
};

export function nextCollectionQuestion(memory: Memory) {
  for (const field of COLLECTION_FIELD_ORDER) {
    if (field === 'cnpj') {
      if (memory.cnpj === undefined) return { field, question: collectionQuestions[field] };
      continue;
    }
    if (memory[field] === undefined || memory[field] === '') return { field, question: collectionQuestions[field] };
  }
  return null;
}

export function nextQuestion(conversation: Conversation): string | null {
  return conversation.pendingQuestion || questions[conversation.stage] || null;
}

export function hasExactlyOneQuestion(message: string) {
  return (message.match(/\?/g) || []).length <= 1;
}

export function contractReadiness(memory: Memory) {
  const required: (keyof Memory)[] = [
    'fullName', 'brandName', 'businessArea', 'email', 'cpf', 'cep', 'addressNumber',
    'paymentMethod', 'phoneFromSubscriber', 'principalClass', 'exactSearchCompleted',
  ];
  const missing = required.filter((key) => memory[key] === undefined || memory[key] === '');
  return { ready: missing.length === 0, missing };
}

export function canCreateContract(conversation: Conversation) {
  return conversation.stage === 'ready_for_contract' && contractReadiness(conversation.memory).ready;
}

export function markContractRequested(conversation: Conversation): Conversation {
  if (!canCreateContract(conversation)) throw new Error('contract_not_ready');
  return { ...conversation, stage: 'waiting_contract_link', pendingQuestion: undefined };
}

export function markContractLinkSent(conversation: Conversation): Conversation {
  if (conversation.stage !== 'waiting_contract_link') throw new Error('contract_not_requested');
  return { ...conversation, stage: 'contract_link_sent', pendingQuestion: undefined };
}
