// Run with PGLITE_MODULE pointing to an installed @electric-sql/pglite entry.
// Uses an isolated in-memory database. Never connects to Supabase.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
await db.exec(`CREATE TABLE public.inpi_resource_cases(id text PRIMARY KEY);
  CREATE TABLE public.inpi_case_documents(id text PRIMARY KEY, case_id text REFERENCES inpi_resource_cases(id),
    display_order integer, created_at timestamptz, is_active boolean DEFAULT true);
  INSERT INTO inpi_resource_cases VALUES ('a'), ('b');
  INSERT INTO inpi_case_documents VALUES ('a1','a',0,now(),true),('a2','a',1,now(),false),('a3','a',2,now(),true);`);
await db.exec(await readFile(new URL('../supabase/migrations/20260916090000_inpi_document_numbers.sql', import.meta.url), 'utf8'));
let checks = 0;
const eq = (a,b) => { assert.deepEqual(a,b); checks++; };
eq((await db.query('SELECT doc_number FROM inpi_case_documents ORDER BY id')).rows.map(x=>x.doc_number),[1,2,3]);
await db.exec(`INSERT INTO inpi_case_documents(id,case_id,doc_number) VALUES ('a4','a',999), ('b1','b',999)`);
eq((await db.query("SELECT doc_number FROM inpi_case_documents WHERE id='a4'")).rows[0].doc_number,4);
eq((await db.query("SELECT doc_number FROM inpi_case_documents WHERE id='b1'")).rows[0].doc_number,1);
await db.exec("DELETE FROM inpi_case_documents WHERE id='a4'; INSERT INTO inpi_case_documents(id,case_id) VALUES ('a5','a')");
eq((await db.query("SELECT doc_number FROM inpi_case_documents WHERE id='a5'")).rows[0].doc_number,5);
await assert.rejects(db.exec("UPDATE inpi_case_documents SET doc_number=8 WHERE id='a1'")); checks++;
await assert.rejects(db.exec("UPDATE inpi_case_documents SET case_id='b' WHERE id='a1'")); checks++;
await db.exec("UPDATE inpi_case_documents SET is_active=false WHERE id='a3'");
eq((await db.query("SELECT doc_number FROM inpi_case_documents WHERE id='a3'")).rows[0].doc_number,3);
await assert.rejects(db.exec("INSERT INTO inpi_case_documents(id,case_id) VALUES ('orphan','missing')")); checks++;
await db.close();
console.log(`${checks} migration assertions passed (isolated PostgreSQL/PGlite; production RLS not tested).`);
