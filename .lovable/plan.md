

## Problem Analysis

The email body isn't loading because of a chain of issues:

1. **Fake Message-IDs during sync**: `sync-imap-inbox` generates artificial message IDs (`${Date.now()}-${Math.random()}`) when it can't parse a real one from headers. These fake IDs can never be found on the server.

2. **Hydrate search fails**: `hydrate-email` uses `SEARCH HEADER MESSAGE-ID "..."` with these fake IDs, gets no results, and writes `"(Conteúdo não disponível no servidor)"` as `body_text` + sets `body_fetched_at`.

3. **No retry possible**: `EmailView.tsx` checks `email.body_fetched_at` and skips hydration if it's set -- so failed emails are permanently stuck.

## Plan

### 1. Fix `sync-imap-inbox` to fetch body inline (not just headers)

Instead of only fetching `BODY.PEEK[HEADER.FIELDS (...)]`, change the FETCH command to also grab the body:
- Use `FETCH N:M (BODY.PEEK[HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID)] BODY.PEEK[TEXT])` -- but this is too heavy for batch sync of 19k+ messages.

**Better approach**: Keep sync as headers-only, but fix the Message-ID parsing and improve hydrate fallback.

### 2. Fix `sync-imap-inbox` -- store sequence number and real Message-ID

- Improve the header parsing regex to better capture Message-ID from the FETCH response
- Store the IMAP sequence number (UID) alongside the message for reliable retrieval later

### 3. Fix `hydrate-email` -- add fallback search strategies

When `SEARCH HEADER MESSAGE-ID` fails:
- Try `SEARCH ON <date> FROM <sender> SUBJECT <subject>` as fallback
- If the message_id looks auto-generated (contains random chars without `@`), skip the Message-ID search entirely and go straight to date/from/subject search

### 4. Fix `EmailView.tsx` -- allow re-hydration of failed emails

Change the `hasBody` check so that emails with placeholder error text like `"(Conteúdo não disponível no servidor)"` are retried:
- Check if `body_text` starts with `"("` and `body_fetched_at` is set -- treat as failed and allow retry
- Add a manual "Retry" button for failed hydrations

### Files to modify

| File | Change |
|------|--------|
| `supabase/functions/sync-imap-inbox/index.ts` | Improve Message-ID parsing; store UID from FETCH response |
| `supabase/functions/hydrate-email/index.ts` | Add fallback SEARCH by date+from+subject when Message-ID fails; detect fake message IDs |
| `src/components/admin/email/EmailView.tsx` | Fix hasBody check to allow re-hydration of failed emails; add retry button |

### Technical Details

**hydrate-email fallback search:**
```
SEARCH ON 15-Mar-2026 FROM "sender@email.com"
```
Then iterate results to match subject if multiple hits.

**Detecting fake message IDs:**
A real Message-ID contains `@` (e.g., `<abc123@mail.example.com>`). If it doesn't contain `@`, it's the auto-generated fake one.

**EmailView re-hydration logic:**
```ts
const isFailedHydration = email.body_fetched_at && 
  (email.body_text?.startsWith("(") || (!email.body_text && !email.body_html));
const hasBody = (email.body_text || email.body_html) && !isFailedHydration;
```

