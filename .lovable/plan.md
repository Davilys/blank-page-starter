Identifiquei a causa do erro na área do cliente em **Meus Processos**.

O problema está no componente `PublicacoesCliente`: ele tenta usar `stCfg.bg`, mas quando a publicação vem do banco com um `status` não cadastrado em `STATUS_CONFIG`, a configuração fica `undefined` e a página inteira quebra.

Plano de correção:

1. Corrigir o fallback de status em `PublicacoesCliente`.
   - Adicionar uma configuração padrão real e segura.
   - Se vier status desconhecido, nulo ou antigo do banco, a página não quebra.

2. Proteger a renderização das publicações.
   - Garantir que `bg`, `color` e `label` sempre existam antes de renderizar o badge.
   - Exibir um status neutro quando o status não estiver mapeado.

3. Blindar datas inválidas na timeline e no prazo crítico.
   - Evitar quebra se `proximo_prazo_critico`, `data_deposito`, `data_publicacao_rpi` ou outras datas vierem vazias/inválidas.

4. Manter o restante da área do cliente igual.
   - Não alterar login, menu, financeiro, documentos, PDF, blockchain ou regras de negócio.
   - Correção focada apenas em fazer a aba **Meus Processos** funcionar sem tela branca.

5. Validar após aplicar.
   - Abrir `/cliente/processos`.
   - Confirmar que lista, kanban e publicações carregam sem cair na tela de erro.