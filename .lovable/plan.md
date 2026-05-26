## Diagnóstico

Na aba **Revista INPI** o seletor "Buscar Remota" lista RPIs **2937 → 2946**, mas a última RPI real publicada no portal `revistas.inpi.gov.br/rpi/` é **2890** (26/05/2026 — confirmado na imagem).

Causa raiz na edge function `supabase/functions/fetch-inpi-magazine/index.ts`:

1. **Função `calculateExpectedRpiNumber()` (linhas 37–43)** usa referência desatualizada:
   ```ts
   const referenceDate = new Date('2024-12-10');
   const referenceRpi = 2870;
   ```
   Para hoje (26/05/2026) isso devolve `2870 + 76 semanas ≈ 2946` — completamente errado. A cadência real é menor que 1 RPI por semana.

2. **Fallback fabricado (linhas 259-260, 326-327, 331-332):** quando o scrape falha (login INPI indisponível ou a página `/rpi/` retorna página de login), a função gera 20 números descendentes a partir do "expected" calculado acima. Resultado: o front recebe `[2946, 2945, …, 2927]`, todos inexistentes.

3. **Scrape do portal público não está sendo usado:** a página `https://revistas.inpi.gov.br/rpi/` que lista a tabela "NÚMERO REVISTA / DATA / SEÇÕES" é **pública** (a imagem prova isso) — não precisa de login. Hoje o código só tenta acessar essa página após `loginToInpi()` e, se as credenciais não estão configuradas ou o login falha, ele cai direto no fallback fabricado em vez de tentar buscar sem cookies.

## Correções (apenas na edge function `fetch-inpi-magazine`)

### 1. Atualizar referência de cálculo
Trocar para o ponto verificado pela imagem:
```ts
const referenceDate = new Date('2026-05-26');
const referenceRpi = 2890;
```
E mudar a cadência para ~7 dias (mantém), mas o resultado passa a ser uma estimativa "no máximo igual a hoje".

### 2. Tentar scrape público ANTES do login
Em `fetchAvailableRpis`:
- Primeiro `fetchWithSession('/rpi/', null)` (sem cookies). A tabela é pública.
- Só tentar `loginToInpi()` se a página pública não retornar uma lista válida (ou se for necessária para baixar o XML).

### 3. Nunca devolver RPIs futuras
Após scrape/fallback, aplicar:
```ts
const cap = Math.max(latest, expectedRpi);
const available = uniqueNumbers
  .filter(n => n <= cap)
  .slice(0, 20);
```
E **remover** o fallback que gera números a partir do `expectedRpi` quando o scrape funcionou parcialmente. Se o scrape falhou completamente, gerar fallback **descendente a partir de `expectedRpi`** (que agora estará correto: 2890), nunca futuro.

### 4. Melhorar parsing da tabela pública
A tabela atual da imagem mostra os números em `<td>` no formato `2890`, `2889`, etc. O regex `tdRegex` já captura isso, mas atualmente o range é `2800..3100`. Restringir a `2800..(expectedRpi + 2)` para evitar lixo de versões futuras hardcoded na página.

### 5. Front-end (nenhuma mudança)
`src/pages/admin/RevistaINPI.tsx` apenas consome `data.latestRpi` e `data.available` / `data.rpWithXml` — depois do fix da edge function passa a mostrar RPIs reais (2890, 2889, 2888, …).

## Arquivos alterados

- `supabase/functions/fetch-inpi-magazine/index.ts`
  - `calculateExpectedRpiNumber()`: nova referência 2890/2026-05-26
  - `fetchAvailableRpis()`: tentar scrape público sem login primeiro; cap em `expectedRpi`; fallback apenas descendente; range do regex restrito

## Não muda

- Regras de download/parsing do XML (`tryDownloadRpiXml`, `parseRpiXml`)
- Login INPI (continua sendo usado quando preciso para baixar XML autenticado)
- Lógica de matching com clientes / criação de `rpi_uploads` / `rpi_entries`
- Componente `RevistaINPI.tsx`

## Resultado esperado

Ao abrir o seletor "Buscar Remota", a lista mostrará **2890 (Última), 2889, 2888, … 2871**, exatamente como aparece em `revistas.inpi.gov.br/rpi/`, sem nenhuma edição futura inexistente.
