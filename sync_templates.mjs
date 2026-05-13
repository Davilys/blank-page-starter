import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://scpbqsvwojhbxihyqbdz.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data, error } = await supabase
  .from('contract_templates')
  .select('name, content')
  .in('name', [
    'Contrato Padrão - Registro de Marca INPI',
    'Contrato Premium - Registro de Marca INPI',
    'Contrato Corporativo - Registro de Marca INPI',
  ])
  .eq('is_active', true);

if (error) { console.error(error); process.exit(1); }

const map = Object.fromEntries(data.map(r => [r.name, r.content]));
const file = 'src/hooks/useContractTemplate.ts';
let src = readFileSync(file, 'utf8');

function replaceConst(name, content) {
  const escaped = '`' + content.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${') + '`';
  const re = new RegExp(`(const ${name} = )\`[\\s\\S]*?\`;`);
  if (!re.test(src)) throw new Error('not found ' + name);
  src = src.replace(re, `$1${escaped};`);
}

replaceConst('DEFAULT_CONTRACT_TEMPLATE', map['Contrato Padrão - Registro de Marca INPI']);
replaceConst('PREMIUM_CONTRACT_TEMPLATE', map['Contrato Premium - Registro de Marca INPI']);
replaceConst('CORPORATE_CONTRACT_TEMPLATE', map['Contrato Corporativo - Registro de Marca INPI']);

writeFileSync(file, src);
console.log('Sincronizado');
