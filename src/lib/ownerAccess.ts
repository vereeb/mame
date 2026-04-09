import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * True if the user has `owner` on at least one project (one query).
 * Matches RLS: owners can list all projects in the app directory.
 */
export async function userHasOwnerRoleAnywhere(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("user_id", userId)
    .eq("role", "owner")
    .limit(1);
  if (error) return false;
  return (data?.length ?? 0) > 0;
}
