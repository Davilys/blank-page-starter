

## Plano: Exportar Clientes para CRM Compativel (CSV)

### Resumo
Adicionar botao "Exportar CRM" na pagina de Clientes que gera um CSV com headers em snake_case compativeis com o auto-mapper do `clientParser.ts`, incluindo todos os campos do perfil + marca + pipeline_stage + client_funnel_type.

### Alteracoes

#### 1. `src/lib/clientExporter.ts` — Nova funcao `exportToCRMCSV`

- Nova interface `CRMExportableClient` com todos os campos: `full_name`, `email`, `phone`, `company_name`, `cpf_cnpj`, `address`, `neighborhood`, `address_number`, `address_complement`, `city`, `state`, `zip_code`, `origin`, `priority`, `contract_value`, `brand_name`, `pipeline_stage`, `client_funnel_type`, `process_number`, `created_at`
- Gera CSV com `Papa.unparse` usando separador virgula (`,`) e headers em snake_case
- Deduplicacao por `id + brand_name` (um registro por marca/processo)
- Adiciona BOM UTF-8 para compatibilidade
- Download automatico do blob

#### 2. `src/pages/admin/Clientes.tsx` — Novo botao + handler

- Novo botao "Exportar CRM" com icone `Download` ao lado do botao "Importar" (linha ~460)
- Handler `handleExportCRM`:
  - Busca dados completos dos perfis (incluindo `address`, `neighborhood`, `address_number`, `address_complement`, `city`, `state`, `zip_code` que nao sao carregados no fetch principal)
  - Combina com `brand_processes` ja carregados
  - Gera CSV de ambos os funis com todos os clientes
  - Sem dialog — exportacao direta com toast de feedback

### Detalhes Tecnicos

- O fetch principal de `profiles` na pagina nao inclui `address`, `neighborhood`, `address_number`, `address_complement`, `city`, `state`, `zip_code`. O handler fara uma query separada buscando esses campos adicionais e mesclando com os dados ja carregados.
- Usa `fetchAllRows` existente para paginar alem de 1000 registros.
- Headers snake_case mapeiam 1:1 com os aliases do `clientParser.ts`, garantindo importacao perfeita.

