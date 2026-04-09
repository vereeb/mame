"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProject } from "@/contexts/ProjectContext";
import { isAllProjects } from "@/lib/projectScope";
import { userHasOwnerOnAnyProject } from "@/lib/ownerAccess";

/**
 * Finance / Calendar pages: allowed only for superuser or owner-level access
 * on the selected project (or on any listed project when "Összes projekt" is selected).
 * `allowed === null` while checking.
 */
export function useOwnerProjectPageAccess() {
  const { projectId, accessibleProjects, projectsDirectoryLoaded } = useProject();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAccess() {
      if (!projectId) {
        setAllowed(false);
        return;
      }

      if (isAllProjects(projectId)) {
        if (!projectsDirectoryLoaded) {
          setAllowed(null);
          return;
        }
        const ids = accessibleProjects.map((p) => p.id);
        if (ids.length === 0) {
          setAllowed(false);
          return;
        }
      }

      const supabase = createClient();
      if (!supabase) {
        setError("A Supabase nincs beállítva");
        setAllowed(false);
        return;
      }

      setError(null);
      setAllowed(null);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const userId = session?.user?.id ?? (await supabase.auth.getUser()).data.user?.id;
        if (!userId) {
          if (!cancelled) setAllowed(false);
          return;
        }

        const { data: profileData } = await supabase
          .from("profiles")
          .select("is_superuser")
          .eq("id", userId)
          .single();

        if (Boolean(profileData?.is_superuser)) {
          if (!cancelled) setAllowed(true);
          return;
        }

        if (isAllProjects(projectId)) {
          const ids = accessibleProjects.map((p) => p.id);
          const ok = await userHasOwnerOnAnyProject(supabase, userId, ids);
          if (!cancelled) setAllowed(ok);
          return;
        }

        const { data: ownerOk } = await supabase.rpc("user_has_project_access", {
          p_user_id: userId,
          p_project_id: projectId,
          p_min_role: "owner",
        });

        if (!cancelled) setAllowed(Boolean(ownerOk));
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Hozzáférés ellenőrzése sikertelen");
          setAllowed(false);
        }
      }
    }

    void loadAccess();
    return () => {
      cancelled = true;
    };
  }, [projectId, accessibleProjects, projectsDirectoryLoaded]);

  return { projectId, allowed, error };
}
