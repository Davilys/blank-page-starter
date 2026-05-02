Auditoria feita em modo leitura: os contratos pendentes não foram apagados. Existem 59 contratos com `signature_status = 'not_signed'`, todos criados até 30/04/2026. O que aconteceu é que a importação do ZIP criou muitos contratos assinados em 02/05 e a tela de contratos provavelmente está trazendo só o primeiro lote padrão do Supabase, ordenado pelos mais recentes, então os pendentes antigos ficaram fora da listagem.

Números atuais encontrados:
- Total de contratos: 3.251
- Pendentes ainda existentes: 59
- Assinados: 3.192
- Criados em 02/05/2026: 2.864
- Criados em 02/05/2026 com marcador `[PERFEX_ID:...]`: 2.863
- Documento criado hoje vinculado a contrato: 1

Plano proposto para resolver sem risco de apagar contratos pendentes:

1. Corrigir a tela de contratos para os pendentes voltarem a aparecer
   - Alterar a busca em `src/pages/admin/Contratos.tsx` para não depender do limite padrão de 1000 linhas do Supabase.
   - Carregar os contratos em páginas/lotes ou buscar por filtros no servidor.
   - Garantir que o filtro “Pendente” consulte corretamente todos os contratos, não apenas os primeiros carregados.
   - Manter contadores confiáveis de Total, Assinados e Pendentes.

2. Criar proteção contra novas importações substituírem dados sem controle
   - Alterar a importação de ZIP para mostrar uma prévia antes de executar: quantos contratos serão criados, quantos seriam atualizados/substituídos e quantos têm conflito por `contract_number`.
   - Adicionar opção segura de importação, por exemplo:
     - “Criar apenas novos”
     - “Atualizar existentes somente após confirmação explícita”
   - Melhorar o aviso atual para deixar claro que a substituição pode alterar contratos já existentes.

3. Preparar restauração seletiva para voltar a visão/data até 01/05/2026
   - Separar os contratos importados em 02/05/2026, especialmente os 2.863 com `[PERFEX_ID:...]`.
   - Validar dependências antes de qualquer alteração: `documents`, `contract_attachments`, `contract_comments`, `contract_notes`, `contract_tasks`, `contract_renewal_history` e logs de assinatura.
   - Como a auditoria indicou que os pendentes continuam no banco, a primeira ação recomendada é corrigir a listagem. Se você ainda quiser “voltar” removendo a importação de 02/05, farei uma exclusão seletiva apenas dos registros importados hoje e marcados como Perfex, preservando os 59 pendentes antigos.

4. Tratar o caso do contrato criado/importado hoje sem marcador Perfex
   - Há 1 contrato criado hoje sem `[PERFEX_ID:...]`, com número `20264514`.
   - Antes de remover qualquer coisa, vou tratar esse item separadamente para evitar apagar um contrato legítimo criado hoje fora da importação.

5. Resultado esperado
   - Os 59 contratos pendentes voltam a aparecer normalmente na área administrativa.
   - A importação de 02/05 deixa de “esconder” contratos antigos na tela.
   - Novas importações ZIP não substituem contratos existentes sem uma etapa clara de prévia/confirmação.
   - Se aprovado como parte da restauração, os contratos importados em 02/05 podem ser removidos seletivamente, voltando a base operacional à visão anterior a 01/05/2026 sem afetar os pendentes preservados.

Observação importante: reverter código pelo histórico do Lovable não restaura automaticamente dados já alterados no Supabase. Para os dados, o caminho seguro é a restauração seletiva descrita acima ou, se você tiver backup/PITR habilitado no Supabase, uma restauração nativa do banco para um ponto no tempo.