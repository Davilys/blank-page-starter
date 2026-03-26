import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify caller is admin via JWT or internal service key
    const authHeader = req.headers.get("Authorization");
    const internalKey = req.headers.get("x-internal-key");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    
    const isInternalCall = internalKey === serviceRoleKey;

    if (!isInternalCall) {
      if (!authHeader) throw new Error("Não autorizado");
      const token = authHeader.replace("Bearer ", "");

      const { data: { user: caller }, error: authErr } = await supabaseAdmin.auth.getUser(token);
      if (authErr || !caller) throw new Error("Não autorizado");

      const { data: callerRole } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", caller.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!callerRole) throw new Error("Apenas administradores podem excluir usuários");
    }

    const { userId } = await req.json();
    if (!userId) throw new Error("userId é obrigatório");

    // Protect master admin
    const { data: targetUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (targetUser?.user?.email === "davillys@gmail.com") {
      throw new Error("Administrador master não pode ser excluído");
    }

    // Delete from auth.users
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
