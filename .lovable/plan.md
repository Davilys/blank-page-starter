

## Fix: Contract signature should place client in "Comercial" funnel

### Problem
When a client signs a contract, they appear in the "Jurídico" tab instead of "Comercial" in admin/clientes. This happens because:

1. When `sign-contract-blockchain` creates a new user profile (line 359), it does NOT set `client_funnel_type`
2. The field defaults to `null`, which the frontend interprets as `'juridico'`
3. Later (line 447), the code checks `if (client_funnel_type === 'comercial')` to update pipeline stage — but it's `null`, so it skips the update
4. Result: client has no funnel type and no pipeline stage update

### Solution

**File: `supabase/functions/sign-contract-blockchain/index.ts`**

1. **When creating a new profile** (line 359-373): Add `client_funnel_type: 'comercial'` to the upsert
2. **When user already exists** (after line 382): Update profile to set `client_funnel_type: 'comercial'` if it's not already set — this covers cases where the profile existed but had no funnel type
3. **Remove the conditional check** at line 447: Always set `pipeline_stage: 'assinou_contrato'` and `client_funnel_type: 'comercial'` on the profile after a contract is signed, regardless of the current value

### Technical Details

Three changes in `sign-contract-blockchain/index.ts`:

- Line ~366: Add `client_funnel_type: 'comercial'` to the `profiles.upsert()` call
- Lines ~401-418: Also set `client_funnel_type: 'comercial'` alongside `assigned_to` and `created_by`
- Lines ~441-458: Remove the `if (clientProfile?.client_funnel_type === 'comercial')` guard — always update pipeline stage to `assinou_contrato` and ensure `client_funnel_type` is `'comercial'`

After deploy, newly signed contracts will correctly place clients in the Comercial funnel.

