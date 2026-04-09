"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProject } from "@/contexts/ProjectContext";
import { isAllProjects } from "@/lib/projectScope";
import { userHasOwnerOnAnyProject } from "@/lib/ownerAccess";

/**
 * Desktop/mobile nav: show Calendar + Finance only for superusers or users with
 * owner-level access on the selected project, or on any project when "Összes projekt" is selected.
 */
export function useOwnerOnlyNav() {
  const { projectId, accessibleProjects, projectsDirectoryLoaded } = useProject();
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [isOwnerForProject, setIsOwnerForProject] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const supabase = createClient();
    if (!supabase) return;

    async function loadSuperuserForUserId(userId: string) {
      const { data } = await supabase
        .from("profiles")
        .select("is_superuser")
        .eq("id", userId)
        .single();

      if (!cancelled) setIsSuperuser(Boolean(data?.is_superuser));
    }

    async function loadInitial() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const userId =
          session?.user?.id ??
          (await supabase.auth.getUser()).data.user?.id ??
          null;

        if (!userId) {
          if (!cancelled) setIsSuperuser(false);
          if (!cancelled) setAuthUserId(null);
          return;
        }

        if (!cancelled) setAuthUserId(userId);
        await loadSuperuserForUserId(userId);
      } catch {
        if (!cancelled) setIsSuperuser(false);
        if (!cancelled) setAuthUserId(null);
      }
    }

    void loadInitial();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user?.id;
      if (!userId) {
        if (!cancelled) setIsSuperuser(false);
        if (!cancelled) setAuthUserId(null);
        return;
      }

      if (!cancelled) setAuthUserId(userId);
      void loadSuperuserForUserId(userId);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const supabase = createClient();
    if (!supabase) {
      setIsOwnerForProject(false);
      return;
    }

    if (!projectId || !authUserId) {
      setIsOwnerForProject(false);
      return;
    }

    void (async () => {
      if (isAllProjects(projectId)) {
        if (!projectsDirectoryLoaded) {
          if (!cancelled) setIsOwnerForProject(false);
          return;
        }
        const ids = accessibleProjects.map((p) => p.id);
        if (ids.length === 0) {
          if (!cancelled) setIsOwnerForProject(false);
          return;
        }
        const ok = await userHasOwnerOnAnyProject(supabase, authUserId, ids);
        if (!cancelled) setIsOwnerForProject(ok);
        return;
      }

      const { data } = await supabase.rpc("user_has_project_access", {
        p_user_id: authUserId,
        p_project_id: projectId,
        p_min_role: "owner",
      });

      if (!cancelled) setIsOwnerForProject(Boolean(data));
    })();

    return () => {
      cancelled = true;
    };
  }, [authUserId, projectId, accessibleProjects, projectsDirectoryLoaded]);

  const canViewOwnerOnlyPages = isSuperuser || isOwnerForProject;

  return { canViewOwnerOnlyPages, isSuperuser };
}
