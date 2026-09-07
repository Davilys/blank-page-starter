# Atualização cadastral na aba Contatos do cliente

## O que o usuário vai ver

Na ficha do cliente, aba **Contatos**, aparece um botão **↻ Atualizar os dados**, ao lado do bloco "Dados Pessoais".

Ao clicar, abre a janela **Atualização cadastral** mostrando nome e CPF/CNPJ já cadastrados e a frase "Vamos verificar se existem dados cadastrais mais recentes". Nada é consultado até o operador clicar em **🔍 Verificar dados atualizados**.

Durante a consulta: "Consultando dados..." com indicador de progresso e botão bloqueado. Depois: "Consulta concluída" e uma comparação **Cadastro atual × Dados encontrados**, campo a campo, com marcação:

- 🟢 Sem alteração
- 🟠 Dado atualizado encontrado
- 🔵 Novo dado encontrado

Cada divergência tem uma caixa de seleção "Atualizar este dado" (para telefone/e-mail novos: "Adicionar"). No rodapé: **Cancelar** e **Atualizar dados selecionados** (desabilitado enquanto nada estiver marcado). Ao salvar: "Dados atualizados com sucesso." e a ficha se atualiza na hora.

No desktop a comparação fica lado a lado; no celular empilhada (atual → encontrado → ação).

## Regras de dados

- Nunca sobrescrever nada automaticamente; só o que for marcado.
- Telefones e e-mails existentes nunca são apagados: novos são **somados** aos atuais.
- Comparação normalizada — `(11) 99999-9999`, `11999999999` e `+55 11 99999-9999` são o mesmo telefone; e-mail compara sem diferenciar maiúsculas/espaços. Sem duplicidade.
- Endereço e dados da empresa (razão social, nome fantasia, situação cadastral, CNAE, abertura, capital social) só mudam com confirmação.
- Se faltar CPF e CNPJ: mensagem "Não foi possível realizar a consulta porque falta CPF ou CNPJ no cadastro." e atalho "Editar cadastro".
- CPF: nenhum provedor autorizado configurado hoje → mensagem "Consulta de CPF não disponível no momento." (sem erro técnico, sem dados falsos). Nenhuma base ilegal, nenhum scraping.

## Histórico

Cada atualização registra no histórico do cliente: "Atualização cadastral realizada", com usuário, data/hora, fonte consultada (BrasilAPI/ViaCEP), campos encontrados e campos efetivamente atualizados. CPF/CNPJ não são gravados por extenso no log.

## Detalhes técnicos

**Banco (migração)** — a tabela `profiles` hoje só tem um telefone e um e-mail. Acréscimos, sem mexer nos campos atuais:
- `additional_phones text[] default '{}'`, `additional_emails text[] default '{}'`
- `address_number text`, `address_complement text`
- `trade_name text`, `registration_status text`, `cnae text`, `opening_date date`, `share_capital numeric`
- Auditoria reutiliza a tabela existente `client_activities` (`activity_type = 'atualizacao_cadastral'`, detalhes em `metadata`).

**Camada de serviços** (`src/lib/dataEnrichment/`), sem lógica de consulta em componentes:
- `providers/brasilApiProvider.ts`, `providers/viaCepProvider.ts`, `providers/cpfProvider.ts` (retorna `unavailable`)
- `enrichmentService.ts` (escolhe provedor: CNPJ > CPF > nome; timeout, rate limit, cache em memória por CNPJ)
- `comparisonService.ts` (normalização de telefone/e-mail/CEP e cálculo de status por campo)
- `mergeService.ts` (merge aditivo, sem duplicidade)
- `types.ts` com a interface de provedor para plugar Serpro/provedor pago depois.

**Edge Function** `enrich-client-data`: proxy das consultas (BrasilAPI/ViaCEP), validação de CNPJ, timeout e mensagens de erro amigáveis. Deixa o ponto de entrada pronto para provedores pagos com chaves em Secrets — nenhuma chave no frontend.

**UI**: novo componente `src/components/admin/clients/DataEnrichmentDialog.tsx` (shadcn Dialog, cards/badges do padrão atual). Em `ClientDetailSheet.tsx` só entram o botão na aba Contatos e o render do diálogo; nenhuma outra aba é tocada.

**Erros tratados**: API fora do ar, nenhum dado novo, CNPJ inválido, CPF indisponível — todos com texto amigável, sem stack trace ou URL interna.

Ao final: verificação de TypeScript e build.
