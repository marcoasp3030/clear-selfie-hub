import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertAdminAccess } from "./admin.server";
import { supabaseAdmin } from "./supabaseAdmin.server";

const accessTokenSchema = z.string().trim().min(1);

/**
 * Lists all users with their roles and profiles.
 * Only accessible by admins.
 */
export const listUsers = createServerFn({ method: "GET" })
  .inputValidator((input: { accessToken: string }) => 
    z.object({ accessToken: accessTokenSchema }).parse(input)
  )
  .handler(async ({ data: { accessToken } }) => {
    await assertAdminAccess(accessToken);

    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
      
    if (rolesError) throw rolesError;

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, avatar_url, created_at");

    if (profilesError) throw profilesError;

    return profiles.map(profile => ({
      ...profile,
      role: (roles.find(r => r.user_id === profile.id)?.role as string) || "user"
    }));
  });

/**
 * Updates a user's role.
 * Only accessible by admins.
 */
export const updateUserRole = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; userId: string; role: string }) => 
    z.object({
      accessToken: accessTokenSchema,
      userId: z.string().uuid(),
      role: z.string()
    }).parse(input)
  )
  .handler(async ({ data: { accessToken, userId, role } }) => {
    await assertAdminAccess(accessToken);

    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: role as any }, { onConflict: "user_id" });

    if (error) throw error;
    return { success: true };
  });

/**
 * Deletes a user (this is complex since it involves auth.users).
 */
export const deleteUser = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; userId: string }) => 
    z.object({
      accessToken: accessTokenSchema,
      userId: z.string().uuid()
    }).parse(input)
  )
  .handler(async ({ data: { accessToken, userId } }) => {
    await assertAdminAccess(accessToken);

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", userId);
      
    if (roleError) throw roleError;

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (profileError) throw profileError;


    return { success: true };
  });

/**
 * Creates a new user with a specific role.
 * Only accessible by admins.
 */
export const createUser = createServerFn({ method: "POST" })
  .inputValidator((input: { 
    accessToken: string; 
    email: string; 
    password: string; 
    fullName: string; 
    role: string 
  }) => 
    z.object({
      accessToken: accessTokenSchema,
      email: z.string().email(),
      password: z.string().min(6),
      fullName: z.string().min(2),
      role: z.enum(["admin", "employee", "user"])
    }).parse(input)
  )
  .handler(async ({ data: { accessToken, email, password, fullName, role } }) => {
    await assertAdminAccess(accessToken);

    // 1. Create the user in Supabase Auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    });

    if (authError) {
      console.error("Auth creation error:", authError);
      throw new Error(authError.message);
    }

    if (!authUser.user) {
      throw new Error("Falha ao criar usuário");
    }

    // 2. Set the user role
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ 
        user_id: authUser.user.id, 
        role: role as any 
      });

    if (roleError) {
      console.error("Role assignment error:", roleError);
      // We don't necessarily want to fail completely if only the role failed, 
      // but usually we do for consistency.
      throw new Error("Usuário criado, mas falhou ao atribuir perfil: " + roleError.message);
    }

    return { success: true, userId: authUser.user.id };
  });
