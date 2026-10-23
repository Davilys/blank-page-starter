# Fernanda - matriz e roteiro de homologação offline

## Escopo

Somente o fluxo duplicado `1- INSTINC`. `1- AT FINAL SEMANA` é controle negativo e não pode mudar. A homologação começa offline; preview, BotConversa real e integrações externas permanecem desligados.

## Contrato conversacional

- Uma Fernanda contínua, sem handoff entre agentes.
- Uma pergunta por mensagem.
- O estado persiste `stage`, resumo, dados coletados e ação pendente; uma resposta nova complementa a memória e não reinicia perguntas já respondidas.
- O telefone vem da identidade do contato/subscriber do WhatsApp; Fernanda não pergunta o número.
- Busca INPI apenas textual exata. Recomendar somente classes defensáveis e marcar apenas a principal.
- Valores: PIX R$ 699; cartão 6x R$ 199 (R$ 1.194); boleto 3x R$ 399 (R$ 1.197).
- Questão jurídica complexa: explicar que precisa de Caroline, consultar disponibilidade real, oferecer opção concreta e criar evento somente após aceite.
- Follow-ups de inatividade: 10 min, 24 h e 5 dias, todos cancelados por qualquer resposta recebida.
- Contrato: criar uma vez no backend, aguardar sucesso/link e só então enviar o link. Nunca usar “Criar cliente e enviar”.

## Matriz mínima

| ID | Cenário | Resultado esperado |
|---|---|---|
| C01 | Lead responde dados em ordem | Uma pergunta por vez; memória cresce sem repetir |
| C02 | Lead antecipa vários dados | Salvar todos; perguntar somente o próximo ausente |
| C03 | Áudio transcrito | Mesmo estado e regras de uma mensagem de texto |
| C04 | Telefone ausente no texto | Usar subscriber; nunca perguntar telefone |
| C05 | Busca exata sem colisão | Registrar evidência; seguir para classes |
| C06 | Marca semelhante/ambígua | Não prometer deferimento; limitar análise |
| C07 | Classes | Mostrar defensáveis; principal pré-selecionada |
| C08 | PIX/cartão/boleto | Exibir exatamente 699 / 6x199 / 3x399 |
| C09 | Resposta após follow-up 1 | Cancelar passos 2 e 3 imediatamente |
| C10 | Resposta antes de 10 min | Nenhum follow-up enviado |
| C11 | Evento inbound repetido | Não duplicar mensagem, processo ou contrato |
| C12 | Duas execuções simultâneas | Uma reivindica o job; outra não duplica efeito |
| C13 | Falha antes do link | Não dizer que contrato foi criado; retry seguro |
| C14 | Contrato já concluído | Retornar o mesmo contrato/link |
| C15 | Jurídico complexo | Pedir permissão para checar Caroline; sem evento automático |
| C16 | Caroline indisponível | Oferecer próxima opção verificada, sem inventar horário |
| C17 | Pergunta fora do escopo | Responder o possível e retomar estado sem reset |
| C18 | Opt-out/negação | Encerrar e cancelar follow-ups |
| C19 | Fluxo `1- AT FINAL SEMANA` | Zero mudança/efeito |
| C20 | Scanner sanitizado | Zero URL externa, cron, segredo ou provider ativo |

## Roteiro quando a preview for liberada

1. Confirmar HEAD remoto e gates verdes.
2. Confirmar `Deploy to production=false`, `Automatic branching=false` e working directory `preview/fernanda`.
3. Criar uma única preview manual e registrar custo/ref.
4. Esperar saúde e migrations. Não conectar BotConversa.
5. Inserir apenas fixtures sintéticas; executar C01-C20 por chamadas internas isoladas/mocks.
6. Conferir visualmente no painel de auditoria: conversa única, memória, follow-ups cancelados, uma criação de contrato e link somente após sucesso.
7. Falha: capturar logs antes de excluir; excluir somente a preview nova. Nunca tocar `lqsclrvczcwqeuxdmuaw`.
8. Sucesso: guardar evidências e solicitar decisão separada antes de qualquer conexão real.
