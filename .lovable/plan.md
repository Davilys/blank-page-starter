## Objetivo
Substituir o autocomplete inline da coluna **Vincular cliente** (aba Prazos) por um diálogo robusto no estilo da aba **Revista**, e oferecer o botão **"Novo Cliente"** dentro do diálogo, reaproveitando o `CreateClientDialog` da aba Clientes.

## 1. Novo componente `VincularClienteDialog`
Arquivo: `src/components/admin/publicacao/VincularClienteDialog.tsx`.

Props: `open`, `onOpenChange`, `publicacao`, `clients`, `onLink(clientId)`.

Layout (espelha o Vincular Cliente da Revista):
- Cabeçalho com ícone `UserPlus` + título "Vincular Cliente" + descrição.
- Bloco resumo da publicação (Marca, Processo, Data publicação RPI).
- Campo **Buscar Cliente** com ícone, placeholder "Nome, email, empresa, CPF/CNPJ ou telefone…".
- Label "Selecionar Cliente (N disponíveis, K encontrados)" + botão `CreateClientDialog` (Novo Cliente) ao lado.
- `ScrollArea` de 240px listando até 50 resultados; cada item exibe nome, email, empresa e CPF/CNPJ; seleção destacada com `bg-primary/10`.
- Mensagens contextuais ("Digite ao menos 2 letras", "Nenhum cliente encontrado para …. Use Novo Cliente para cadastrar.").
- Footer: **Cancelar** + **Vincular Cliente** (desabilita até selecionar).

Quando `CreateClientDialog.onClientCreated` dispara, invalida `['profiles-pub']` via `useQueryClient` para repopular a lista; o admin então clica no novo cliente.

## 2. Integração em `PublicacaoPrazos.tsx`
- Remover o autocomplete inline (`linkingPubId`, `linkSearch` + dropdown popover) na célula "Cliente" órfã.
- Adicionar estado `linkDialogPub: any | null`. O botão `+ Vincular cliente` agora abre o diálogo.
- Renderizar `<VincularClienteDialog open={!!linkDialogPub} onOpenChange={(v) => !v && setLinkDialogPub(null)} publicacao={linkDialogPub} clients={clients} onLink={(id) => handleLinkClient(linkDialogPub, id)} />`.
- `handleLinkClient` mantém a lógica (resolve `process_id` via `process_number_rpi`, `update publicacoes_marcas`, `invalidateQueries(['publicacoes-marcas'])`).

## 3. Reuso do `CreateClientDialog`
- Importar `CreateClientDialog` diretamente; ele já traz seu próprio `DialogTrigger` (botão "Novo Cliente"), zero alterações no arquivo original.
- Após criação, `onClientCreated` invalida `['profiles-pub']`. A query em `PublicacaoTab` recarrega e o novo cliente aparece na busca.

## 4. Fora de escopo
- Sem migrações de banco.
- Sem mudanças no `CreateClientDialog` da aba Clientes.
- Sem mudanças no fluxo de notificações ou status.

## 5. Arquivos
- **Criar:** `src/components/admin/publicacao/VincularClienteDialog.tsx`.
- **Editar:** `src/components/admin/publicacao/PublicacaoPrazos.tsx` (remove autocomplete inline + render do novo diálogo).