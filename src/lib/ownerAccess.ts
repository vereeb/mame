import type { SupabaseClient } from "@supabase/supabase-js";

/** True if the user has owner-level access on at least one of the given projects. */
export async function userHasOwnerOnAnyProject(
  supabase: SupabaseClient,
  userId: string,
  projectIds: string[]
): Promise<boolean> {
  if (projectIds.length === 0) return false;
  const results = await Promise.all(
    projectIds.map((p_project_id) =>
      supabase.rpc("user_has_project_access", {
        p_user_id: userId,
        p_project_id,
        p_min_role: "owner",
      })
    )
  );
  return results.some((r) => !r.error && Boolean(r.data));
}
