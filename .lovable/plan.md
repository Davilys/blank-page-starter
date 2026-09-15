# Central de Email — novo arranjo visual (estilo da imagem)

Ajuste apenas visual e de organização da página `/admin/emails`. Nenhuma função, regra de acesso, sincronização, IA ou dado muda de comportamento. Cores continuam as atuais do CRM (azul e laranja WebMarcas), sem adotar as cores do exemplo.

## Como fica a tela

Quatro colunas, como na imagem de referência:

```text
┌──────────┬───────────────┬──────────────────────┬────────────┐
│ Menu     │ Lista de      │ Leitura da mensagem  │ Assistente │
│ lateral  │ mensagens     │ (responder, anexos)  │ IA         │
└──────────┴───────────────┴──────────────────────┴────────────┘
```

- Topo enxuto e fixo: título curto, campo de busca largo ao centro, estado real de sincronização, "Sincronizar agora" e "Novo email". O bloco alto com gradiente e os números grandes viram uma faixa discreta de uma linha.
- Coluna 1 (menu): botão "Novo email" em destaque, contas de email com o ponto de estado atual, pastas e ferramentas — mesma estrutura de hoje, só com espaçamento e tipografia mais limpos.
- Coluna 2 (lista): cabeçalho com o nome da pasta e contagem, abas "Todos / Não lidos / Com anexo", cartões de mensagem com inicial do remetente, nome, assunto, trecho, horário, selo de categoria e marcador de não lida. A mensagem aberta fica destacada.
- Coluna 3 (leitura): a mensagem abre ao lado da lista, em vez de substituir a lista. Ações (Responder, Responder a todos, Encaminhar, Arquivar, Favoritar, Excluir) numa barra fixa no topo do painel; anexos em cartão; caixa de resposta rápida no rodapé.
- Coluna 4 (assistente IA): painel lateral recolhível com o que já existe hoje — resumo da conversa, próxima ação sugerida, gerar rascunho e análise — contextualizado na mensagem aberta.

Telas internas (Templates, Campanhas, Sequências, Automações, Configurações) continuam ocupando a área principal inteira, como hoje.

## Responsivo

- Telas grandes: as quatro colunas.
- Telas médias: menu + lista + leitura; assistente vira botão que abre um painel sobreposto.
- Celular: uma coluna por vez, como hoje (lista → mensagem, menu em gaveta).

## Detalhes técnicos

- Arquivos tocados: `src/pages/admin/Emails.tsx`, `EmailSidebar.tsx`, `EmailList.tsx`, `EmailView.tsx`, `EmailSyncBar.tsx`, `EmailMetricsBar.tsx`, `AIEmailAssistant.tsx` — somente layout, classes e composição.
- `renderContent` deixa de alternar lista/leitura no desktop: passa a renderizar lista e leitura em paralelo, mantendo o comportamento atual de troca em mobile.
- Nenhuma cor nova fora dos tokens existentes (`--primary`, `--accent`, `--muted`, etc.); nada de cores fixas em componentes.
- Sem alteração em consultas, Edge Functions, paginação, contadores, realtime, permissões ou no painel de reparo de mensagens.
- Verificação: `bunx tsgo --noEmit` e conferência visual em desktop, tablet e celular.
