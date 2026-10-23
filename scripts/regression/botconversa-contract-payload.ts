import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normaliseClassSuggestions, validateBotConversaContractInput } from '../../supabase/functions/_shared/botconversaContract.ts';

const payload = JSON.parse(readFileSync(new URL('./fixtures/botconversa-contract-valid.json', import.meta.url), 'utf8'));
const parsed = validateBotConversaContractInput(payload);
assert.deepEqual(parsed.errors, []);
assert.equal(parsed.data?.flow_name, '1- INSTINC');
assert.equal(parsed.data?.phone, '(11) 99999-9999');
assert.equal(parsed.data?.payment_method, 'avista');
assert.equal(parsed.data?.cpf, '529.982.247-25');
const flatContact = validateBotConversaContractInput({ ...payload, contact: undefined, whatsapp: '11999999999' });
assert.deepEqual(flatContact.errors, []);

const missingPhone = validateBotConversaContractInput({ ...payload, contact: undefined });
assert(missingPhone.errors.includes('phone inválido'));
const invalidCpf = validateBotConversaContractInput({ ...payload, cpf: '111.111.111-11' });
assert(invalidCpf.errors.includes('cpf inválido'));
console.log('BotConversa contract payload regression passed');

assert.deepEqual(normaliseClassSuggestions({ classes: [3], classDescriptions: ['Cosméticos'] }), { classes: [3], descriptions: ['Cosméticos'], selected: [3] });
assert.deepEqual(normaliseClassSuggestions({ classes: [3, 35], classDescriptions: ['Cosméticos', 'Comércio'] }), { classes: [3, 35], descriptions: ['Cosméticos', 'Comércio'], selected: [3] });
assert.equal(normaliseClassSuggestions({ classes: [], classDescriptions: [] }), null);
assert.equal(normaliseClassSuggestions({ classes: [3, 35, 44, 45], classDescriptions: ['a', 'b', 'c', 'd'] }), null);
console.log('Variable class suggestion regression passed');
