

## Auditoria Completa de Estabilidade do Painel Admin

### Problemas Identificados

1. **QueryClient sem configuração global de resiliência** — `App.tsx` linha 85 cria `new QueryClient()` sem `defaultOptions`. Cada query decide isoladamente retry/staleTime, e muitas não definem nada, causando refetches agressivos e falhas em cascata.

2. **AdminLayout recria `checkAdmin` a cada render** — A função `checkAdmin` (linha 408) não é memoizada e usa `cachedAdmin`/`cachedUserId` capturados no escopo do componente (linha 390-391), que são lidos uma vez no render inicial. Isso pode causar verificações redundantes.

3. **`onAuthStateChange` não trata `TOKEN_REFRESHED`** — Quando o token é renovado automaticamente (visível nos auth logs), o listener (linha 481) só reage a `SIGNED_OUT`. Não atualiza o cache de sessão, podendo causar estado stale após refresh de token.

4. **Cada página admin cria `<AdminLayout>` independentemente** — Não há rota wrapper. Cada navegação entre `/admin/*` desmonta e remonta `AdminLayout`, re-executando `checkAdmin` e todas as queries de permissão.

5. **Badge sem forwardRef** — Erro no console: `Function components cannot be given refs` em `AdminContratos`. Indica que `Badge` está sendo usado como child de tooltip ou similar sem suporte a ref.

### Plano de Correção

#### 1. Configurar QueryClient com defaults resilientes
**Arquivo:** `src/App.tsx`

Adicionar `defaultOptions` ao QueryClient com:
- `staleTime: 5 * 60 * 1000` (5min)
- `gcTime: 10 * 60 * 1000` (10min)  
- `retry`: usar `connectivityRetry` do networkResilience
- `retryDelay`: usar `connectivityRetryDelay`
- `refetchOnWindowFocus: false` (elimina refetch ao trocar abas)

#### 2. Wrapping de rotas admin com layout compartilhado
**Arquivo:** `src/App.tsx`

Criar um componente `AdminRouteWrapper` que renderiza `<AdminLayout>` uma única vez e usa `<Outlet>` para as sub-rotas. Isso evita desmontar/remontar o layout a cada navegação, eliminando o flash "Verificando permissões...".

```text
Antes:  /admin/dashboard → <AdminDashboard> → <AdminLayout> (mount)
        /admin/clientes  → <AdminClientes>  → <AdminLayout> (mount again)

Depois: /admin/* → <AdminRouteWrapper> → <AdminLayout> (mount once)
                                        └ <Outlet> → page content
```

#### 3. Estabilizar auth listener no AdminLayout
**Arquivo:** `src/components/admin/AdminLayout.tsx`

- Tratar `TOKEN_REFRESHED` no `onAuthStateChange` para atualizar `adminUserId` no sessionStorage
- Memoizar `checkAdmin` com `useCallback`
- Se `sessionStorage` já tem admin verificado para o mesmo user, pular verificação completamente (fast path)

#### 4. Corrigir Badge sem forwardRef
**Arquivo:** `src/components/ui/badge.tsx`

Verificar e garantir que o componente `Badge` use `React.forwardRef` para suportar refs de tooltips e dropdowns.

#### 5. Hardening do login
**Arquivo:** `src/pages/admin/Login.tsx`

- Ao fazer login com sucesso, já gravar `admin_verified` e `admin_user_id` no sessionStorage ANTES de navegar para o dashboard
- Isso elimina a tela "Verificando..." após login bem-sucedido

### Resultado Esperado
- Zero "Verificando permissões..." ao navegar entre abas
- Zero "Verificando..." após login
- Sem refetch ao trocar de aba do navegador
- Sessão persistente por horas sem pedir senha novamente
- Console limpo sem warnings de ref

### Arquivos Modificados
1. `src/App.tsx` — QueryClient defaults + rotas admin com Outlet
2. `src/components/admin/AdminLayout.tsx` — Auth listener robusto, fast path, useCallback
3. `src/pages/admin/Login.tsx` — Pre-cache admin status no login
4. `src/components/ui/badge.tsx` — forwardRef fix
5. Cada página admin (`Dashboard.tsx`, `Contratos.tsx`, etc.) — remover `<AdminLayout>` wrapper interno (será fornecido pelo route wrapper)

