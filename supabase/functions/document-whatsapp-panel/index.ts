import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const cors = {
  'Access-Control-Allow-Origin': 'https://davilys.github.io',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

async function requireAdmin(req: Request) {
  const authorization = req.headers.get('Authorization') || '';
  const token = authorization.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return null;
  const { data: role } = await admin.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
  return role ? user : null;
}

function page() {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>WebMarcas · Envio de documentos</title><style>
  :root{font-family:Inter,system-ui,sans-serif;color:#10243e;background:#f3f7fb}*{box-sizing:border-box}body{margin:0;padding:24px}.wrap{max-width:760px;margin:auto}.brand{font-size:13px;font-weight:800;color:#087f5b;letter-spacing:.12em}.card{background:white;border:1px solid #dfe8f1;border-radius:18px;padding:22px;margin-top:16px;box-shadow:0 12px 35px #1232 0}.row{display:flex;gap:10px;flex-wrap:wrap}input,button{font:inherit;border-radius:10px;padding:12px;border:1px solid #ccd8e5}input{flex:1;min-width:220px}button{background:#0b63ce;color:#fff;border:0;font-weight:700;cursor:pointer}button:disabled{opacity:.55}.muted{color:#63758a;font-size:14px}.doc{display:flex;gap:12px;align-items:flex-start;padding:12px 0;border-bottom:1px solid #edf1f5}.doc input{min-width:auto;flex:0;margin-top:4px}.name{font-weight:650;word-break:break-word}.status{margin-top:14px;padding:12px;border-radius:10px;background:#edf6ff}.ok{background:#e9f9f0;color:#087f5b}.error{background:#fff0f0;color:#b42318}.hide{display:none}h1{font-size:25px;margin:7px 0}h2{font-size:19px}</style></head><body><div class="wrap">
  <div class="brand">WEBMARCAS</div><h1>Enviar anexos por WhatsApp</h1><p class="muted">Acesso restrito à equipe administrativa.</p>
  <section id="login" class="card"><h2>Entrar</h2><div class="row"><input id="email" type="email" placeholder="E-mail do CRM"><input id="password" type="password" placeholder="Senha"><button id="loginBtn">Entrar</button></div></section>
  <section id="app" class="card hide"><div class="row"><input id="search" type="email" placeholder="E-mail exato do cliente"><button id="searchBtn">Buscar cliente</button><button id="logoutBtn" style="background:#607085">Sair</button></div><div id="client"></div><div id="docs"></div><button id="sendBtn" class="hide" style="margin-top:16px">Enviar selecionados por WhatsApp</button></section>
  <div id="status"></div></div>
  <script type="module">import{createClient}from'https://esm.sh/@supabase/supabase-js@2';const sb=createClient('${SUPABASE_URL}','${ANON_KEY}');const q=s=>document.querySelector(s),status=(m,c='')=>{q('#status').className='status '+c;q('#status').textContent=m};let current=null;
  async function api(body){const{data:{session}}=await sb.auth.getSession();if(!session)throw new Error('Sessão encerrada. Entre novamente.');const r=await fetch(location.href,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.error||'Falha na operação');return d}
  async function show(){const{data:{session}}=await sb.auth.getSession();q('#login').classList.toggle('hide',!!session);q('#app').classList.toggle('hide',!session)}
  q('#loginBtn').onclick=async()=>{try{status('Entrando...');const{error}=await sb.auth.signInWithPassword({email:q('#email').value.trim(),password:q('#password').value});if(error)throw error;await show();status('Acesso autorizado.','ok')}catch(e){status(e.message,'error')}};
  q('#logoutBtn').onclick=async()=>{await sb.auth.signOut();current=null;await show();status('Sessão encerrada.')};
  q('#searchBtn').onclick=async()=>{try{status('Buscando cliente e documentos...');const d=await api({action:'search',email:q('#search').value.trim()});current=d.client;q('#client').innerHTML='<h2>'+d.client.full_name+'</h2><p class="muted">'+d.client.email+' · '+(d.client.phone||'sem telefone')+'</p>';q('#docs').innerHTML=d.documents.map(x=>'<label class="doc"><input type="checkbox" value="'+x.id+'"><span><div class="name">'+x.name.replace(/[&<>\"]/g,a=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[a]))+'</div><div class="muted">'+(x.mime_type||'arquivo')+'</div></span></label>').join('');q('#sendBtn').classList.toggle('hide',!d.documents.length);status(d.documents.length+' arquivo(s) encontrado(s).','ok')}catch(e){status(e.message,'error')}};
  q('#sendBtn').onclick=async()=>{const ids=[...document.querySelectorAll('#docs input:checked')].map(x=>x.value);if(!ids.length)return status('Selecione pelo menos um arquivo.','error');if(!confirm('Enviar '+ids.length+' arquivo(s) para o WhatsApp deste cliente?'))return;try{q('#sendBtn').disabled=true;status('Enviando pelo fluxo do BotConversa...');const d=await api({action:'send',client_id:current.id,document_ids:ids});status('Envio confirmado: '+d.quantity+' arquivo(s). Evento '+d.event_id,'ok')}catch(e){status(e.message,'error')}finally{q('#sendBtn').disabled=false}};show();</script></body></html>`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method === 'GET') return new Response(page(), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);
  const user = await requireAdmin(req);
  if (!user) return json({ error: 'Acesso restrito à equipe administrativa' }, 403);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  if (body.action === 'search') {
    const email = String(body.email || '').trim().toLowerCase();
    if (!email) return json({ error: 'Informe o e-mail exato do cliente' }, 422);
    const { data: client } = await admin.from('profiles').select('id,full_name,email,phone').ilike('email', email).maybeSingle();
    if (!client) return json({ error: 'Cliente não encontrado' }, 404);
    const { data: documents, error } = await admin.from('documents').select('id,name,mime_type,file_size,created_at').eq('user_id', client.id).not('file_url', 'is', null).neq('file_url', '').order('created_at', { ascending: false });
    if (error) return json({ error: 'Não foi possível carregar os documentos' }, 500);
    return json({ client, documents: documents || [] });
  }
  if (body.action === 'send') {
    const ids = Array.isArray(body.document_ids) ? body.document_ids.filter((x: unknown) => typeof x === 'string').slice(0, 30) : [];
    if (!body.client_id || !ids.length) return json({ error: 'Cliente e documentos são obrigatórios' }, 422);
    const { data: setting } = await admin.from('system_settings').select('value').eq('key', 'publication_webhook_secret').maybeSingle();
    const secret = (setting?.value as any)?.secret || '';
    const result = await fetch(`${SUPABASE_URL}/functions/v1/send-client-documents-whatsapp`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-publication-webhook-secret': secret }, body: JSON.stringify({ client_id: body.client_id, document_ids: ids }) });
    const payload = await result.json().catch(() => ({}));
    return json(payload, result.status);
  }
  return json({ error: 'Ação inválida' }, 400);
});
