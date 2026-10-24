import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
const db = new PGlite();
await db.exec(`
create role service_role; create role anon; create role authenticated;
create table invoices(id uuid primary key default gen_random_uuid(), user_id uuid, asaas_invoice_id text, description text, amount numeric, status text, due_date date, created_at timestamptz default now(), acordo_id uuid, sync_status text default 'ativa');
create table acordos_cliente(id uuid primary key default gen_random_uuid(), invoice_original_id uuid, status text);
create table system_settings(id uuid default gen_random_uuid(), key text unique, value jsonb);
`);
await db.exec(fs.readFileSync("cls.sql","utf8"));
await db.exec(fs.readFileSync("mig.sql","utf8"));
const u1='00000000-0000-0000-0000-000000000001', u2='00000000-0000-0000-0000-000000000002';
const hoje='2026-10-21'; // quarta
const d=(n)=>`date '${hoje}' - ${n}`;
await db.exec(`
insert into invoices(id,user_id,asaas_invoice_id,description,amount,status,due_date,created_at) values
('a0000000-0000-0000-0000-000000000001','${u1}','pay_1','Registro de marca X',699,'overdue',${d(30)},now()-interval '40 days'),
('a0000000-0000-0000-0000-000000000002','${u1}','pay_2','Registro de marca Y',699,'overdue',${d(30)},now()-interval '39 days'),
('a0000000-0000-0000-0000-000000000003','${u2}','pay_3','Exigência INPI Z',1621,'overdue',${d(30)},now()-interval '40 days'),
('a0000000-0000-0000-0000-000000000004','${u2}','pay_4','Parcela 1/3 registro de marca',699,'overdue',${d(30)},now()),
('a0000000-0000-0000-0000-000000000005','${u2}','pay_5','Outro serviço',500,'overdue',${d(1)},now()),
('a0000000-0000-0000-0000-000000000006','${u2}','pay_6','Outro serviço',500,'pending',${d(3)},now()),
('a0000000-0000-0000-0000-000000000007','${u2}','pay_7','Outro serviço',500,'overdue',${d(5)},now()),
('a0000000-0000-0000-0000-000000000008','${u2}','pay_8','Outro',500,'dunning_requested',${d(1)},now()),
('a0000000-0000-0000-0000-000000000009','${u2}','pay_9','Outro',500,'paid',${d(1)},now()),
('a0000000-0000-0000-0000-00000000000a','${u2}','pay_a','Outro',500,'overdue',${d(2)},now());
insert into acordos_cliente(invoice_original_id,status) values ('a0000000-0000-0000-0000-000000000007','ativo');
insert into system_settings(key,value) select key,value from (select 'x' key,'{}'::jsonb value where false) z;
`);
const run = async (label) => { const r = await db.query(`select enfileirar_regua_cobranca('${hoje}') r`); console.log(label, JSON.stringify(r.rows[0].r)); };
const q = async (sql)=> (await db.query(sql)).rows;
console.log("settings:", JSON.stringify(await q("select value from system_settings where key='regua_cobranca'")));
await run("1 tudo OFF/dry   ");
const set = (o)=>db.query(`update system_settings set value = value || '${JSON.stringify(o)}'::jsonb where key='regua_cobranca'`);
await set({lembretes_ativo:true}); await run("2 lembretes dry   ");
await set({dry_run:false}); await run("3 lembretes real  ");
console.log("fila:", JSON.stringify(await q("select tipo,count(*) from cobranca_fila group by 1 order by 1")));
await run("4 repetido (idemp)");
console.log("fila apos repetir:", JSON.stringify(await q("select count(*) from cobranca_fila")));
await set({acordo_auto_ativo:true}); await run("5 acordo sem corte");
await set({acordo_corte_data:'2026-09-01'}); await run("6 acordo c/ corte ");
console.log("acordo_auto:", JSON.stringify(await q("select invoice_id from cobranca_fila where tipo='acordo_auto' order by 1")));
await set({acordo_corte_data:'2026-10-01'}); 
await db.query("delete from cobranca_fila");
await run("7 corte futuro   ");
// claim
await db.query("delete from cobranca_fila"); await set({acordo_corte_data:'2026-09-01'}); await run("8 refila");
const c1 = await q("select * from claim_cobranca_fila()"); const c2 = await q("select * from claim_cobranca_fila()");
console.log("claim1:", c1.length, c1[0]?.tipo, "claim2 (ritmo 3min):", c2.length);
await db.query("update cobranca_fila set claimed_at = now()-interval '200 seconds' where status='processando'");
const c3 = await q("select * from claim_cobranca_fila()"); console.log("claim3 apos 200s:", c3.length, "tentativas", c3[0]?.tentativas);
await db.query("update cobranca_fila set claimed_at = now()-interval '11 minutes' where status='processando'");
await q("select * from claim_cobranca_fila()");
console.log("presos:", JSON.stringify(await q("select status,count(*) from cobranca_fila group by 1 order by 1")));
// segunda-feira catch-up
const r = await q(`select enfileirar_regua_cobranca('2026-10-26') r`); console.log("segunda 26/10:", JSON.stringify(r[0].r));
