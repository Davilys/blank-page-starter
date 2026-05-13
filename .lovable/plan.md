# Sincronizar contratos do /registrar com os Modelos de Contrato

## Causa raiz (auditoria)

A página `/registrar` é pública (usuário não autenticado). O hook `useContractTemplate` tenta buscar o template por nome na tabela `contract_templates`, mas **a única policy de RLS dessa tabela exige `has_role(auth.uid(), 'admin')`**. Como o visitante não está logado, a query retorna 0 linhas (sem erro), e o código cai no fallback `DEFAULT_CONTRACT_TEMPLATE` / `PREMIUM_CONTRACT_TEMPLATE` / `CORPORATE_CONTRACT_TEMPLATE` definidos dentro do arquivo `src/hooks/useContractTemplate.ts`.

Esses três constantes hardcoded estão **desatualizados** em relação aos templates editados no admin. Exemplo concreto da cláusula 5.2 do plano Essencial:

- Banco (admin "Modelos de Contrato"): "5.2 Taxas do INPI **e anuidade**: ... e a taxa de anuidade valor de R$398,00 a ser paga sempre do 05/12 de cada ano. Se houver exigências ou publicações extras, os custos serão cobrados à parte, conforme a Cláusula 10.3..."
- Constante hardcoded (mostrada hoje em /registrar): "5.2 Taxas do INPI: As taxas federais obrigatórias (GRU) serão de responsabilidade exclusiva do CONTRATANTE, devendo ser recolhidas diretamente ao INPI." (truncado)

Resultado: o cliente vê e assina uma versão antiga do contrato, diferente do modelo oficial. Premium e Corporativo têm o mesmo problema.

## Correção

### 1. Liberar leitura pública dos templates ativos (RLS)
Criar migration adicionando policy `SELECT` para `anon` e `authenticated` filtrando `is_active = true`. Os templates de contrato não contêm dados sensíveis — são modelos genéricos com placeholders `{{...}}`. A policy de admin existente continua intacta para writes.

```sql
CREATE POLICY "Public can read active contract templates"
ON public.contract_templates
FOR SELECT
TO anon, authenticated
USING (is_active = true);
```

### 2. Sincronizar os fallbacks hardcoded com o conteúdo do banco
Em `src/hooks/useContractTemplate.ts`, substituir as três constantes (`DEFAULT_CONTRACT_TEMPLATE`, `PREMIUM_CONTRACT_TEMPLATE`, `CORPORATE_CONTRACT_TEMPLATE`) pelo conteúdo exato atual dos respectivos registros do banco:

- `Contrato Padrão - Registro de Marca INPI` → `DEFAULT_CONTRACT_TEMPLATE`
- `Contrato Premium - Registro de Marca INPI` → `PREMIUM_CONTRACT_TEMPLATE`
- `Contrato Corporativo - Registro de Marca INPI` → `CORPORATE_CONTRACT_TEMPLATE`

Assim, mesmo se a query do banco falhar por qualquer motivo, o fallback fica idêntico ao modelo oficial. O mapeamento plano → template (já feito em `PLAN_TEMPLATE_NAMES` e na lookup `planExactName`) já está correto.

## Validação após a correção

1. Acessar `/registrar` em aba anônima, escolher plano **Essencial 699**, preencher formulário até o passo do contrato → confirmar que cláusula 5.2 contém o texto completo com "e anuidade", "R$398,00 a ser paga sempre do 05/12", e referência à Cláusula 10.3.
2. Repetir para plano **Premium** → confirmar 5.2 com "R$398,00 anuidade" + 10.3 sobre exigências ilimitadas.
3. Repetir para plano **Corporativo** → confirmar 5.2/5.3 com R$1.621,00 anuidade e cláusula de reajuste pelo salário mínimo.
4. Editar um modelo no admin "Modelos de Contrato", salvar, recarregar `/registrar` → mudança deve aparecer imediatamente (provando que a leitura agora vem do banco, não do fallback).
5. Baixar PDF e verificar que o conteúdo assinado é idêntico à pré-visualização.

## Arquivos afetados

- Nova migration em `supabase/migrations/` (policy de leitura pública).
- `src/hooks/useContractTemplate.ts` (constantes de fallback atualizadas).
