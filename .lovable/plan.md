# Plano — Validação, Testes e Correção do módulo Recursos INPI

Objetivo: validar as mudanças recentes (Files API, evidências Cliente/Concorrente, `[DOC:NN]`, ajustes com IA otimizados) e corrigir qualquer regressão antes de considerar concluído.

## Fase 1 — Auditoria de código (sem mudanças)

1. Reler os arquivos tocados para checar coerência:
   - `supabase/functions/process-inpi-resource/index.ts` (Files API + evidenceBlock nos 2 passes + procurador/notificação intactos)
   - `supabase/functions/adjust-inpi-resource/index.ts` (Responses API, timeout, retry)
   - `supabase/functions/extract-resource-evidences/index.ts` (coluna `party` gravada)
   - `src/components/admin/inpi/EvidenceGallery.tsx` (abas Cliente/Concorrente, filtro por `party`, contadores)
   - `src/components/admin/INPIResourcePDFPreview.tsx` (render de `[DOC:NN]` inline + anexos + rodapé/cabeçalho intactos + PDF)
   - `src/pages/admin/RecursosINPI.tsx` (regenerar envia `party`/`docNumber`)
2. Remover imports/variáveis não usados que aparecerem; garantir tipagens; sem lockfile/regen de deno.lock.

## Fase 2 — Testes E2E via Playwright (localhost:8080, sessão admin injetada)

Roteiro num único script `/tmp/browser/recursos_inpi/audit.py` com screenshots por cenário:

- **C1 Criar recurso**: abrir `/admin/recursos-inpi`, escolher tipo, agente, anexar 1 PDF pequeno, gerar rascunho; medir tempos console (`file_upload_dedupe`, `ai_generation`).
- **C2 Ajustes com IA**: rodar 2 ajustes seguidos, medir latência, garantir zero timeout.
- **C3 Evidências Cliente**: upload 2 imagens na aba Cliente; recarregar; confirmar contagem e `party='cliente'` via `supabase.from('inpi_resource_evidences').select`.
- **C4 Evidências Concorrente**: upload 2 imagens na aba Concorrente; confirmar isolamento entre abas.
- **C5 Regenerar com evidências**: clicar "Regenerar", validar no texto retornado a presença dos marcadores `[DOC:01]…[DOC:0N]` e que Cliente/Concorrente estão citados nos parágrafos corretos.
- **C6 Preview**: abrir preview, screenshot; verificar que imagens inline aparecem no lugar dos marcadores, cabeçalho e rodapé preservados, quebras de página nas fronteiras seguras (regra já existente).
- **C7 PDF**: baixar; abrir com `pdftoppm`; comparar visualmente com o preview (mesmas imagens, mesma paginação, evidências não citadas apenas no anexo final).
- **C8 DOCX**: se houver rota de download DOCX ativa, repetir; se não estiver implementado, registrar no relatório (não estava no escopo aprovado anterior).

Cada cenário grava:
- Screenshot antes/depois
- Métricas de tempo (`console.time` do backend + `performance.now` no cliente)
- Erros de console/network

## Fase 3 — Testes de erro / robustez

Executar via `supabase--curl_edge_functions` chamando `process-inpi-resource` e `adjust-inpi-resource` com payloads adversariais:
- PDF vazio, imagem corrompida, arquivo >20MB → esperar 400/mensagem clara.
- Simular timeout OpenAI (arquivo grande) → validar retry/timeout do `adjust-inpi-resource`.
- Payload sem evidências → gerar deve continuar funcionando (retrocompatibilidade).
- OCR vazio nas evidências → verificar que o bloco ainda cita o marcador usando só a legenda.

## Fase 4 — Testes de regressão

Confirmar que os fluxos existentes seguem intactos:
- `troca_procurador` / `nomeacao_procurador` (single-pass, sem `evidenceBlock` injetado).
- `notificacao_extrajudicial`.
- Numeração `Doc. NN` no rodapé de anexos.
- Download PDF do módulo (respeita as correções anteriores: hífen, alinhamento, badges brancos, cabeçalho, quebra em fronteiras).

## Fase 5 — Correções

Para cada falha detectada:
1. Identificar causa raiz (log da edge function + trace do Playwright).
2. Aplicar patch mínimo no arquivo responsável.
3. Redeploy se for edge function (`supabase--deploy_edge_functions`).
4. Reexecutar apenas o(s) cenário(s) afetado(s).
5. Loop até 100% verde.

Correções previsíveis já mapeadas (aplico apenas se confirmadas nos testes):
- Se upload ao Files API falhar por MIME (`image/jp2`) — fallback já existe (base64), mas devo garantir que `image_url` com `file_id` não seja enviado quando o modelo rejeitar; nesse caso, degradar para data URL.
- Se `evidenceBlock` estourar contexto (>10 evidências longas), truncar OCR para 300 chars por doc.
- Se o preview não estiver interpretando `[DOC:NN]` para party="concorrente" (só cliente), ajustar o parser para renderizar independente de party.

## Fase 6 — Relatório final

Ao término, entregar em chat:
- Tabela: cenário → status (✅/❌) → tempo antes/depois.
- Lista de bugs encontrados e correções aplicadas.
- Confirmação de regressão zero.
- Screenshots-chave do preview e PDF pós-evidências.

## Detalhes técnicos

- Autenticação Playwright: usar `LOVABLE_BROWSER_SUPABASE_*` do sandbox para logar como admin sem UI.
- Métricas de backend lidas via `supabase--edge_function_logs` filtrando `file_upload_dedupe` e `ai_generation`.
- Comparação PDF↔Preview: `pdftoppm -r 120 recurso.pdf page` + inspeção visual de cada página.
- Não alterar o prompt do agente nem a estrutura de saída; apenas o wrapper de evidências.
- Rollback: nenhuma migration nova nesta fase; apenas edits + redeploy edge functions.

## Fora de escopo

- Adicionar geração DOCX se ainda não existir (a spec pede validar; se ausente, apenas reportar).
- Trocar modelo de IA.
- Redesenhar UI da galeria.
