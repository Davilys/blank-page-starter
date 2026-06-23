## Mudança

Remover o toggle "Cliente Especial" do diálogo **Editar Cliente** e transformá-lo em um botão de **ação rápida** na ficha, ao lado de **Nova Fatura**.

## Comportamento do botão

- Aparece junto aos demais botões (Chat, Mover, Email, Notificar, Excluir, Detalhes do Processo, Nova Fatura).
- Label: **"Cliente Especial"** com ícone ⭐.
- Visual reflete o estado atual:
  - **Inativo** (padrão): fundo neutro/cinza claro, ícone vazado — texto "Cliente Especial".
  - **Ativo**: fundo dourado (amber), ícone preenchido, texto "Cliente Especial ✓".
- Ao clicar: alterna `profiles.is_special_client` (UPDATE direto), mostra `toast` ("Cliente marcado como especial — sem cobrança de honorários" / "Cliente especial removido") e atualiza a lista.
- O chip dourado "⭐ Cliente Especial" no cabeçalho da ficha continua aparecendo quando ativo (já implementado).

## Arquivos

- `src/components/admin/clients/ClientDetailSheet.tsx`:
  - **Remover** o bloco `<Switch>` "Cliente Especial" do diálogo Editar Cliente.
  - Remover `is_special_client` do estado `editFormData` e do `UPDATE` em `handleSaveFullEdit`.
  - Adicionar o novo botão em `QUICK_ACTIONS` (id `'cliente_especial'`) e o respectivo handler `handleToggleSpecialClient()` que faz `update({ is_special_client: !current })` em `profiles` e chama `onUpdate()` + `fetchClientData()`.

Sem mudanças de schema, sem mudanças no `ServiceActionPanel` (continua lendo `client.is_special_client`).
