

## Fix: Missing `suggested_classes` column on `contracts` table

### Problem
The `CreateContractDialog` and other components reference a `suggested_classes` column on the `contracts` table, but this column doesn't exist in the database schema. This causes the error: `"Could not find the 'suggested_classes' column of 'contracts' in the schema cache"`.

### Solution
Add a database migration to create the missing column:

```sql
ALTER TABLE public.contracts 
ADD COLUMN suggested_classes jsonb DEFAULT NULL;
```

This is a single migration — no code changes needed since the frontend already references this column correctly.

### Technical Details
- Column type: `jsonb` (stores objects like `{ classes: [1,2], descriptions: [...], selected: [1] }`)
- Nullable, default `NULL`
- Used by: `CreateContractDialog`, `AssinarDocumento`, `create-asaas-payment` edge function, `get-contract-by-token` edge function

