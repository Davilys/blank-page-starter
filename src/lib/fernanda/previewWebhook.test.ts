import {describe,expect,it} from 'vitest';
import {planPreview,validatePreviewInput,PREVIEW_SECRET_ENV,PREVIEW_SECRET_HEADER} from './previewWebhook';
const base={event_id:'TESTE-E1',flow_name:'1- INSTINC',subscriber_id:'TESTE-S1',conversation_id:'TESTE-C1',phone:'TESTE-551199',input:{kind:'text' as const,text:'TESTE Quero registrar Aurora'},memory:{}};
describe('Fernanda preview webhook',()=>{
 it('uses exclusive authentication names',()=>{ expect(PREVIEW_SECRET_ENV).toBe('FERNANDA_PREVIEW_WEBHOOK_SECRET'); expect(PREVIEW_SECRET_HEADER).toBe('x-fernanda-preview-secret'); });
 it('validates text, audio and safe document metadata',()=>{
  expect(validatePreviewInput(base).ok).toBe(true);
  expect(validatePreviewInput({...base,input:{kind:'audio',transcript:'TESTE áudio'}}).ok).toBe(true);
  expect(validatePreviewInput({...base,input:{kind:'document',attachment:{id:'TESTE-A1',filename:'marca.pdf',mime_type:'application/pdf',size_bytes:123,extracted_text:'TESTE documento'}}}).ok).toBe(true);
 });
 it('rejects paths, oversize and unsupported mime',()=>{ const r=validatePreviewInput({...base,input:{kind:'document',attachment:{id:'TESTE-A1',filename:'../x.exe',mime_type:'application/octet-stream',size_bytes:10000001,extracted_text:'TESTE x'}}}); expect(r.ok).toBe(false); });
 it('returns same-conversation reply, memory and followups with zero effects',()=>{ const p=planPreview(base); expect(p.no_effects).toBe(true); expect(p.commands.map(x=>x.type)).toEqual(['reply_same_conversation','replace_followups']); expect(p.next_state.processedEventIds).toContain('TESTE-E1'); expect(p.reply_plan.question_count).toBeLessThanOrEqual(1); expect(p.blocked_actions).toContain('botconversa_send'); });
 it('is idempotent when event id is in memory',()=>{ const p=planPreview({...base,memory:{processedEventIds:['TESTE-E1']}}); expect(p.duplicate).toBe(true); expect(p.commands).toEqual([]); });
 it('plans Caroline handoff but does not execute it',()=>{ const p=planPreview({...base,input:{kind:'text',text:'TESTE recebi oposição'}}); expect(p.commands.some(x=>x.type==='handoff_caroline')).toBe(true); expect(p.no_effects).toBe(true); });
 it('plans the new contract path only after explicit gates',()=>{ expect(planPreview({...base,memory:{stage:'ready_for_contract'}}).commands.some(x=>x.type==='request_new_contract_path')).toBe(false); expect(planPreview({...base,memory:{stage:'ready_for_contract',contract_gates_satisfied:true}}).commands.some(x=>x.type==='request_new_contract_path')).toBe(true); });
});
