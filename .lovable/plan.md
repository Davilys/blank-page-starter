# Publicação: abrir direto em Prazos + filtro por responsável

## O que será feito

### 1. Remover o botão "Abrir Prazos" e abrir direto na visão Prazos
- Arquivo: `src/components/admin/PublicacaoTab.tsx`
- Remover o card "Controle de Prazos das Publicações" com o botão "Abrir Prazos" (linhas ~1738–1760) — ele é redundante, pois a alternância Lista/Kanban/Prazos já existe na barra da lista.
- Mudar o estado inicial de `viewMode` de `'kanban'` para `'prazos'` (linha 346): ao clicar em "Publicação" no menu, a página já abre selecionada em **Prazos**.
- As visões Lista e Kanban continuam acessíveis pelos botões de alternância — nada é removido além do botão redundante.

### 2. Filtro "Todos os responsáveis" pelos clientes do usuário (igual à Premiação)
- Arquivo: `src/components/admin/publicacao/PublicacaoPrazos.tsx`
- O dropdown "Todos os responsáveis" já existe e filtra, mas hoje usa o responsável atribuído à **publicação** (`useResponsaveis('publicacao', ...)`).
- Ajustar para filtrar pelo **usuário dono do cliente** (mesma lógica da Premiação: `profiles.assigned_to`, com fallback para `created_by`), de modo que ao escolher "Caroline", por exemplo, apareçam apenas os prazos dos clientes dela — em todos os status de prazo (No Prazo, 30 Dias, Última Semana, Vencidos, Cumpridos, Desistiu).
- "Todos" continua mostrando tudo; manter a opção "Sem responsável" para clientes sem usuário atribuído.

## O que NÃO muda
- Nenhuma regra de prazo, status, contadores, notificações, banco de dados ou outras abas do CRM.
- As visões Lista e Kanban continuam existindo e funcionando.

## Verificação
- Typecheck (`tsgo --noEmit`).
- Abrir Publicação: deve abrir direto em Prazos, sem o card/botão "Abrir Prazos".
- Filtrar por um usuário: apenas os clientes dele aparecem; voltar para "Todos" mostra tudo.
