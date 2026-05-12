## Objetivo

Substituir o HTML inline `buildDistratoHtml` pelo modelo padrão de distrato sem multa já existente em `src/lib/documentTemplates.ts` (`generateDistratoSemMultaContent`), para que o contrato de distrato gerado ao clicar em "Enviar Notificação + Distrato sem multa" use exatamente o mesmo texto/cláusulas do modelo padrão usado no resto do sistema.

## Mudança única

### `src/components/admin/clients/ServiceActionPanel.tsx`

1. Remover a função local `buildDistratoHtml` (não será mais usada).
2. Importar `generateDistratoSemMultaContent` de `@/lib/documentTemplates`.
3. Ampliar a leitura do `profiles` no bloco `if (isDistrato)` para incluir os campos exigidos pelo template padrão:
   - `full_name, cpf, cnpj, cpf_cnpj, company_name, address, city, state, zip_code, email, phone`.
4. Montar o objeto `vars` esperado por `generateDistratoSemMultaContent`:
   - `nome_empresa`: `profile.company_name || profile.full_name || client.full_name || 'Cliente'`
   - `cnpj`: CNPJ formatado se houver, senão CPF, senão `[a informar]`
   - `endereco`: `profile.address || '[Endereço a informar]'`
   - `cidade`: `profile.city || '[Cidade]'`
   - `estado`: `profile.state || '[UF]'`
   - `cep`: `profile.zip_code || '[CEP]'`
   - `nome_representante`: `profile.full_name || client.full_name || nome_empresa`
   - `cpf_representante`: CPF do profile (ou `cpf_cnpj` quando tiver 11 dígitos), senão `[CPF a informar]`
   - `email`: `profile.email || client.email || ''`
   - `telefone`: `profile.phone || client.phone || ''`
   - `marca`: `client.brand_name?.trim() || '[Nome da Marca]'`
5. Gerar o conteúdo de texto via `generateDistratoSemMultaContent(vars)` e convertê-lo para um HTML simples preservando quebras de linha:
   ```ts
   const text = generateDistratoSemMultaContent(vars);
   const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Distrato Contratual sem Multa</title></head><body style="font-family: Arial, Helvetica, sans-serif; color:#111; line-height:1.6; max-width:800px; margin:0 auto; padding:24px; white-space:pre-wrap;">${text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</body></html>`;
   ```
   Isso mantém o mesmo conteúdo do modelo padrão sem reescrever cláusulas.
6. Continuar inserindo na tabela `contracts` com:
   - `contract_type = 'distrato'`
   - `document_type = 'distrato_sem_multa'` (alinhado ao identificador do template padrão, em vez de `'distrato'` genérico)
   - `subject = 'Distrato Contratual sem Multa – ' + marca`
   - `description = 'Distrato sem multa – encerramento de responsabilidade'`
   - `contract_value = 0`, `penalty_value = 0`
   - `signatory_name`, `signatory_cpf`, `signatory_cnpj`
   - `contract_html` = HTML acima
7. Restante do fluxo (`generate-signature-link`, substituição de `[INSERIR LINK]`, `send-multichannel-notification`, `send-email`, `client_activities`) permanece exatamente igual.

## Fora do escopo

- Não alterar `documentTemplates.ts`.
- Não mexer no fluxo de Arquivado nem em outras etapas.
- Não criar nem alterar edge functions, banco ou políticas RLS.
- Não tocar nos textos de e‑mail/WhatsApp do distrato definidos no passo anterior.
