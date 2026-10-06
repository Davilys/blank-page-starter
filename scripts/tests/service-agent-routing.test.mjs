// Run with Node >= 24: node --test scripts/tests/service-agent-routing.test.mjs
// All HTTP and database access is mocked; these tests never send a message.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

const source = readFileSync(process.env.SERVICE_AGENT_SOURCE ?? new URL('../../supabase/functions/send-multichannel-notification/index.ts', import.meta.url), 'utf8');
const compiled = stripTypeScriptTypes(source.replace(/^import .*;\r?\n/gm, ''));
const phone = '5511999990000';
const financeiro = 'https://financeiro.example.test/webhook';
const original = 'https://original.example.test/webhook';
const files = ['a.pdf', 'b.pdf'].map(filename => ({ filename, url: `https://files.example.test/${filename}` }));

async function dispatch(options = {}) {
  const calls = [], logs = [];
  const settings = {
    botconversa: { enabled: true, webhook_url: original },
    botconversa_service_agent: { enabled: options.enabled ?? true, company_id: '8572', webhook_url: financeiro, test_phone: phone },
  };
  const db = {
    auth: { getUser: async () => options.invalidSession ? { data: {user:null}, error: new Error('invalid') } : {data:{user:{id:'admin-id'}},error:null} },
    rpc: async (name, args) => {
      assert.equal(name, 'has_role'); assert.equal(args._user_id, 'admin-id'); assert.equal(args._role, 'admin');
      return { data: options.admin ?? true, error: options.roleError ? new Error('database unavailable') : null };
    },
    from(table) {
      let key;
      const query = {
        select() { return query; },
        eq(_column, value) { key = value; return query; },
        async maybeSingle() { assert.equal(table, 'system_settings'); return {data:{value:settings[key] ?? {enabled:false}},error:null}; },
        async insert(row) { logs.push({table,row}); return {error:null}; },
      };
      return query;
    },
  };
  let handler;
  const context = vm.createContext({
    Request, Response, URL, console: {log(){},warn(){},error(){}},
    Deno: {env:{get: name => name === 'BOTCONVERSA_FINANCEIRO_API_KEY' ? (options.missingKey ? '' : 'mock-secret') : 'mock-config'}},
    createClient: () => db,
    serve: value => { handler = value; },
    setTimeout: fn => { fn(); return 0; },
    fetch: async (url, init = {}) => {
      const body = init.body ? JSON.parse(init.body) : null;
      calls.push({url,body});
      if (url.includes('/subscriber/get_by_phone/')) {
        return new Response(JSON.stringify(options.missingSubscriber ? {} : {id:42}), {status:options.lookupStatus ?? 200});
      }
      if (url.includes('/subscriber/42/send_message/')) {
        const status = body.value === options.failFile ? 400 : 200;
        return new Response('{}', {status});
      }
      assert.ok([financeiro,original,'https://override.example.test/webhook'].includes(url), `Unexpected network request: ${url}`);
      return new Response('{}', {status:200});
    },
  });
  vm.runInContext(compiled, context);
  const payload = {
    event_type: options.eventType ?? 'cobranca_gerada', channels:['whatsapp'],
    recipient:{nome:'Contato de teste',phone:options.phone ?? phone},
    metadata: options.generic ? {} : {
      botconversa_route:'service_agent_financeiro', process_id:'process-test',
      process_context:{marca:'Marca de teste',numero_processo:'999999999',etapa_selecionada:'Evento de teste'},
      whatsapp_attachments:options.attachments ?? files,
    },
    ...(options.override ? {whatsapp_webhook_override:options.override} : {}),
  };
  const response = await handler(new Request('https://edge.example.test/send', {
    method:'POST', headers:{'Content-Type':'application/json',...(options.noAuth ? {} : {Authorization:'Bearer mock-user-jwt'})}, body:JSON.stringify(payload),
  }));
  return {status:response.status,body:await response.json(),calls,logs};
}

test('unauthenticated service calls cannot send documents or start a flow', async () => {
  const r = await dispatch({noAuth:true}); assert.equal(r.status,401); assert.equal(r.calls.length,0); assert.equal(r.logs.length,0);
});
test('expired sessions cannot use the service route', async () => {
  const r = await dispatch({invalidSession:true}); assert.equal(r.status,401); assert.equal(r.calls.length,0);
});
test('non-admin users cannot invoke the CRM service action', async () => {
  const r = await dispatch({admin:false}); assert.equal(r.status,403); assert.equal(r.calls.length,0);
});
test('a role lookup failure cannot authorize a send', async () => {
  const r = await dispatch({roleError:true}); assert.equal(r.status,403); assert.equal(r.calls.length,0);
});
test('disabled route sends neither documents nor webhook, even with API key', async () => {
  const r = await dispatch({enabled:false}); assert.equal(r.body.results.whatsapp.success,false); assert.equal(r.calls.length,0);
});
test('only the saved internal test phone can bypass the disabled flag', async () => {
  const r = await dispatch({enabled:false,eventType:'service_agent_test',phone:'5511888880000'});
  assert.equal(r.calls.length,0); assert.equal(r.body.results.whatsapp.success,false);
});
test('authorized admin test to the saved phone works while production is disabled', async () => {
  const r = await dispatch({enabled:false,eventType:'service_agent_test',attachments:[]});
  assert.equal(r.body.results.whatsapp.success,true); assert.deepEqual(r.calls.map(c=>c.url),[financeiro]);
});
test('missing API secret stops before any network request', async () => {
  const r = await dispatch({missingKey:true}); assert.equal(r.calls.length,0); assert.equal(r.body.results.whatsapp.success,false);
});
test('invalid document URLs stop before lookup or webhook', async () => {
  const r = await dispatch({attachments:[{filename:'a.pdf',url:'https://files.example.test/a.pdf?token=private'}]});
  assert.equal(r.calls.length,0); assert.equal(r.body.results.whatsapp.success,false);
});
test('missing FINANCEIRO subscriber prevents file and flow sends', async () => {
  const r = await dispatch({missingSubscriber:true}); assert.equal(r.calls.length,1); assert.equal(r.body.results.whatsapp.success,false);
});
test('files are submitted in input order before the dedicated webhook', async () => {
  const r = await dispatch();
  assert.equal(r.body.results.whatsapp.success,true);
  assert.deepEqual(r.calls.map(c=>c.body?.value ?? c.url),[
    `https://backend.botconversa.com.br/api/v1/webhook/subscriber/get_by_phone/${phone}/`, files[0].url, files[1].url, financeiro,
  ]);
  assert.equal(r.calls.at(-1).body.company_id,'8572'); assert.equal(r.calls.at(-1).body.processo_numero,'999999999');
  assert.ok(r.logs.every(log=>!JSON.stringify(log.row.payload).includes('https://files.example.test')));
});
test('second file failure stops the agent webhook without resending the first file', async () => {
  const r = await dispatch({failFile:files[1].url});
  assert.equal(r.body.results.whatsapp.success,false); assert.equal(r.calls.length,3);
  assert.ok(r.calls.every(c=>c.url!==financeiro && c.url!==original));
});
test('the service route ignores an override to another company', async () => {
  const r = await dispatch({override:'https://override.example.test/webhook',attachments:[]});
  assert.deepEqual(r.calls.map(c=>c.url),[financeiro]);
});
test('ordinary notifications retain their existing company', async () => {
  const r = await dispatch({generic:true,noAuth:true}); assert.equal(r.body.results.whatsapp.success,true);
  assert.deepEqual(r.calls.map(c=>c.url),[original]);
});
test('ordinary notifications retain their existing webhook override', async () => {
  const r = await dispatch({generic:true,noAuth:true,override:'https://override.example.test/webhook'});
  assert.deepEqual(r.calls.map(c=>c.url),['https://override.example.test/webhook']);
});
