export const PREVIEW_FLOW = '1- INSTINC' as const;
export const PREVIEW_SECRET_ENV = 'FERNANDA_PREVIEW_WEBHOOK_SECRET' as const;
export const PREVIEW_SECRET_HEADER = 'x-fernanda-preview-secret' as const;
export type InputKind = 'text' | 'audio' | 'document';
export type PreviewMemory = Record<string, unknown> & { processedEventIds?: string[]; stage?: string };
export type PreviewInput = {
  event_id: string; flow_name: string; subscriber_id: string; conversation_id: string;
  phone: string; input: { kind: InputKind; text?: string; transcript?: string; attachment?: { id: string; filename: string; mime_type: string; size_bytes: number; extracted_text?: string } };
  memory?: PreviewMemory;
};
const allowedDocumentTypes = new Set(['application/pdf','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
const question = 'Qual é o nome exato da marca que você quer registrar?';
export function validatePreviewInput(value: unknown): { ok: true; value: PreviewInput } | { ok: false; errors: string[] } {
  const b = value as Partial<PreviewInput> | null; const e: string[] = [];
  if (!b || typeof b !== 'object') return { ok:false, errors:['body'] };
  if (!b.event_id?.startsWith('TESTE-')) e.push('event_id');
  if (b.flow_name !== PREVIEW_FLOW) e.push('flow_name');
  if (!b.subscriber_id?.startsWith('TESTE-')) e.push('subscriber_id');
  if (!b.conversation_id?.startsWith('TESTE-')) e.push('conversation_id');
  if (!/^TESTE-[0-9A-Za-z_-]{3,80}$/.test(b.phone || '')) e.push('phone');
  const i=b.input;
  if (!i || !['text','audio','document'].includes(i.kind)) e.push('input.kind');
  else if (i.kind==='text' && !i.text?.startsWith('TESTE ')) e.push('input.text');
  else if (i.kind==='audio' && !i.transcript?.startsWith('TESTE ')) e.push('input.transcript');
  else if (i.kind==='document') {
    const a=i.attachment;
    if (!a?.id?.startsWith('TESTE-')) e.push('attachment.id');
    if (!a?.filename || a.filename.includes('/') || a.filename.includes('\\')) e.push('attachment.filename');
    if (!a?.mime_type || !allowedDocumentTypes.has(a.mime_type)) e.push('attachment.mime_type');
    if (!Number.isSafeInteger(a?.size_bytes) || (a?.size_bytes || 0)<1 || (a?.size_bytes || 0)>10_000_000) e.push('attachment.size_bytes');
    if (!a?.extracted_text?.startsWith('TESTE ')) e.push('attachment.extracted_text');
  }
  return e.length ? {ok:false,errors:e} : {ok:true,value:b as PreviewInput};
}
export function planPreview(input: PreviewInput, now='2026-09-21T12:00:00.000Z') {
  const memory={...(input.memory || {})}; const ids=Array.isArray(memory.processedEventIds)?memory.processedEventIds.filter(x=>typeof x==='string').slice(-49):[];
  const duplicate=ids.includes(input.event_id); if (!duplicate) ids.push(input.event_id);
  const text=input.input.kind==='text'?input.input.text!:input.input.kind==='audio'?input.input.transcript!:input.input.attachment!.extracted_text!;
  const caroline=/(oposi[cç][aã]o|recurso|processo judicial|notifica[cç][aã]o extrajudicial|cess[aã]o|licenciamento)/i.test(text);
  const contractReady=memory.stage==='ready_for_contract' && memory.contract_gates_satisfied===true;
  const reply=duplicate?'TESTE OK: evento já processado; nenhum comando novo foi criado.':caroline?'Essa questão precisa da Caroline. Posso verificar uma opção concreta de horário com ela para você?':question;
  const anchor=new Date(now).getTime();
  return {success:true,dry_run:true,no_effects:true,duplicate,event_id:input.event_id,conversation_id:input.conversation_id,
    next_state:{...memory,processedEventIds:ids,lastInputKind:input.input.kind,lastInboundAt:now,stage:caroline?'waiting_caroline':memory.stage||'discovery'},
    reply_plan:{text:reply,question_count:(reply.match(/\?/g)||[]).length},
    commands:duplicate?[]:[{type:'reply_same_conversation',conversation_id:input.conversation_id,subscriber_id:input.subscriber_id,text:reply,dry_run:true},
      ...(caroline?[{type:'handoff_caroline',conversation_id:input.conversation_id,reason:'complex_legal_matter',dry_run:true}]:[]),
      ...(contractReady?[{type:'request_new_contract_path',conversation_id:input.conversation_id,idempotency_key:`contract:${input.event_id}`,dry_run:true}]:[]),
      {type:'replace_followups',conversation_id:input.conversation_id,due_at:[600000,86400000,432000000].map(ms=>new Date(anchor+ms).toISOString()),dry_run:true}],
    blocked_actions:['database_write','botconversa_send','contract_create','signature','charge','gru','power_of_attorney','inpi','external_fetch']};
}
