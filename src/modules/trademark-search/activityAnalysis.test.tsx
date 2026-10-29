import { describe,it,expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { normalizeActivityAnalysis } from '../../../supabase/functions/_shared/activityAnalysis';
import { normalizeJob } from './trademarkSearchService';
import { SearchResult } from './components/SearchResult';
const record={process:'123456789',brand:'SANTA ISABEL',status:'Registro',nice:'NCL(12) 37',holder:'Titular',priority:null,source_url:null};
const base={version:'wm-activity-filter-2026-09-17',activity:'Café',focus_classes:[30,35,43],counts:{related:0,pending:0,other:1},items:[{process:'123456789',group:'other',reason:'Outro segmento; análise preliminar',specification:'Construção de edifícios'}],message:'Nenhuma ocorrência potencialmente conflitante identificada nesta triagem.',limitation:'Não confirma disponibilidade.'};
const makeJob=(analysis:any)=>normalizeJob({job_id:'teste',status:'completed',result:{brand:'Santa Isabel',activity:'Café',records:[record],searches:[{mode:'radical',term:'Santa Isabel',total:1,records:[record]}],conclusion:'requires_legal_review',activity_analysis:analysis}})!;
describe('activity triage contract',()=>{
 it('preserves textual results and validated analysis',()=>{const job=makeJob(base);expect(job.result?.records.length).toBe(1);expect(job.result?.activity_analysis?.counts.other).toBe(1);});
 it('rejects counts that hide records',()=>{expect(normalizeActivityAnalysis({...base,counts:{related:0,pending:0,other:0}},['123456789'])).toBeNull();});
 it('rejects duplicates, missing and alien references',()=>{for(const items of [[],[base.items[0],base.items[0]],[{...base.items[0],process:'987654321'}]])expect(normalizeActivityAnalysis({...base,items},['123456789'])).toBeNull();});
 it('requires evidence for other sectors',()=>expect(normalizeActivityAnalysis({...base,items:[{...base.items[0],specification:null}]},['123456789'])).toBeNull());
 it('pending never displays clean zero verdict',()=>{const a={...base,counts:{related:0,pending:1,other:0},items:[{...base.items[0],group:'pending',specification:null}],message:'Análise com pendências'};const html=renderToStaticMarkup(<SearchResult job={makeJob(a)} brandName="Santa Isabel" businessArea="Café" onNewSearch={()=>{}}/>);expect(html).toContain('precisam de conferência');expect(html).not.toContain('Nenhuma ocorrência relevante identificada nesta triagem');});
 it('renders other segments separately and keeps raw total',()=>{const html=renderToStaticMarkup(<SearchResult job={makeJob(base)} brandName="Santa Isabel" businessArea="Café" onNewSearch={()=>{}}/>);expect(html).toContain('Outros segmentos');expect(html).toContain('Construção de edifícios');expect(html).toContain('Total textual preservado: 1');expect(html).not.toContain('marca disponível');});
 it('old response remains usable without triage',()=>expect(makeJob(undefined).result?.activity_analysis).toBeNull());
});

describe('portal-port version (candidate integration)',()=>{
 const nova={...base,version:'wm-activity-filter-2026-09-17+portal-port-2026-10-29+renome-2026-10-20+fifa2027-2026-09-08',limitation:'Triagem preliminar. Alto renome verificado por número de processo contra a lista oficial do INPI de 2026-10-20 (383 processos; fonte https://www.gov.br/inpi/pt-br/servicos/marcas/alto-renome/inpi_marcas_marcas-de-alto-renome-em-vigencia_2026_10_20.pdf). A lista reflete a vigência nessa data; não afirma a vigência atual.'};
 it('accepts the new version and renders limitation with snapshot date',()=>{
   const job=makeJob(nova);
   expect(job.result?.activity_analysis?.version).toBe(nova.version);
   const html=renderToStaticMarkup(<SearchResult job={job} brandName="Santa Isabel" businessArea="Café" onNewSearch={()=>{}}/>);
   expect(html).toContain('2026-10-20');
   expect(html).toContain('lista oficial do INPI');
 });
 it('analysis=null is not masked as completed analysis',()=>{
   const job=makeJob(undefined);
   const html=renderToStaticMarkup(<SearchResult job={job} brandName="Santa Isabel" businessArea="Café" onNewSearch={()=>{}}/>);
   expect(html).not.toContain('lista oficial do INPI');
   expect(html).not.toContain('Outros segmentos');
   expect(html).toContain('registros semelhantes');
 });
});
