# Corrigir upload de documentos em Recursos INPI

## Implementação
- Tornar o arquivo visível imediatamente após a seleção, com estado **Enviando**, mantendo-o na lista durante armazenamento, gravação e leitura.
- Exibir no próprio item o erro real de qualquer etapa e oferecer **Tentar novamente**, sem remover silenciosamente o arquivo.
- Garantir que falha após o envio ao armazenamento seja compensada ou retomada com segurança, preservando autenticação e bucket privado.
- Restaurar documentos persistidos ao abrir/recarregar o caso e permitir avançar com qualquer arquivo utilizável, apenas indicando grupos ausentes.

## Verificação
- Testar PDF no viewport de celular e desktop: seleção, visibilidade imediata, estado Recebido, recarga e avanço à análise.
- Verificar falhas controladas e nova tentativa, sem duplicar arquivo ou registro.
- Não alterar outros módulos e não publicar.

## Limite de validação
- O ambiente usa autenticação externa não gerenciada. A validação autenticada completa será executada quando houver uma sessão administrativa disponível; até lá, os fluxos públicos e testes isolados serão verificados sem reduzir permissões.
