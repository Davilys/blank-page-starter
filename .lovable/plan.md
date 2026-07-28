# Mensagens de WhatsApp por fase (Painel de Serviços)

Alterar **apenas** a mensagem de WhatsApp gerada no `ServiceActionPanel` (aba Serviços do ficheiro do cliente). E-mails, cobranças e demais fluxos permanecem inalterados.

## Escopo
Arquivo único: `src/components/admin/clients/ServiceActionPanel.tsx`

## Mudanças

1. Modificar `generateWhatsAppTemplate(client, stage, _valor)` para escolher a mensagem com base em `stage.id`, cobrindo:
   - `exigencia_merito` (e alias `exigencia_de_mrito`) → texto "Exigência de Mérito"
   - `oposicao` → texto "Oposição"
   - `indeferimento` / `indeferido` → texto "Indeferimento"
   - `deferimento` / `deferido` → texto "Deferimento"
   - `certificado` / `certificados` → texto "Certificado"
   - `renovacao` → texto "Renovação"
   - Fallback (demais fases não citadas): mantém a mensagem atual (a genérica "houve uma atualização importante…").

2. Substituir a mensagem de WhatsApp para **Arquivado** dentro de `generateArquivadoWhatsApp` pelo novo texto fornecido (fase 7 – ARQUIVADO). O e-mail de arquivado (`generateArquivadoEmail`) permanece igual.

3. Cada template usa `${primeiroNome}` (primeiro nome do cliente) no lugar de `{{nome do cliente}}`, mantendo o padrão já existente no arquivo.

4. Nenhuma alteração em:
   - E-mails (`generateEmailTemplate`, `generateEmailTemplateSemCobranca`, `generateArquivadoEmail`)
   - Fluxo "Sem Cobrança" (Cliente Especial) — continuará usando `generateWhatsAppTemplateSemCobranca` como hoje
   - Distrato, cobrança, faturas, logs

## Detalhes técnicos
- Um `switch (stage.id)` dentro de `generateWhatsAppTemplate` retornando a string apropriada.
- Textos copiados exatamente conforme enviados pelo usuário (com emojis ⚠️/🎉 onde solicitado).
- Sem alteração de tipos ou props.
