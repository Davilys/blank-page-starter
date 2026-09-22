const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
function safeEqual(a:string,b:string){if(!a||!b||a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i+=1)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;}
const text=(v:unknown)=>typeof v==='string'?v.trim():'';
Deno.serve(async(req)=>{
 if(req.method!=='POST')return json({error:'Método não permitido'},405);
 const expected=Deno.env.get('BOTCONVERSA_CONTRACT_WEBHOOK_SECRET')||'';
 const received=req.headers.get('x-botconversa-contract-secret')||'';
 if(!expected||!safeEqual(received,expected))return json({error:'Não autorizado'},401);
 let body:Record<string,unknown>;try{body=await req.json();}catch{return json({error:'Corpo JSON inválido'},400);}
 const eventId=text(body.event_id),flowName=text(body.flow_name),subscriberId=text(body.subscriber_id),message=text(body.message);
 if(req.headers.get('x-webmarcas-dry-run')!=='1'||!eventId.startsWith('TESTE-')||flowName!=='1- INSTINC'||!subscriberId.startsWith('TESTE-')||!message.startsWith('TESTE '))return json({error:'Preview conversacional aceita somente homologação TESTE sem efeitos'},422);
 return json({success:true,dry_run:true,no_effects:true,event_id:eventId,flow_name:flowName,subscriber_id:subscriberId,reply:'TESTE OK: Fernanda recebeu a mensagem na preview sem gravar nem chamar serviços externos.',blocked_actions:['database_write','botconversa_send','contract','signature','charge','gru','power_of_attorney','inpi','external_fetch']});
});
