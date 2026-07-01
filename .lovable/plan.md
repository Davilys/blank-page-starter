## Correção — linhas de bullet estourando margem (Indeferimento/Oposição/todos)

Alteração escopada apenas em `src/components/admin/INPIResourcePDFPreview.tsx`. Sem mexer em prompts, banco ou outros tipos de recurso — o componente é o mesmo para todos.

### 1. Detecção robusta de bullet

Substituir `trimmed.startsWith('- ')` por regex tolerante que capture:

- `- `, `–\u00a0`, `—`, `•`, `*`, `·` no início
- espaço normal, non-breaking-space, tab
- bullets com um nível de indentação (`  - ...`)

```ts
const BULLET_RE = /^\s{0,4}[-–—•*·]\s+/;
```

Assim toda linha marcada em vermelho pela usuária cai no ramo correto (`legal-list`) e nunca no ramo justificado (`legal-p`).

### 2. Pré-processamento do texto do bullet para permitir quebra em números longos

Antes de passar para `renderInlineMarkdown`, inserir `<wbr>` (word-break opportunity, tag HTML sem espaço visual) depois de pontos, hífens e barras dentro de sequências que se pareçam com número de processo/CNJ/CPF/CNPJ. Regex conservador:

```
\b(\d{4,}[.\-/]\d)  →  \d{4,}<wbr>[.\-/]<wbr>\d
```

Aplicar apenas dentro do conteúdo de bullet (não em parágrafos normais, para não sujar o preview). O `<wbr>` é invisível na tela e no PDF, mas dá ao layout um ponto legítimo de quebra — elimina o letter-spacing e o overflow.

### 3. CSS `.legal-list` blindado

Reescrever a regra:

```css
.legal-body .legal-list {
  text-align: left !important;
  text-justify: auto !important;
  text-indent: 0 !important;
  letter-spacing: normal !important;
  word-spacing: normal !important;
  hyphens: auto;
  overflow-wrap: anywhere;      /* fallback duro caso <wbr> não baste */
  word-break: normal;
  padding-left: 1.5em;
  text-indent: -1.1em;          /* hanging indent do bullet */
  margin: 0 0 0.4em 0;
  page-break-inside: avoid;
}
```

Trocar o `pl-6` do JSX pelo padding do CSS, para o hanging-indent funcionar tanto no preview quanto no PDF via `html2canvas`. Nada de justify na lista.

### 4. Garantia adicional no ramo `legal-p`

Adicionar `overflow-wrap: anywhere` como fallback (hoje é `break-word`), para o caso raro de o modelo emitir número de processo dentro de um parágrafo justificado. Preserva o justify normal mas evita o modo degradado do navegador quando um token não cabe.

### 5. Validação após implementação

1. Abrir o recurso `Mega Robô de Led` (que já reproduz o bug).
2. No preview: linhas com `- TRF-2, Apelação 0800858 92.2014.4.02.5101: ...` devem ficar alinhadas à esquerda, com o número quebrando na fronteira do ponto/barra, sem letter-spacing.
3. Baixar PDF e imprimir: mesma aparência do preview.
4. Verificar Oposição e Exigência de Mérito — reaproveitam o mesmo componente, portanto a correção é global automaticamente.

### Fora do escopo

- Prompts da IA, banco, storage, outros componentes.
- Não altero a pipeline `html2canvas`/`@media print` — ela já está correta; o defeito está na classificação da linha e no CSS do bullet.
