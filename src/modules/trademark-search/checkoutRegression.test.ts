import { describe, it, expect, vi } from 'vitest';
vi.mock('./TrademarkSearchProvider', () => ({useTrademarkSearchContext: vi.fn()}));
import { toViabilityResult } from './useTrademarkSearch';
import { replaceContractVariables } from '@/hooks/useContractTemplate';
const job=(activity:string)=>({result:{activity,records:[{nice:'37'}],conclusion:'requires_legal_review'}} as any);
const data={personalData:{fullName:'TESTE',cpf:'',email:'',phone:'',address:'',neighborhood:'',city:'',state:'',cep:''},brandData:{brandName:'TESTE',businessArea:'Jurídico',hasCNPJ:false,cnpj:'',companyName:''},paymentMethod:'avista',plan:'essencial' as const};
describe('checkout class and amount invariants',()=>{
 it('uses activity not occurrence classes and selects a primary candidate',()=>{const v=toViabilityResult(job('serviços jurídicos de registro de marcas'));expect(v.classes).toEqual([45,41,42]);expect(v.primaryClass).toBe(45);expect(v.classDescriptions?.[1]).toContain('somente se');});
 it('does not invent classes for generic activity',()=>{const v=toViabilityResult(job('consultoria'));expect(v.classes).toEqual([]);expect(v.primaryClass).toBeNull();});
 it('restaurant primary is 43',()=>expect(toViabilityResult(job('restaurante')).primaryClass).toBe(43));
 for(const count of [1,2,3])it(`contract amount agrees with checkout for ${count} classes`,()=>{const html=replaceContractVariables('{{forma_pagamento_detalhada}}',{...data,selectedClasses:[45,41,42].slice(0,count),paymentTotal:698.97*count});expect(html).toContain((698.97*count).toLocaleString('pt-BR',{minimumFractionDigits:2}));});
 it('premium updates only payment clause, not penalties',()=>{const html=replaceContractVariables('5.1 assinatura mensal recorrente no valor de R$ 398,00 (trezentos e noventa e oito reais)\n9.4 multa R$ 398,00',{...data,plan:'premium',paymentTotal:796});expect(html).toContain('valor de R$ 796,00');expect(html).toContain('9.4 multa R$ 398,00');});
});
