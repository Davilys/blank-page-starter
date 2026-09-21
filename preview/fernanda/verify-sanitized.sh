#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")" && pwd)"
# No production project refs, routable URLs, scheduler creation, pg_net calls, or secret payloads.
if rg -n -i 'scpbqsvwojhbxihyqbdz|https?://|cron\.schedule|net\.http|Bearer[[:space:]]+[A-Za-z0-9._-]+|eyJ[A-Za-z0-9._-]+' "$root/supabase"; then
  echo 'FAIL: active external route, scheduler, or credential found' >&2; exit 1
fi
# Configuration-shaped rows are allowed only empty/disabled.
if rg -n -i '"enabled"[[:space:]]*:[[:space:]]*true|"(api_key|auth_token|webhook_url)"[[:space:]]*:[[:space:]]*"[^[:space:]" ]+' "$root/supabase"; then
  echo 'FAIL: enabled provider or populated integration field found' >&2; exit 1
fi
# Exact effect markers expected to be absent.
test "$(rg -i -c 'cron\.schedule' "$root/supabase/migrations" || true)" = ""
test "$(rg -i -c 'net\.http' "$root/supabase/migrations" || true)" = ""
echo 'PASS: preview history has no routable external effects or credentials.'
