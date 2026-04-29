# Mostrar o Plano no Card do Kanban (Clientes)

## Diagnóstico

O card do Kanban do cliente **já tem** lógica para exibir um badge colorido com o nome do plano (Essencial/Premium/Corporativo), mas o badge só aparece quando `client.plan_type` está preenchido.

`Clientes.tsx` lê `plan_type` da tabela `contracts` (último contrato do cliente). Verifiquei o banco e confirmei o problema:

- O contrato do **Evandro** (assinado, R$699): `plan_type = NULL` ❌
- Outros contratos recentes do template "Padrão Registro de Marca": também `NULL`
- Todos foram criados via `CreateContractDialog` (admin), não pelo checkout do cliente.

Causa: em `src/components/admin/contracts/CreateContractDialog.tsx` (linha 988, `INSERT INTO contracts`), o campo `plan_type` **não é incluído** no insert. O dialog até reconhece o tipo de template (Premium/Padrão/Corporativo) para preencher assunto e valor automaticamente, mas não grava `plan_type` na tabela.

Resultado: o badge do plano nunca aparece para contratos criados pelo admin — só aparece o valor (R$ 699) e a origem (form_checkout), exatamente como no print.

## Correção

### 1. `CreateContractDialog.tsx` — gravar `plan_type` ao criar o contrato

No INSERT da tabela `contracts` (linha ~988), adicionar `plan_type` derivado do nome do template selecionado, usando a mesma lógica que já existe no dialog para o assunto/valor automático:

```ts
const tplName = (selectedTemplate?.name || '').toLowerCase();
let planType: 'essencial' | 'premium' | 'corporativo' | null = null;
if (tplName.includes('registro de marca')) {
  if (tplName.includes('corporativo')) planType = 'corporativo';
  else if (tplName.includes('premium')) planType = 'premium';
  else if (tplName.includes('padrão') || tplName.includes('padrao')) planType = 'essencial';
}
// ...
.insert({
  ...,
  plan_type: planType,
  ...
})
```

Assim, todo novo contrato criado pelo admin já nasce com o `plan_type` correto, e o badge aparecerá no card.

### 2. Migration de backfill — corrigir contratos antigos

Atualizar contratos já assinados que estão com `plan_type=NULL` mas têm template e/ou valor reconhecíveis:

```sql
-- Por template (mais confiável)
UPDATE contracts SET plan_type='essencial'
  WHERE plan_type IS NULL AND template_id IN (
    SELECT id FROM contract_templates
    WHERE LOWER(name) LIKE '%padrão%registro de marca%'
       OR LOWER(name) LIKE '%padrao%registro de marca%'
  );

UPDATE contracts SET plan_type='premium'
  WHERE plan_type IS NULL AND template_id IN (
    SELECT id FROM contract_templates WHERE LOWER(name) LIKE '%premium%registro de marca%'
  );

UPDATE contracts SET plan_type='corporativo'
  WHERE plan_type IS NULL AND template_id IN (
    SELECT id FROM contract_templates WHERE LOWER(name) LIKE '%corporativo%registro de marca%'
  );

-- Fallback por valor exato (apenas registros sem template_id)
UPDATE contracts SET plan_type='essencial'
  WHERE plan_type IS NULL AND template_id IS NULL AND contract_value IN (699, 698.97);
UPDATE contracts SET plan_type='premium'
  WHERE plan_type IS NULL AND template_id IS NULL AND contract_value = 398;
UPDATE contracts SET plan_type='corporativo'
  WHERE plan_type IS NULL AND template_id IS NULL AND contract_value = 1621;
```

Aditivos/distratos (sem template/valor de plano) permanecem NULL — correto.

## Resultado esperado

- Card do Evandro passa a mostrar: `MEDIUM` · `form_checkout` · **`Essencial`** (badge azul com ícone de escudo).
- Cards de contratos Premium e Corporativo mostram seus respectivos badges.
- Novos contratos criados pelo admin já saem com o plano correto sem ação manual.

## Arquivos afetados

- `src/components/admin/contracts/CreateContractDialog.tsx` — adicionar `plan_type` no INSERT
- `supabase/migrations/...sql` — backfill dos contratos existentes

Nada mais é alterado.
