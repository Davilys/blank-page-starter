# Central premium da aba Chat ao Vivo

## Objetivo
Transformar a entrada atual em uma central de atendimento mais completa e sofisticada, seguindo a direção visual **Premium service hub**, sem alterar o funcionamento dos chats existentes.

## O que será feito
- Reorganizar a tela inicial com título forte, contexto de uso e três opções equilibradas: **ChatWeb**, **Consultoria Jurídica** e **BotConversa**.
- Aplicar o visual premium aprovado, adaptado à identidade e aos temas claro/escuro já existentes no CRM.
- Manter ChatWeb e BotConversa abrindo exatamente pelos fluxos atuais.
- Reutilizar integralmente o chat jurídico **Fernanda** já usado em Recursos INPI, com suas mensagens, anexos, voz, análise e integrações atuais; nenhuma nova IA será criada.
- Exibir a Consultoria Jurídica somente quando o usuário tiver permissão de visualização em **Recursos INPI**. Usuários sem essa liberação continuarão vendo apenas os canais permitidos, sem espaços vazios no layout.
- Incluir retorno claro à central ao sair de cada canal e ajustar a experiência para desktop e celular.
- Preservar a aba Recursos INPI e seu acesso atual à consultoria; o novo acesso será adicional.

## Detalhes técnicos
- Ampliar os modos da central para contemplar a consultoria jurídica.
- Usar `useAdminPermissions()` com `inpi_resources.can_view`, a mesma permissão já aplicada ao menu de Recursos INPI.
- Montar `INPILegalChatDialog` diretamente na página Chat ao Vivo, mantendo o componente e as chamadas existentes, sem duplicar backend, prompts ou lógica da IA.
- Usar apenas componentes e tokens semânticos do design system; não incorporar as imagens de referência na aplicação.

## Validação
- Conferir a central com e sem permissão de Recursos INPI.
- Verificar abertura, fechamento e retorno de ChatWeb, BotConversa e Fernanda.
- Confirmar que a consultoria continua disponível também em Recursos INPI.
- Testar organização, leitura e áreas de toque em desktop e mobile, além dos temas claro e escuro.
- Executar verificação de tipos, compilação e inspeção visual do fluxo acessível no preview.
