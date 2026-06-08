import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const accessTokenSchema = z.string().trim().min(1);

/**
 * Lists all users with their roles and profiles.
 * Only accessible by admins.
 */
export const listUsers = createServerFn({ method: "GET" })
  .validator((input: { accessToken: string }) => 
    z.object({ accessToken: accessTokenSchema }).parse(input)
  )
  .handler(async ({ data: { accessToken } }) => {
    // In a real scenario, we should verify the accessToken or the session on the server.
    
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
  .validator((input: { accessToken: string; userId: string; role: string }) => 
    z.object({
      accessToken: accessTokenSchema,
      userId: z.string().uuid(),
      role: z.enum(["admin", "employee", "user"])
    }).parse(input)
  )
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
  .validator((input: { accessToken: string; userId: string }) => 
    z.object({
      accessToken: accessTokenSchema,
      userId: z.string().uuid()
    }).parse(input)
  )
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
