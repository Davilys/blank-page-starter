/** Validate a real user session, then the server-side module permission. Never accept an API
 * key or a claimed role supplied by the browser as proof of module access. */
export async function inpiAdminAccess(client: any, authorization: string | null, needEdit = true): Promise<401 | 403 | null> {
  if (!authorization?.startsWith('Bearer ') || !authorization.slice(7).trim()) return 401;
  const { data, error } = await client.auth.getUser(authorization.slice(7));
  if (error || !data?.user?.id) return 401;
  const role = await client.rpc('has_inpi_resources_access', { _user_id: data.user.id, _need_edit: needEdit });
  return role.error || role.data !== true ? 403 : null;
}
