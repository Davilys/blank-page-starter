## Objetivo
Na aba **Revista INPI → Histórico**, permitir que o admin **exclua manualmente** o histórico de uma RPI (e seus processos vinculados), e impedir que a **Busca Remota** baixe novamente uma RPI já processada (evitando duplicatas como as 28x da RPI 2873 hoje no banco).

## O que será alterado

### 1. Excluir histórico por RPI (manual, pelo admin)
Em `src/pages/admin/RevistaINPI.tsx`, na aba **Histórico**:
- Adicionar um botão de lixeira (`Trash2`) em cada card de upload, ao lado da seta `ArrowRight`.
- Ao clicar, abre um `AlertDialog` de confirmação mostrando "RPI {número} • {file_name}".
- Confirmando, executa:
  - `DELETE FROM rpi_entries WHERE rpi_upload_id = :id`
  - `DELETE FROM rpi_uploads WHERE id = :id`
- Toast de sucesso, recarrega a lista (`fetchUploads`) e limpa `selectedUpload` se for o atual.
- `stopPropagation` no botão para não abrir o detalhe ao clicar.

Adicionar também um botão no topo da aba: **"Limpar duplicados"** que detecta uploads com mesmo `rpi_number` e mantém apenas o mais recente concluído (`status = completed`), removendo os demais com confirmação prévia mostrando quantos serão removidos.

### 2. Evitar duplicidade na Busca Remota
Em `supabase/functions/fetch-inpi-magazine/index.ts`, no fluxo de download (modo com `rpiNumber`), antes de inserir em `rpi_uploads`:
- Consultar `rpi_uploads` por `rpi_number = targetRpi` com `status = completed`.
- Se já existir, retornar resposta `409` informativa: `{ error: 'ALREADY_DOWNLOADED', message: 'RPI {n} já foi baixada em {data}', existingUploadId, force: false }` em vez de baixar novamente.
- Aceitar parâmetro opcional `force: true` no body para permitir refetch deliberado (caso o admin precise reprocessar). Quando `force=true`, antes de inserir o novo upload, apaga os existentes da mesma RPI (`rpi_entries` + `rpi_uploads`) para manter base limpa.

No frontend (`handleRemoteFetch`):
- Tratar o erro `ALREADY_DOWNLOADED`: mostrar `toast` com botão "Reprocessar mesmo assim" que rechama com `force: true`.
- Na UI de seleção de RPI no `<Select>` da Busca Remota, marcar com badge `Já baixada` os números que já constam em `uploads` (informação já carregada no estado `uploads`).

### 3. Permissões / RLS
A tabela `rpi_uploads` e `rpi_entries` já são geridas por admins. Verificar se há policy de DELETE para admins; caso falte, criar migration:
- `CREATE POLICY "admins delete rpi_uploads" ON rpi_uploads FOR DELETE USING (has_role(auth.uid(), 'admin'));`
- Mesmo para `rpi_entries`.

(Só será adicionada se a verificação mostrar que falta — a checagem será feita antes da migration.)

## Fora de escopo
- Não alterar parser XML, fluxos de matching de cliente, notificações, nem outras abas (Busca Remota mantém UX, só ganha guard de duplicidade).
- Não excluir automaticamente: a limpeza é sempre manual e confirmada pelo admin.

## Arquivos afetados
- `src/pages/admin/RevistaINPI.tsx` (UI Histórico + Busca Remota)
- `supabase/functions/fetch-inpi-magazine/index.ts` (guard de duplicidade + força)
- Possível migration nova para policies de DELETE (apenas se ausentes)
