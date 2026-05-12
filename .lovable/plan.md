## Objetivo

Quando o admin clicar na etapa **Distrato** dentro do ficheiro do cliente (aba Serviços) e acionar o painel de ação:

1. **Não gerar cobrança** (igual ao fluxo de "Arquivado").
2. **Criar automaticamente um contrato de distrato sem multa** já preenchido com os dados do cliente.
3. **Gerar o link de assinatura digital** desse distrato.
4. **Enviar a notificação extrajudicial** com o link tanto por **e‑mail** como por **WhatsApp**, usando os textos exatos solicitados.
5. Botão do painel passa a ser **"Enviar Notificação + Distrato sem multa"**.

Tudo limitado à etapa cujo `stage.id === 'distrato'`. Outras etapas seguem inalteradas.

## Mudanças

### 1. `src/components/admin/clients/ServiceActionPanel.tsx`

- Adicionar flag `isDistrato = stage.id === 'distrato'`.
- Tratar `isDistrato` no mesmo nível de `isArquivado`: ocultar bloco de Cobrança, pular `create-admin-invoice`, mudar subtítulo para "Notificação Extrajudicial – Distrato", botão para "Enviar Notificação + Distrato sem multa" (e "Reenviar..." quando já houver registro).
- Novos templates (preenchimento automático com `client.full_name`, `client.brand_name`, `client.process_number`; placeholders `[NOME DA MARCA]` / `[Nº DO PROCESSO]` quando órfão):
  - **E‑mail**
    - Assunto: `Notificação Extrajudicial – Distrato Contratual e Encerramento de Responsabilidade`
    - Corpo: texto fornecido pelo usuário, com `[INSERIR LINK]` substituído pelo link de assinatura ao enviar.
  - **WhatsApp**: texto fornecido pelo usuário, com `[INSERIR LINK]` substituído pelo link.
- No `handleSend`, quando `isDistrato`:
  1. Inserir registro em `public.contracts` via `supabase.from('contracts').insert({...})` com:
     - `user_id = client.id`
     - `process_id = client.process_id`
     - `contract_type = 'distrato'`
     - `document_type = 'distrato'`
     - `subject = 'Distrato Contratual – ' + (brand_name || 'Marca')`
     - `description = 'Distrato sem multa – encerramento de responsabilidade'`
     - `contract_value = 0`, `penalty_value = 0`
     - `signatory_name`, `signatory_cpf`, `signatory_cnpj` (lidos do `profiles` do cliente)
     - `contract_html`: HTML gerado a partir de um template fixo de distrato sem multa (cláusula 9.1, prazo de 30 dias, sem cobrança de multa). Inclui dados do cliente, marca, processo e data.
     - `signature_status = 'pending'`, `visible_to_client = true`, `start_date = hoje`, `created_by = admin.id`.
     - `contract_number`: `DIST-<timestamp>` (ou padrão usado no resto do app).
  2. Chamar a edge function `generate-signature-link` com `{ contractId, baseUrl: window.location.origin }` e capturar `data.url` como `signatureUrl`.
  3. Substituir `[INSERIR LINK]` nas mensagens (e‑mail e WhatsApp) pelo `signatureUrl`. Não anexar bloco extra.
  4. Enviar via `send-multichannel-notification` (canais `crm` + `whatsapp` quando marcado) com `event_type: 'distrato_enviado'`, `data: { link: signatureUrl, marca, contract_id }`.
  5. Enviar e‑mail via `send-email` com o assunto exato e corpo final, incluindo anexos opcionais já carregados.
  6. Registrar `client_activities` com `activity_type: 'notificacao_distrato'`, `description` resumida e `metadata` contendo `contract_id`, `signatureUrl`, `stage_id`.
  7. Toast: "Notificação de distrato enviada com sucesso!".
- Pré‑carregar dados extras do cliente (cpf, cnpj) no `ClientDetailSheet` ou ler dentro do `handleSend` via `supabase.from('profiles').select('cpf, cnpj, full_name').eq('id', client.id).single()` para preencher os campos do contrato. (Adicionar essa leitura dentro do próprio `handleSend` para isolar a alteração.)

### 2. Sem alterações em outros arquivos

- Não mexer em edge functions, banco, modelos de contrato existentes, fluxo de `arquivado` ou demais etapas.
- Reutilizar `generate-signature-link`, `send-multichannel-notification` e `send-email` já disponíveis.

## Detalhes técnicos do template HTML do distrato

HTML simples, inline, contendo:

```text
INSTRUMENTO PARTICULAR DE DISTRATO CONTRATUAL — SEM MULTA
Partes: WebMarcas (CONTRATADA) e {nome_cliente} ({cpf/cnpj}) (CONTRATANTE)
Objeto: encerramento do contrato de prestação de serviços referente ao
processo da marca "{marca}" (Nº {processo}) junto ao INPI.
Cláusula 1ª — As partes, de comum acordo, rescindem o contrato original,
nos termos da Cláusula 9.1, com aviso prévio de 30 dias.
Cláusula 2ª — Não há aplicação de multa rescisória.
Cláusula 3ª — A WebMarcas deixa de possuir qualquer vínculo, responsabilidade
de acompanhamento ou obrigação perante o referido processo no INPI a partir
da assinatura deste instrumento (ou do término do prazo de 30 dias caso não
seja assinado).
Cláusula 4ª — Este distrato possui validade jurídica conforme a Lei
13.874/2019 e MP 2.200-2/2001.
Local e data: {cidade/UF}, {data por extenso}.
```

Validação final: build TypeScript do Vite continua passando; envio testado pelo próprio usuário no preview.