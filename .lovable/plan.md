## Objetivo

No ficheiro do cliente (aba **Serviços**), quando o estágio selecionado for **ARQUIVADOS**, o "Painel de Ação" deve apenas **enviar a notificação** (e‑mail + WhatsApp) com textos específicos — **sem gerar cobrança/fatura**, sem campos de valor, parcelamento ou vencimento.

Para todos os outros estágios (Exigência, Oposição, etc.), o comportamento atual de "Notificação + Cobrança" permanece inalterado.

## Onde mexer

Apenas em **`src/components/admin/clients/ServiceActionPanel.tsx`** (estágio identificado por `stage.id === 'arquivado'`).

## Mudanças

### 1. Detectar modo "arquivado"
Adicionar `const isArquivado = stage.id === 'arquivado';` no topo do componente.

### 2. Textos novos (somente quando `isArquivado`)
Criar dois geradores dedicados que substituem os templates atuais ao montar o painel.

**E‑mail – assunto:** `Arquivamento do processo – {marca} – WebMarcas`

**E‑mail – corpo:**
```
Prezado {NOME DO CLIENTE},

Venho informar que o INPI publicou o arquivamento do processo da marca "{MARCA}". N. PROCESSO: {NÚMERO}

Conforme previsto contratualmente, a WebMarcas possui cláusula de garantia para os casos em que o arquivamento ocorra por decisão do INPI durante o exame do processo, possibilitando a abertura de um novo pedido sem cobrança de novos honorários advocatícios.

Entretanto, é importante esclarecer que a garantia contratual não se aplica em casos de arquivamento decorrente do não cumprimento de exigências ou publicações dentro do prazo legal estabelecido pelo INPI.

Dessa forma, precisamos agendar uma reunião com nosso departamento jurídico para análise completa do processo, verificação da aplicação da garantia contratual e definição das próximas medidas para eventual abertura de um novo pedido de registro.

Nos informe, por gentileza, o melhor dia e horário para alinharmos todos os detalhes da forma mais rápida e transparente possível.

Seguimos à disposição para quaisquer esclarecimentos.

Atenciosamente,
Equipe WebMarcas
www.webmarcas.net
WhatsApp: (11) 91112-0225
```

**WhatsApp:**
```
Olá, tudo bem?

Verificamos que o INPI publicou o arquivamento do processo da sua marca. Precisamos agendar um breve alinhamento com o nosso jurídico para analisar a aplicação da cláusula de garantia contratual e verificar a possibilidade de abertura de um novo processo sem cobrança de novos honorários.

Importante: a garantia é válida para casos de arquivamento por decisão do INPI, não se aplicando quando ocorre perda de prazo para cumprimento de exigência/publicação.

Qual o melhor horário para conversarmos? 🙏

Equipe WebMarcas
```

Substituições: `{NOME DO CLIENTE}` ← `client.full_name`, `{MARCA}` ← `client.brand_name`, `{NÚMERO}` ← `client.process_number` (se vazio, mostrar `0000000`).

### 3. UI condicional
Quando `isArquivado === true`:
- Subtítulo do painel: **"Notificação ao cliente"** (em vez de "Notificação + Cobrança").
- **Ocultar** completamente a seção `Cobrança` (Valor, Método/Parcelamento, info de vencimento).
- Manter: Mensagem (e‑mail), Mensagem WhatsApp, checkboxes de canais, anexos opcionais.
- Botão final: **"Enviar notificação"** (em vez de "Enviar notificação e cobrança").

### 4. Ação de envio (`handleSend`) condicional
Quando `isArquivado`:
- **Pular** a chamada `create-admin-invoice` (nenhuma fatura criada, nenhum link de pagamento gerado).
- Não anexar bloco "Link de pagamento" às mensagens.
- Continuar enviando: upload de anexos (se houver), `send-multichannel-notification` (canais `crm` + `whatsapp` se marcado) e `send-email` (se marcado).
- Registrar em `client_activities` com `activity_type: 'notificacao_arquivamento'` e descrição "Notificação de arquivamento enviada"; metadata sem `valor`/`invoice_id`.
- Toast: "Notificação de arquivamento enviada com sucesso!".

Nenhuma alteração em outros arquivos, edge functions ou no banco.
