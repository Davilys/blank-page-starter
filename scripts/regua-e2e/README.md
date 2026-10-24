Testes da régua de cobrança (tudo com dados fictícios, nunca toca Asaas/clientes reais).
- Lógica SQL (PGlite): copie mig.sql (migration sem a parte de cron) e cls.sql (classificador) ao lado de sql-test.mjs e rode `node sql-test.mjs`.
- Processador (Deno + fakes): `deno run -A --import-map=scripts/regua-e2e/imports.json scripts/regua-e2e/run.ts` (ajuste os caminhos absolutos em run.ts/imports.json).
- Unitários: `npx vitest run src/lib/__tests__/regua-elegibilidade.test.ts`
