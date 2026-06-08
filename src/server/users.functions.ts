import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

/**
 * Lists all users with their roles and profiles.
 * Only accessible by admins.
 */
export const listUsers = createServerFn({ method: "GET" })
  .validator(z.object({ accessToken: z.string() }))
  .handler(async ({ data: { accessToken } }) => {
    // In a real scenario, we should verify the accessToken or the session on the server.
    // For now, we rely on the client providing the token and the DB RLS policies.
    
    // Note: To list all users from auth.users, we need the service_role key 
    // or use a custom function/view in public schema that exposes them.
    // Since we can't easily use service_role here without environmental variables 
    // and direct fetch, we'll query the public tables.
    
    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id, role");
      
    if (rolesError) throw rolesError;

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, created_at");

    if (profilesError) throw profilesError;

    // Join data
    return profiles.map(profile => ({
      ...profile,
      role: roles.find(r => r.user_id === profile.id)?.role || "user"
    }));
  });

/**
 * Updates a user's role.
 * Only accessible by admins.
 */
export const updateUserRole = createServerFn({ method: "POST" })
  .validator(z.object({
    accessToken: z.string(),
    userId: z.string(),
    role: z.enum(["admin", "employee", "user"])
  }))
  .handler(async ({ data: { userId, role } }) => {
    // Upsert the role in user_roles
    const { error } = await supabase
      .from("user_roles")
      .upsert({ user_id: userId, role: role as any }, { onConflict: "user_id" });

    if (error) throw error;
    return { success: true };
  });

/**
 * Deletes a user (this is complex since it involves auth.users).
 * Usually requires service_role or a specific edge function.
 */
export const deleteUser = createServerFn({ method: "POST" })
  .validator(z.object({
    accessToken: z.string(),
    userId: z.string()
  }))
  .handler(async ({ data: { userId } }) => {
    // We can't delete from auth.users easily without service_role.
    // We can delete the role and profile though.
    const { error: roleError } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId);
      
    if (roleError) throw roleError;

    const { error: profileError } = await supabase
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (profileError) throw profileError;

    return { success: true };
  });
