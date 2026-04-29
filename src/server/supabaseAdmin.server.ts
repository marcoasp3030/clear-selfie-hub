// Server-only re-export of the admin Supabase client.
// .functions.ts files must NOT import "@/integrations/supabase/client.server"
// directly (TanStack import-protection blocks it). Importing through this
// .server.ts wrapper keeps the boundary clean.
export { supabaseAdmin } from "@/integrations/supabase/client.server";
