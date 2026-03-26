
-- Add created_by and assigned_to columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS assigned_to uuid;

-- Add a system setting for admin client visibility restriction
-- We'll use admin_permissions with a special key 'clients_own_only'
-- No schema change needed - we reuse admin_permissions table
