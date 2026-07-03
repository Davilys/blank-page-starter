## Escopo

Duas correções cirúrgicas em `src/components/admin/INPIResourcePDFPreview.tsx`. Sem tocar em pipeline de download (que voltou a funcionar), prompts, banco ou outros componentes.

## Problema 1 — Cabeçalho quebrado no PDF baixado

Comparando as imagens:
- **Preview (image-165):** título "WEBMARCAS INTELLIGENCE PI" em uma linha; badge "RECURSO ADMINISTRATIVO" com texto branco visível.
- **PDF baixado (image-166):** título quebrado em duas linhas ("WEBMARCAS INTELLIGENCE / PI"); badge azul aparece sem o texto ("RECURSO ADMINISTRATIVO" some).

Causas:
1. O título usa `text-2xl font-bold tracking-wider` + `letterSpacing: '0.15em'` (linha 724). O `html2canvas` mede glifos ligeiramente diferente do browser e, no `scale: 2`, o texto excede a largura disponível e quebra.
2. O texto do badge usa a classe Tailwind `text-white` (linha 745). `html2canvas` frequentemente falha a resolver a variável CSS `--tw-text-opacity` usada pelo Tailwind, resultando em cor herdada (dark/transparente) — texto some sobre fundo azul-marinho.

Correção:
- No `<h1>` do letterhead (linha 724): adicionar `whiteSpace: 'nowrap'` no style inline e reduzir `letterSpacing` de `0.15em` para `0.08em` (mantém o visual de rastreamento, mas dá folga para o `html2canvas`). Manter o `text-2xl` e a fonte inalterados.
- No `<p>` do badge (linha 745): trocar a dependência da classe `text-white` por style inline `color: '#ffffff'` (mantendo classes de peso/tamanho). Aplicar a mesma correção nos outros dois badges — "ANEXOS DOCUMENTAIS" (linha 819) — para consistência.

Isso garante que o cabeçalho impresso/baixado fique visualmente idêntico ao preview.

## Problema 2 — Texto do corpo deve ficar alinhado à esquerda

Atualmente `.legal-p` tem `text-align: justify` + `text-indent: 1.25cm` (linhas 651–664). O usuário pediu **Left Align** (esquerda, sem justificação, começando do lado esquerdo).

Correção em `<style>` (bloco a partir da linha 649):
- `.legal-body .legal-p`: mudar `text-align: justify` → `text-align: left`; remover `text-justify: inter-word`; remover `text-indent: 1.25cm` (definir `text-indent: 0`). Manter `hyphens: auto`, `overflow-wrap: anywhere`, `page-break-inside: avoid`, margens.
- `.legal-body .legal-p-short`: já está `text-align: left; text-indent: 0` — mantido.
- `.legal-list`: já está `text-align: left !important` — mantido.
- Cabeçalhos (`.legal-heading`), metadados, tabelas e assinatura ficam inalterados.

## Fora do escopo

- Pipeline `handleDownloadPDF` (single-shot `html2canvas` + slicing) permanece exatamente como está.
- Rodapé paginado, prompts, `adjust-inpi-resource`, `handlePrint` e o Supabase — não tocar.
- Correções de bullets (`.legal-list`) e wrap de números de processo — preservadas.

## Validação

- Abrir "Mega Robô de Led" em Indeferimento, clicar em **Download PDF**: cabeçalho deve mostrar "WEBMARCAS INTELLIGENCE PI" em UMA linha e o badge "RECURSO ADMINISTRATIVO" com o texto branco visível.
- Corpo do recurso deve começar do lado esquerdo (sem justificação, sem recuo de primeira linha).
- Testar também em Oposição e Exigência de Mérito (mesmo componente).