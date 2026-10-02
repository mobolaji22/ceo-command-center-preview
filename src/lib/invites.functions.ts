import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const inviteClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    email: z.string().trim().email().max(255),
    projectIds: z.array(z.string().uuid()).max(100),
    redirectTo: z.string().url().max(500),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isOwner } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "owner" });
    if (!isOwner) throw new Error("Only the owner can invite clients.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase();

    const { data: existing } = await supabaseAdmin.from("profiles").select("id").ilike("email", email).maybeSingle();
    let userId = existing?.id as string | undefined;
    let invited = false;
    if (!userId) {
      const { data: inv, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, { redirectTo: data.redirectTo });
      if (error) throw new Error(error.message);
      userId = inv.user.id;
      invited = true;
    }
    const { data: ownerRole } = await supabaseAdmin.from("user_roles").select("id").eq("user_id", userId).eq("role", "owner").maybeSingle();
    if (ownerRole) throw new Error("That email belongs to the owner account.");
    await supabaseAdmin.from("user_roles").upsert({ user_id: userId, role: "client" }, { onConflict: "user_id,role" });
    if (data.projectIds.length) {
      const { error } = await supabaseAdmin.from("project_clients").upsert(
        data.projectIds.map((project_id) => ({ project_id, user_id: userId! })),
        { onConflict: "project_id,user_id" },
      );
      if (error) throw new Error(error.message);
    }
    return { invited, userId };
  });
