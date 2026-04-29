## Diagnóstico (auditoria)

O erro "Algo deu errado" que aparece quando você deixa o CRM aberto por um tempo e volta **NÃO é um bug do código do dashboard** — é o `AdminErrorBoundary` capturando uma falha de autenticação em cascata.

### Causa raiz confirmada pelos logs

Console do preview mostra:
```
AuthApiError: Invalid Refresh Token: Refresh Token Not Found
status: 400, code: refresh_token_not_found
```

Sequência do que acontece:

1. Você fica com a aba aberta/inativa por um tempo (ou hiberna o computador).
2. O JWT do Supabase expira (1h por padrão). Quando o cliente tenta renovar, o refresh token salvo no `localStorage` já não é mais válido (foi rotacionado/expirado/perdido).
3. O Supabase dispara o erro `refresh_token_not_found` mas **não emite `SIGNED_OUT`** automaticamente nesse caso — a sessão fica em "limbo" (user = null, mas sem evento de logout).
4. O Dashboard / hooks (`useAdminPermissions`, queries do React Query, RPC `has_role`, etc.) começam a retornar erro 401/throw, e o `AdminErrorBoundary` em `AdminLayout.tsx` (linha 668) renderiza a tela de "Algo deu errado".
5. "Tentar novamente" só remonta os componentes — a sessão continua quebrada, então o erro volta.

### Pontos do código que contribuem

- `src/components/admin/AdminLayout.tsx` (linhas 480-496): o `onAuthStateChange` só trata `SIGNED_OUT` e `TOKEN_REFRESHED`. Não há tratamento para falha de refresh (`USER_UPDATED` com erro, ou ausência de sessão após expiração).
- `src/components/admin/AdminLayout.tsx` (linhas 408-418): há um "fast path" via `sessionStorage.admin_verified` que mantém `isAdmin = true` mesmo com sessão quebrada — por isso o layout renderiza, mas as queries internas falham.
- `src/integrations/supabase/client.ts`: cliente padrão sem handler global de falha de refresh.
- Não existe nenhum mecanismo que detecte "voltei à aba após muito tempo" e revalide a sessão proativamente (visibilitychange).

## Plano de correção

### 1. Detectar e tratar refresh token inválido globalmente
Em `src/integrations/supabase/client.ts`, adicionar um listener global `onAuthStateChange` que, ao receber `SIGNED_OUT` ou ao detectar erro de refresh, limpe o `sessionStorage` (`admin_verified`, `admin_user_id`) e faça redirect limpo para `/cliente/login` em vez de deixar a app em estado quebrado.

### 2. Revalidar sessão ao voltar para a aba
Em `AdminLayout.tsx`, adicionar listener `visibilitychange` + `focus`: quando a aba volta a ficar visível, chamar `supabase.auth.getSession()`. Se vier `null` ou erro, limpar cache e redirecionar para login com toast amigável ("Sessão expirou, faça login novamente").

### 3. Tratar falha de refresh sem matar a UI
No `AdminErrorBoundary` (`src/components/admin/ErrorBoundary.tsx`), inspecionar `this.state.error`: se for `AuthApiError` / `refresh_token_not_found` / `JWT expired`, mostrar mensagem específica ("Sua sessão expirou") com botão "Fazer login novamente" que executa `supabase.auth.signOut()` + redirect, em vez do genérico "Algo deu errado".

### 4. Não confiar cegamente no cache de sessionStorage
Ajustar o "fast path" em `AdminLayoutInner.checkAdmin` (linhas 412-418) para ainda verificar `supabase.auth.getSession()` em background. Se a sessão real não existir mais, invalidar o cache e redirecionar.

### 5. Garantir que React Query não fique em loop de retry em 401
Adicionar tratamento em `networkResilience.ts` / nos hooks principais: erro `401` / `JWT expired` / `refresh_token_not_found` **não deve** ser tratado como "connectivity error" e retentado — deve bubble-up para o handler de logout.

## Arquivos a modificar

- `src/integrations/supabase/client.ts` — listener global de auth + handler de refresh failure
- `src/components/admin/AdminLayout.tsx` — visibilitychange/focus revalidation, fast-path mais seguro
- `src/components/admin/ErrorBoundary.tsx` — mensagem específica para erros de auth
- `src/lib/networkResilience.ts` — não classificar 401 como erro de conectividade
- `src/components/cliente/ClientLayout.tsx` — aplicar o mesmo tratamento (mesma causa pode afetar área do cliente)

## Resultado esperado

- Você não verá mais "Algo deu errado" ao voltar para a aba após inatividade.
- Quando a sessão realmente expirar, será redirecionado direto para o login com mensagem clara, em vez da tela de erro genérica.
- Se a renovação de token funcionar (caso comum), nada será interrompido — você continua usando o sistema normalmente.
- **Nenhuma outra funcionalidade do CRM é alterada.**
