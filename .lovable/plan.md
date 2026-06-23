
# Auditoria e correção dos prazos de Publicações

## Diagnóstico

Verifiquei o caso do cliente **Florisval Salles Junior / escogov / processo 943468345** direto no banco:

- `data_publicacao_rpi = 26/05/2026`
- `proximo_prazo_critico = 25/06/2026` (apenas 30 dias)
- `descricao_prazo = "Prazo padrão - 30 dias"`
- O `rpi_entries.dispatch_text` veio **vazio** desta entrada, então o sistema caiu no fallback de 30 dias.

Pelo INPI, despachos do tipo "Publicação de pedido de registro para oposição (exame formal concluído)" (status `003`) têm **60 dias** de prazo. Logo o correto seria **24/07/2026**, não 25/06/2026.

A auditoria mostrou que o mesmo problema atinge muitas linhas — só com `descricao_prazo = "Prazo padrão - 30 dias"` existem **61 em status 003**, **19 em deferimento**, **1 em indeferimento**, além de outros casos com `descricao_prazo` nulo. Todos foram criados antes de o `dispatch_text` estar disponível e por isso ficaram com prazo errado.

Sobre o segundo ponto: cada registro em `publicacoes_marcas` já é uma linha independente (não há agrupamento por marca/processo no Kanban nem no Prazos), então **múltiplas publicações para a mesma marca já aparecem separadas** — basta diferenciar visualmente pelo número do processo + data RPI, o que já existe. Só falta um rótulo "Publicação 1/2" quando existe mais de uma para o mesmo processo, para ficar 100% claro.

## O que vou alterar

### 1. Corrigir a regra de cálculo de prazo (`src/components/admin/PublicacaoTab.tsx`)

Em `calcAutoFields`, quando `dispatch_text` estiver ausente, derivar os dias a partir do **status** da publicação em vez de cair para 30 dias:

| Status                 | Prazo padrão | Descrição                              |
| ---------------------- | ------------ | -------------------------------------- |
| 003 / oposicao         | 60 dias      | Prazo para oposição                    |
| exigencia_merito       | 60 dias      | Cumprimento de exigência de mérito     |
| indeferimento          | 60 dias      | Prazo para recurso                     |
| deferimento            | 60 dias      | Pagamento de taxas (deferimento)       |
| certificado            | 9 anos       | Renovação ordinária                    |
| renovacao              | 60 dias      | Prazo para protocolar renovação        |
| arquivado / distrato   | sem prazo    | —                                      |

O fallback genérico passa a ser **60 dias** (padrão INPI), nunca mais 30.

### 2. Migração de auditoria (recálculo em massa)

Migração SQL que faz `UPDATE publicacoes_marcas`:

- Onde `status NOT IN ('arquivado','distrato','certificado','certificados')` e `data_publicacao_rpi IS NOT NULL`
- E (`descricao_prazo IS NULL` OU `descricao_prazo = 'Prazo padrão - 30 dias'`)
- Recalcula `proximo_prazo_critico = data_publicacao_rpi + N dias` conforme tabela acima
- Atualiza `descricao_prazo` com a descrição correta
- Não toca em quem já tem prazo editado manualmente com descrição específica (Cumprimento de exigência, Prazo para oposição, etc.)

Também limpa o status `certificados` (com "s") consolidando em `certificado`.

### 3. Editar inline a partir do badge "Xd restantes" (`src/components/admin/publicacao/PublicacaoPrazos.tsx`)

A célula "Dias Restantes" vira clicável. Ao clicar, abre um **popover** com:

- Campo "Data da publicação na RPI" (date input pré-preenchido com `data_publicacao_rpi`)
- Campo "Prazo final" (date input pré-preenchido com `proximo_prazo_critico`, recalculado em tempo real ao mudar a data RPI usando a regra do status)
- Botões "Salvar" / "Cancelar"

Ao salvar: chama `calcAutoFields` para recomputar, faz `update` em `publicacoes_marcas` e invalida `publicacoes-marcas`. Toast de confirmação.

### 4. Rótulo "Publicação N/M" para múltiplas publicações do mesmo processo

Em `PublicacaoPrazos.tsx` (e no Kanban), quando existir mais de uma publicação com mesmo `process_id` (ou mesmo `process_number_rpi` quando não vinculada), exibe um chip discreto na coluna Marca/Processo: `Publicação 2/3 · RPI 2890`. Isso garante visualmente que cada despacho do INPI tem sua própria linha, mesmo na mesma marca.

## Arquivos afetados

- `src/components/admin/PublicacaoTab.tsx` — nova função `calcDeadlineFromStatus`, ajuste de `calcAutoFields`
- `src/components/admin/publicacao/PublicacaoPrazos.tsx` — popover de edição inline + chip Publicação N/M
- Nova migração em `supabase/migrations/` — recálculo em massa

Nenhuma mudança de schema; apenas dados e UI.
