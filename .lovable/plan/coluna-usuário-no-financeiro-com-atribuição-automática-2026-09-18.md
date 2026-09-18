# Coluna "Usuário" no Financeiro com atribuição automática

## O que muda para você

Na tabela do Financeiro, entre **Cliente** e **Valor**, passa a existir a coluna **Usuário**:

- Se o cliente já tem um usuário responsável, aparece o nome dele (chip azul com primeiro nome do usuário).
- Se não tem, aparece o botão **"Sem responsável"** — ao clicar, abre a lista de administradores para atribuir.
- A atribuição é por **cliente** (não por fatura), então todas as cobranças daquele cliente mostram o mesmo responsável.

Atribuição automática: quando um usuário abre a ficha do cliente e faz uma ação financeira (criar fatura, cobrar, fazer acordo/parcelamento, enviar cobrança), o cliente passa a ficar atribuído a ele **se ainda não tiver responsável**. Se já tiver, o responsável não é trocado — a ação fica registrada no histórico.

## Como será feito

**1. Banco (migração aditiva)**
- `responsavel_atribuicao` hoje só aceita `entidade` = `invoice`, `devedor`, `publicacao`. Substituir essa checagem para incluir `cliente`. Mesma tabela, mesmas políticas de acesso, nada é apagado.

**2. `src/hooks/useResponsaveis.ts`**
- Incluir `"cliente"` no tipo `Entidade`. Nenhuma outra mudança de lógica.

**3. `src/pages/admin/Financeiro.tsx`**
- Novo cabeçalho `Usuário` entre Cliente e Valor (e `colSpan` das linhas vazias de 7 para 8).
- Carregar as atribuições com `useResponsaveis("cliente", ids)` usando os `user_id` dos clientes das faturas listadas.
- Renderizar `<ResponsavelChip entidade="cliente" entidadeId={invoice.user_id} responsavel={...} />` na nova célula; quando a fatura não tem cliente vinculado, mostrar apenas "—".
- O componente já existente cuida do popover de escolha de admin, do estado de carregamento e da remoção.

**4. `src/components/admin/clients/ClientDetailSheet.tsx`**
- Criar um auxiliar interno que chama `atribuirResponsavel("cliente", client.id, { somenteSeVazio: true, acao: "cobrou" })`.
- Acionar esse auxiliar nos retornos de sucesso das ações financeiras da ficha: `InvoiceActionsSheet.onChanged` (cobrança/acordo/parcelamento) e `NovaFaturaDialog.onCreated`.
- Como o hook do Financeiro escuta a tabela em tempo real, o nome aparece na lista sem precisar recarregar.

## Fora do escopo

Nenhuma alteração em valores, status, sincronização com o Asaas, filtros, permissões financeiras, outras abas da ficha ou demais módulos.
