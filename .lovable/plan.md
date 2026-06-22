## Objetivo

Adicionar um campo de **Orientações do Recurso** (textarea) na etapa de "Anexar Documentos", visível **apenas quando `resourceType === 'exigencia_merito'**`, para que o usuário escreva instruções customizadas que o Agente Mazzola usará ao elaborar o recurso.

## Mudanças

### 1. `src/pages/admin/RecursosINPI.tsx`

- Novo estado: `const [userOrientation, setUserOrientation] = useState('')`.
- Resetar `userOrientation` ao voltar/finalizar fluxo (junto com `setMultipleFiles([])`).
- Na etapa `upload` (linha ~2315), **logo após a Drop zone** e antes do "Agent badge", renderizar condicionalmente quando `resourceType === 'exigencia_merito'`:
  - Card com título "Orientações para o Agente (opcional)" + descrição curta.
  - `<Textarea>` com `value={userOrientation}`, `onChange`, `rows={6}`, placeholder explicando que pode descrever a estratégia, pontos a enfatizar, argumentos específicos, tom desejado, etc.
  - Contador de caracteres.
- Em `processDocument` (chamadas pass1 e pass2 do `process-inpi-resource`), incluir `userOrientation: userOrientation.trim() || undefined` no `body` — apenas relevante para `exigencia_merito`, mas mandar sempre não atrapalha; alternativamente passar apenas quando preenchido.

### 2. `supabase/functions/process-inpi-resource/index.ts`

- Ler `userOrientation` do body.
- Quando `resourceType === 'exigencia_merito'` e `userOrientation` estiver preenchido, injetar um bloco no prompt do usuário (tanto pass1 quanto pass2) com prioridade alta, ex.:
  ```
  ⚠️ ORIENTAÇÕES OBRIGATÓRIAS DO USUÁRIO (siga à risca, são a diretriz principal deste recurso):
  <userOrientation literal>
  ```
- Esse bloco deve ser inserido **antes** das instruções genéricas de estratégia, com marcação de prioridade máxima, para que o agente Mazzola siga as orientações do usuário.

## Escopo

- Apenas UI da etapa upload e edge function de geração.
- Nenhuma mudança em outros tipos de recurso (indeferimento, oposição, notificação, procurador).
- Sem alterações de schema.  PRECISO QUE TAMBEM FACA ISSO; Pontos que eu melhoraria
  #### 1. Não é exatamente um "Recurso Administrativo"
  Tecnicamente trata-se de:
  **Cumprimento de Exigência de Mérito**
  e não de um recurso administrativo. O próprio texto reconhece isso diversas vezes.
  Isso não costuma gerar indeferimento, mas a nomenclatura poderia ser mais precisa.
  ---
  #### 2. Ficou excessivamente longo
  Para uma exigência classificatória simples, 10 páginas é bastante.
  O INPI normalmente resolveria isso com:
  - nova especificação;
  - justificativa de 1 a 2 páginas.
  Você entregou praticamente uma tese jurídica.
  Não prejudica, mas parte do texto é dispensável.