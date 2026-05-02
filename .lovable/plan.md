## Diagnóstico

Baixei o dump real (`https://crm.webmarcas.net/u973561543_perfexcrm.sql`, 70 MB) e inspecionei a estrutura. O parser atual está com bugs que fazem tudo zerar:

### Quantos registros REAIS existem no dump deste projeto

| Tabela | INSERTs encontrados |
|---|---|
| `tblcontacts` (clientes-pessoa) | 16 |
| `tblclients` (empresas) | 18 |
| `tblcontracts` | **1.683** |
| `tblfiles` | 30 |

Observação: a imagem do outro projeto mostra 2.808 clientes / 8.226 arquivos — eram dumps **diferentes** (CRMs distintos). Para este dump específico do `webmarcas.net`, o esperado é em torno de 16-18 clientes, ~1.500 contratos assinados e 30 arquivos. O número alto da imagem não pode ser reproduzido aqui — os dados não existem.

### Bugs encontrados no parser/importers atuais

1. **Tabela inexistente**: o parser procura `tblwebmarcas_customers` que não existe neste dump.
2. **Regex sem word-boundary**: `tblcontracts` casa também `tblcontracts_types`, `tblcontract_comments`, `tblcontract_renewals` — embaralha resultados.
3. **Mapping de contratos quebrado**: o parser exporta linhas brutas do Perfex (com colunas `client`, `acceptance_email`, `signed='1'`...), mas `import-perfex-contracts` lê `client_email`, `perfex_id`, `signed` (boolean), `signed_at`, `signatory_name`, `content_html` — campos que **nunca são preenchidos**. Resultado: 0 importados.
4. **Mapping de arquivos quebrado**: o parser exporta linhas brutas de `tblfiles`, mas `import-perfex-files` lê `f.client_email` que nunca é populado. Resultado: 0 importados.
5. **Contas erradas**: cada `INSERT INTO` neste dump é single-row (uma linha por statement). O contador atual conta certo, mas a falta de transformação faz tudo virar lixo no JSON.
6. **Path de download dos arquivos**: precisa incluir variação `uploads/{rel_type}/{rel_id}/{attachment_key}` (formato real do Perfex).

## Plano de correção

Reescrever **2 edge functions** (sem mexer em UI nem em outras funções):

### 1. `parse-perfex-dump/index.ts` — reescrita

- Remover referência a `tblwebmarcas_customers`.
- Adicionar word-boundary no regex (`tblcontracts\\b` via verificação de char seguinte).
- **Construir `customers.ndjson.gz` a partir de `tblcontacts` JOIN `tblclients` (por `userid`)**, com schema que `import-perfex-customers` espera:
  ```
  { perfex_id, email, full_name, phone, company_name, cpf, cnpj, address, city, state, zip_code, brand_name }
  ```
  CPF/CNPJ vêm de `tblclients.vat` (11 ou 14 dígitos).
- **Construir `contracts.ndjson.gz` (apenas `signed=1`)** com schema esperado pelo importer:
  ```
  { perfex_id, perfex_client_id, client_email, subject, description, content_html,
    contract_value, start_date, end_date, signed: true,
    signed_at, signature_ip, signatory_name, signatory_email, hash, date_added }
  ```
  Resolver `client_email` via lookup `userid → contacts.email` (primary contact).
- **Construir `files.ndjson.gz`** com schema esperado:
  ```
  { perfex_id, rel_id, rel_type, file_name, filetype, attachment_key, client_email, date_added }
  ```
  Para `rel_type='customer'` resolver email via `userid` direto.
  Para `rel_type='contract'` resolver email via `tblcontracts.client → tblcontacts.userid → email`.
- Mostrar nas estatísticas finais quantos contratos sem cliente foram descartados.

### 2. `import-perfex-files/index.ts` — pequeno ajuste

Adicionar mais 2 variantes de path para baixar os arquivos do servidor antigo:
```
https://crm.webmarcas.net/uploads/{rel_type}/{rel_id}/{file_name}
https://crm.webmarcas.net/uploads/{rel_type}_files/{rel_id}/{file_name}
https://crm.webmarcas.net/uploads/{rel_type}s/{rel_id}/{file_name}
+ https://crm.webmarcas.net/download/file/{attachment_key}      (novo)
+ https://crm.webmarcas.net/uploads/companylogo/{file_name}      (novo, fallback)
```

### O que NÃO muda

- UI (`PerfexImportSection.tsx`) — fluxo está correto.
- `import-perfex-customers/index.ts` — schema esperado já é o que o novo parser produzirá.
- `import-perfex-contracts/index.ts` — idem.
- Migration / bucket / RLS — já está OK.
- Qualquer outra parte do app.

## Resultado esperado após correção

Para o dump atual:
- **Clientes**: ~16 novos importados (já que muitos podem já existir no CRM).
- **Contratos assinados**: ~1.500 importados (vinculados via email).
- **Arquivos**: até 30 baixados do servidor antigo (alguns podem 404 se já foram removidos do Hostinger).

O fluxo na UI continua o mesmo: upload do `.sql` → parse mostra estatísticas reais → executar fases 1 → 2 → 3.
