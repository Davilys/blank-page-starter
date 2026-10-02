# Aba Publicação — números reais, autovincular de verdade e visual organizado

## O que encontrei
- **Atrasados 552 está inflado**: o cálculo conta qualquer prazo passado, inclusive publicações já **cumpridas, arquivadas, desistentes e certificadas**. No banco, a maior parte dos "atrasados" é desses casos (ex.: 132 do status 003 já cumpridos, 194 arquivados, 100 deferimentos cumpridos).
- **Prazos Urgentes** tem o mesmo problema (conta casos já resolvidos).
- **Deferidos este mês = 0** depende só da data da decisão, que quase nunca vem preenchida.
- **Autovincular** hoje procura apenas pelo número do processo e pelo nome exato da marca, e só nos processos cadastrados — por isso muitos ficam "sem correspondência".
- **Cards de prazo** (No Prazo 26, 30 Dias 20...) contam sempre o total; o filtro de responsável muda a lista, mas não os números.

## Como vai ficar

```text
+--------------------------------------------------------------------+
| Responsável: [ Todos v ]   (filtro único, vale para a página toda) |
+--------------------------------------------------------------------+
| [890 Total] [89 Urgentes <7d] [12 Atrasados] [3 Deferidos no mês]  |
+--------------------------------------------------------------------+
| ! 120 publicações sem cliente vinculado   [Autovincular] [Ver]     |
+--------------------------------------------------------------------+
| Filtros | Publicações 890 | Buscar...      | + Nova | Lista Kanban Prazos |
| +---------+ +---------+ +---------+ +---------+ +---------+ +-------+ |
| |   26    | |   20    | |   12    | |    1    | |  531    | |  77   | |
| |No Prazo | |30 Dias  | |Últ. Sem.| |Vencidos | |Cumpridos| |Desist.| |
| +---------+ +---------+ +---------+ +---------+ +---------+ +-------+ |
|  (cards grandes, mesmo estilo dos de cima, 6 em uma linha)          |
|  lista de prazos ...                                                |
+--------------------------------------------------------------------+
| Dashboard (gráficos) — no final, recolhível "Ver gráficos"         |
+--------------------------------------------------------------------+
```

1. **Números reais nos cards de cima**: Urgentes e Atrasados contam só publicações **em aberto** (fora cumpridas, arquivadas, desistentes, certificadas). Deferidos do mês usa a data da decisão e, sem ela, a data da publicação na revista.
2. **Filtro de responsável sincronizado (igual Premiação)**: ao escolher Caroline, **todos os números** mudam — cards de cima, aviso de órfãos e os 6 cards de prazo passam a mostrar só os clientes dela. "Órfãos" mostra só os sem usuário.
3. **Cards de prazo grandes**: mesmo tamanho e estilo dos cards de cima (número grande, rótulo abaixo, barra colorida no topo), em uma linha só no computador e em 2 colunas no celular. Clicar continua filtrando a lista.
4. **Autovincular de verdade**, em ordem de confiança:
   1. número do processo (processos cadastrados e contratos);
   2. e-mail / CPF / CNPJ do titular, quando a publicação trouxer;
   3. nome da marca (sem acentos, sem pontuação, sem "LTDA/ME");
   4. nome do titular igual ao nome do cliente.
   Só vincula quando houver **um único cliente** possível; se houver dúvida, não vincula e lista no resultado "X com mais de um cliente possível — vincular manualmente". Mensagem final mostra quantos por cada critério.
5. **Dashboard (gráficos) vai para o final**, recolhido em "Ver gráficos". Minha dica: é informação de consulta, não de trabalho diário — no topo empurra os prazos para baixo. Também corrijo o gráfico de status para não sobrepor os nomes.

## O que não muda
Regras de prazo, notificações, atribuição automática, Kanban, Lista, banco de dados e as demais abas.

## Detalhes técnicos
- `PublicacaoTab.tsx`: `kpiStats` filtra `cumprimento_status` em (cumprido, desistiu, nao_respondeu) e status arquivado/certificado(s); aplica `filtroResp` elevado do `PublicacaoPrazos` para o Tab (estado compartilhado via props); `orphanCount` respeita o filtro.
- `handleAutoLinkClients`: mapas por processo (processes + contracts), documento só-dígitos (`profiles_by_doc_digits`), e-mail, marca normalizada e nome do titular; ambiguidade = não vincula; atualizações em lote.
- `PublicacaoPrazos.tsx`: `counts` calculado após o filtro de responsável; cards substituídos pelo componente `StatsCard` existente.
- `PublicacaoCharts` movido para o final dentro de `Collapsible`; legenda do donut sem rótulos sobrepostos.
- Validação: typecheck; conferência dos números com consulta ao banco.
