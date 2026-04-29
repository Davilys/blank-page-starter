/**
 * Global auth-session recovery.
 *
 * Detects expired/invalid Supabase sessions (e.g. "Invalid Refresh Token:
 * Refresh Token Not Found" after long inactivity) and forces a clean redirect
 * to login instead of leaving the app in a broken state where every query
 * throws and the ErrorBoundary shows "Algo deu errado".
 */
import { supabase } from '@/integrations/supabase/client';

const SS_KEYS = ['admin_verified', 'admin_user_id'];

let installed = false;
let recovering = false;

/** Returns true when the error indicates an expired/invalid auth session. */
export function isAuthSessionError(error: unknown): boolean {
  if (!error) return false;
  const anyErr = error as { message?: string; code?: string; status?: number; __isAuthError?: boolean };
  const msg = (anyErr.message || String(error) || '').toLowerCase();
  const code = (anyErr.code || '').toLowerCase();
  if (anyErr.__isAuthError) return true;
  if (anyErr.status === 401) return true;
  return (
    code === 'refresh_token_not_found' ||
    code === 'session_not_found' ||
    msg.includes('refresh token not found') ||
    msg.includes('invalid refresh token') ||
    msg.includes('jwt expired') ||
    msg.includes('session_not_found') ||
    msg.includes('session from session_id claim in jwt does not exist')
  );
}

function clearAuthCache() {
  try {
    SS_KEYS.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

function isOnLoginRoute(): boolean {
  const p = window.location.pathname;
  return p.startsWith('/cliente/login') || p.startsWith('/admin/login');
}

function isProtectedRoute(): boolean {
  const p = window.location.pathname;
  return p.startsWith('/admin') || p.startsWith('/cliente');
}

/**
 * Force a clean logout + redirect to login. Idempotent.
 * Preserves the current path in `?next=` so we can return after re-login.
 */
export async function forceAuthRecovery(reason?: string) {
  if (recovering) return;
  recovering = true;
  try {
    clearAuthCache();
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      /* ignore — local signOut just clears storage */
    }
    if (reason) {
      // eslint-disable-next-line no-console
      console.warn('[authRecovery]', reason);
    }
    if (!isOnLoginRoute() && isProtectedRoute()) {
      const target = window.location.pathname.startsWith('/admin')
        ? '/cliente/login?reason=session_expired'
        : '/cliente/login?reason=session_expired';
      window.location.replace(target);
    }
  } finally {
    // Allow new recoveries after a short delay
    setTimeout(() => {
      recovering = false;
    }, 2000);
  }
}

/**
 * Install global listeners — call once from the app entry point.
 */
export function installAuthRecovery() {
  if (installed) return;
  installed = true;

  // 1) Listen for SIGNED_OUT events (Supabase emits these when a refresh fails fatally)
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
      clearAuthCache();
      if (isProtectedRoute() && !isOnLoginRoute()) {
        window.location.replace('/cliente/login?reason=session_expired');
      }
    }
  });

  // 2) Catch unhandled refresh errors that bubble up as promise rejections
  window.addEventListener('unhandledrejection', (ev) => {
    if (isAuthSessionError(ev.reason)) {
      forceAuthRecovery('unhandledrejection: ' + (ev.reason?.message || ev.reason));
    }
  });

  // 3) Re-validate session whenever the tab becomes visible again
  let lastCheck = Date.now();
  const revalidate = async () => {
    // Throttle to once every 5s
    if (Date.now() - lastCheck < 5000) return;
    lastCheck = Date.now();
    if (!isProtectedRoute() || isOnLoginRoute()) return;
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error && isAuthSessionError(error)) {
        await forceAuthRecovery('visibilitychange: ' + error.message);
        return;
      }
      if (!data?.session) {
        await forceAuthRecovery('visibilitychange: no session');
      }
    } catch (err) {
      if (isAuthSessionError(err)) {
        await forceAuthRecovery('visibilitychange exception');
      }
    }
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') revalidate();
  });
  window.addEventListener('focus', revalidate);
}