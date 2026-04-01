

## Corrigir apenas os fallbacks de domínio: `webmarcas.net` → `webpatentes.com.br`

### Escopo reduzido (mudança provisória)

Alterar **apenas** as constantes de fallback/produção, sem tocar em textos de template ou emails.

### Arquivos e alterações

1. **`supabase/functions/generate-signature-link/index.ts`** (linha 37)
   - `PRODUCTION_DOMAIN = 'https://webmarcas.net'` → `'https://webpatentes.com.br'`

2. **`src/hooks/useContractPdfGenerator.ts`**
   - Footer: `www.webmarcas.net` → `www.webpatentes.com.br`
   - Footer email: `juridico@webmarcas.net` → `juridico@webpatentes.com.br`

3. **`src/components/contracts/ContractRenderer.tsx`**
   - Fallback URL no header/footer → `webpatentes.com.br`

4. **`src/components/contracts/DocumentRenderer.tsx`**
   - Fallback URL de verificação → `webpatentes.com.br`

5. **`src/hooks/useUnifiedContractDownload.ts`** e **`src/hooks/useContractPdfUpload.ts`**
   - Apenas URLs de fallback no header/footer do PDF

Somente domínios em URLs e emails de rodapé. Nome "WebMarcas" permanece intacto.

