## Diagnóstico

Auditoria do banco mostrou:

| Item | Quantidade |
|---|---|
| Perfis (clientes) | 2.890 |
| Contratos do Perfex importados | 1.512 |
| Documentos do Perfex importados | **0** |
| Logs da função `import-perfex-files` | **nenhum** |

**Conclusão:** Fases 1 (clientes) e 2 (contratos) rodaram, mas a **Fase 3 (arquivos) nunca foi executada**. Por isso a aba "Anexos" do cliente no admin está vazia e a área do cliente (`/cliente/documentos`) não mostra os arquivos antigos. Os contratos importados estão lá, mas sem o PDF assinado anexado.

## O que será feito

### 1. Robustecer `import-perfex-files` antes de rodar
A função atual tenta baixar de `crm.webmarcas.net/uploads/...` testando 5 padrões de pasta. Antes de processar 8 mil+ arquivos, vou:
- Adicionar log estruturado por arquivo (sucesso / 404 / mime errado).
- Aumentar candidatos de URL (incluir variações com subpastas por ano/mês comuns no Perfex: `uploads/contracts/{id}/`, `uploads/clients/{id}/`, `files/`).
- Mapear `document_type` corretamente para baterem com as abas da área do cliente:
  - `rel_type = 'contract'` → `document_type = 'contrato'` + `contract_id` vinculado
  - `rel_type = 'customer'` → `document_type = 'anexo'`
  - extensão `.pdf` com nome contendo "procuracao" → `procuracao`
  - extensão `.pdf` com nome contendo "distrato" → `distrato`
- Garantir `user_id = profile.id` (já está) — isso é o que faz o documento aparecer tanto em `/cliente/documentos` quanto na aba **Anexos** do `ClientDetailSheet` no admin (ambas filtram por `user_id`).

### 2. Anexar PDFs assinados aos contratos do Perfex
Para cada arquivo que pertence a um contrato (`rel_type = 'contract'`):
- Buscar o contrato pelo marcador `[PERFEX_ID:{rel_id}]` no campo `description` (já existe).
- Inserir em `documents` com `contract_id` preenchido e `document_type = 'contrato'`.
- Isso fará o PDF aparecer:
  - Na aba **Contrato** da página `/cliente/documentos`.
  - Na aba **Anexos** do admin no detalhe do cliente.
  - Na visualização do contrato (que já busca documents por `contract_id`).

### 3. Executar a importação em lotes paginados
A função já é paginada (`limit=10`, `offset` controlado). Vou executá-la diretamente via `curl_edge_functions` em lotes até `done=true`, sem depender do botão da UI (que pode falhar por timeout do navegador). Isso evita problemas de sessão/aba fechada.

Estimativa: ~8.000 arquivos / 10 por chamada = ~800 chamadas. Cada chamada leva ~30-60s (downloads remotos). Vou rodar em sequência reportando progresso.

### 4. Validação final
Após concluir:
- Query: `SELECT COUNT(*) FROM documents WHERE uploaded_by='import_perfex'` deve ser > 0.
- Query: `SELECT COUNT(*) FROM documents WHERE uploaded_by='import_perfex' AND contract_id IS NOT NULL` mostra quantos PDFs assinados foram vinculados.
- Visual: abrir `/admin/clientes` → escolher cliente → aba **Anexos** deve listar os arquivos.
- Visual: logar como cliente em `/cliente/documentos` deve ver os arquivos nas abas certas.

## Arquivos alterados

- `supabase/functions/import-perfex-files/index.ts` — mais candidatos de URL, melhor mapeamento de `document_type`, logs detalhados.

## Arquivos NÃO alterados (já estão corretos)

- `src/pages/cliente/Documentos.tsx` — já filtra por `user_id` e exibe por `document_type`.
- `src/components/admin/clients/ClientDetailSheet.tsx` — aba Anexos já carrega `documents` por `user_id`.
- Schema do banco — nenhuma migração necessária.

## Riscos

- Alguns arquivos do Perfex podem ter sido apagados do servidor `crm.webmarcas.net`. Esses serão contados em `notFound` e listados nos logs — você decide se quer pedir o backup do `uploads/` para nova tentativa.
- Tempo total: pode levar 30-60 minutos de execução em background.
