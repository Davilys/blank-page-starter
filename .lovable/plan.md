## Diagnóstico da auditoria

O problema não está no hash do contrato em si. Eu conferi o hash do print (`b5899a2bf90462f0ea3de4223192f7436869c58d31af21e3ae54bdb7d4613e45`) e ele existe no Supabase em um contrato assinado, com `signature_status = signed`, `blockchain_hash`, timestamp, txId e arquivo `.ots` gravados.

O erro principal é que a página pública `/verificar-contrato` chama a função RPC `verify_contract_by_hash`, mas essa função não existe mais no schema público do banco. Resultado: mesmo com o hash correto, a página cai como “Contrato Não Encontrado”.

Também encontrei inconsistências secundárias:
- Alguns botões abrem `/verificar-contrato?id=...`, mas a tela só valida `?hash=...`.
- PDFs/QR codes e e-mails podem usar o domínio atual do navegador (`window.location.origin`), gerando links diferentes dependendo de onde o contrato foi assinado/baixado.
- A verificação deve aceitar o hash de forma canônica e pública, sem expor dados sensíveis do contrato.

## Plano de correção

1. **Restaurar a RPC pública de validação**
   - Criar/recriar `public.verify_contract_by_hash(p_hash text)` como `SECURITY DEFINER`.
   - Retornar apenas dados seguros: número do contrato, hash, txId, rede, timestamp, data de assinatura e assunto/marca.
   - Validar somente contratos assinados e com hash blockchain preenchido.
   - Conceder execução para `anon` e `authenticated`, mantendo a tabela protegida por RLS.

2. **Tornar a tela `/verificar-contrato` compatível com links antigos**
   - Continuar validando `?hash=...`.
   - Corrigir ou tratar links com `?id=...` para não mostrarem inválido indevidamente.
   - Normalizar o hash digitado/recebido: minúsculo, sem espaços e somente 64 caracteres hexadecimais.
   - Exibir erro técnico no console quando a RPC falhar, para não mascarar problema futuro como “não encontrado”.

3. **Corrigir links internos que usam `id` no lugar de `hash`**
   - Ajustar a área do cliente/documentos para abrir verificação com `?hash=<blockchain_hash>` quando o contrato estiver assinado.
   - Se não houver hash, manter fallback seguro para visualização interna/documento.

4. **Padronizar o domínio do QR Code e link de verificação**
   - Usar uma função utilitária/canônica para montar o link público de verificação.
   - Priorizar domínio oficial configurado/produção em vez do domínio temporário de preview quando o PDF/QR for gerado.
   - Atualizar QR e texto de verificação no PDF assinado para apontarem para o mesmo link que a tela valida.

5. **Validar com dados reais**
   - Testar a RPC diretamente com o hash do print.
   - Testar `/verificar-contrato?hash=b5899a2bf90462f0ea3de4223192f7436869c58d31af21e3ae54bdb7d4613e45` e confirmar que aparece como contrato verificado.
   - Conferir que um hash inexistente continua retornando “Contrato Não Encontrado”.

## Arquivos/áreas que serão alterados

- Migração Supabase para restaurar `verify_contract_by_hash`.
- `src/pages/VerificarContrato.tsx` para normalização, fallback e tratamento de erro.
- `src/pages/cliente/Documentos.tsx` para não abrir verificação por `id` quando já existe hash.
- Componentes/hooks de geração de PDF/QR se necessário para padronizar o link canônico.