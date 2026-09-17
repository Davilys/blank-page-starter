-- Phase 1: close critical privilege-escalation RPCs without changing business data.
-- This migration is staged for review and must be tested before production deployment.

begin;

create or replace function public.add_admin_role(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and (auth.uid() is null or not public.has_role(auth.uid(), 'admin')) then
    raise exception 'Apenas administradores podem conceder perfil administrativo';
  end if;

  insert into public.user_roles (user_id, role)
  values (target_user_id, 'admin')
  on conflict (user_id, role) do nothing;
end;
$function$;

revoke all on function public.add_admin_role(uuid) from public, anon;
grant execute on function public.add_admin_role(uuid) to authenticated, service_role;

create or replace function public.get_auth_user_id_by_email(lookup_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  found_user_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and (auth.uid() is null or not public.has_role(auth.uid(), 'admin')) then
    raise exception 'Apenas administradores podem consultar usuários';
  end if;

  select id
    into found_user_id
    from auth.users
   where email = lower(trim(lookup_email))
   limit 1;

  return found_user_id;
end;
$function$;

revoke all on function public.get_auth_user_id_by_email(text) from public, anon;
grant execute on function public.get_auth_user_id_by_email(text) to authenticated, service_role;

create or replace function public.merge_duplicate_clients(keep_id uuid, merge_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and (auth.uid() is null or not public.has_role(auth.uid(), 'admin')) then
    raise exception 'Apenas administradores podem unificar clientes';
  end if;

  if keep_id is null or merge_id is null or keep_id = merge_id then
    raise exception 'Clientes de origem e destino devem ser diferentes e válidos';
  end if;

  update public.brand_processes set user_id = keep_id where user_id = merge_id;
  update public.contracts set user_id = keep_id where user_id = merge_id;
  update public.invoices set user_id = keep_id where user_id = merge_id;
  update public.documents set user_id = keep_id where user_id = merge_id;
  update public.notifications set user_id = keep_id where user_id = merge_id;
  update public.chat_messages set user_id = keep_id where user_id = merge_id;
  update public.client_activities set user_id = keep_id where user_id = merge_id;
  update public.client_notes set user_id = keep_id where user_id = merge_id;
  update public.client_appointments set user_id = keep_id where user_id = merge_id;
  delete from public.profiles where id = merge_id;
end;
$function$;

revoke all on function public.merge_duplicate_clients(uuid, uuid) from public, anon;
grant execute on function public.merge_duplicate_clients(uuid, uuid) to authenticated, service_role;

commit;
