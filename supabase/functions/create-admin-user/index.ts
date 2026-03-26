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
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { email, password, fullName, fullAccess, permissions } = await req.json();

    let userId: string;

    // Try to create user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName || "Administrador",
      },
    });

    if (authError) {
      // If user already exists, find them and promote to admin
      if (authError.message?.includes('already been registered')) {
        // Find existing user by email
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (listError) throw listError;

        const existingUser = users?.find(u => u.email === email);
        if (!existingUser) {
          throw new Error('Usuário não encontrado após verificação de duplicidade.');
        }

        userId = existingUser.id;

        // Update profile name if provided
        if (fullName) {
          await supabaseAdmin
            .from('profiles')
            .update({ full_name: fullName })
            .eq('id', userId);
        }

        console.log(`User ${email} already exists (${userId}), promoting to admin.`);
      } else {
        throw authError;
      }
    } else {
      userId = authData.user.id;
    }

    // Assign admin role (upsert to avoid duplicates)
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: userId, role: "admin" },
        { onConflict: "user_id,role" }
      );

    if (roleError) {
      throw roleError;
    }

    // If not full access and permissions provided, insert them
    if (!fullAccess && permissions) {
      const permissionsToInsert = Object.entries(permissions)
        .filter(([_, perms]: [string, any]) => perms.can_view || perms.can_edit || perms.can_delete)
        .map(([key, perms]: [string, any]) => ({
          user_id: userId,
          permission_key: key,
          can_view: perms.can_view || false,
          can_edit: perms.can_edit || false,
          can_delete: perms.can_delete || false,
        }));

      if (permissionsToInsert.length > 0) {
        const { error: permError } = await supabaseAdmin
          .from("admin_permissions")
          .insert(permissionsToInsert);

        if (permError) {
          console.error("Error inserting permissions:", permError);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, userId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
