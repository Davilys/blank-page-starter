# Ajustes na aba Publicações → Prazos

Duas melhorias cirúrgicas em `src/components/admin/publicacao/PublicacaoPrazos.tsx`, sem alterar nenhuma funcionalidade existente (buckets, filtros, atribuição automática, diálogos).

## 1. Rolagem horizontal da tabela de prazos

Hoje a tabela fica dentro de um `ScrollArea` (altura fixa) que só rola na vertical; quando a janela é minimizada/reduzida, as colunas da direita (Responsável, Ações/Notificar) ficam inacessíveis.

**Solução:**
- Substituir o `ScrollArea` por uma `div` com `overflow-auto` (rola nas duas direções) mantendo a mesma altura máxima (`h-[calc(100vh-500px)]`).
- Adicionar `min-w-[1150px]` na `Table` para forçar a barra de rolagem horizontal quando a viewport for estreita.
- Adicionar `whitespace-nowrap` nas células-chave (Cliente, Marca/Processo, datas, Ações) para as colunas manterem largura legível em vez de quebrar.
- Fixar o cabeçalho (`TableHead` com `sticky top-0 bg-background`) para continuar visível durante a rolagem vertical.

Isso vale para todas as abas de bucket (No Prazo, 30 Dias para Vencer, Última Semana, Vencidos, Cumpridos, Desistiu), pois todas usam a mesma tabela.

## 2. Cor do botão "Notificar" conforme notificações já enviadas

Os dados já existem: `schedules[pub.id]` (tabela `publicacao_cobranca_schedule`) com `notif_1_at`, `notif_2_at`, `notif_3_at`. Hoje o botão é sempre azul (outline primary).

**Nova regra de cor do botão Notificar:**
- Nenhuma notificação enviada → azul atual (sem mudança).
- `notif_1_at` preenchido (1ª notificação, 15 dias) → **verde**.
- `notif_2_at` preenchido (2ª notificação, 30 dias) → **amarelo**.
- `notif_3_at` preenchido (3ª/final, última semana) → **vermelho**.

A cor mais avançada vence (se notif_3 existe → vermelho, independente das anteriores). Implementado como classes de borda/texto no próprio botão, seguindo o padrão visual dos botões de andamento existentes. O clique continua abrindo o mesmo `NotificarClienteDialog`.

## Arquivos alterados
- `src/components/admin/publicacao/PublicacaoPrazos.tsx` (único arquivo)

## Fora de escopo
- Nenhuma mudança em edge functions, banco de dados ou na lógica de envio de notificações.
- Nenhuma mudança nas outras abas de Publicações (lista/kanban).
