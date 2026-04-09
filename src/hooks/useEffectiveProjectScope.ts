"use client";

import { useMemo } from "react";
import { useProject } from "@/contexts/ProjectContext";
import { isAllProjects } from "@/lib/projectScope";

export type EffectiveProjectScope =
  | { kind: "none" }
  | { kind: "loading_all" }
  | { kind: "all"; ids: string[]; projects: { id: string; name: string }[] }
  | { kind: "single"; id: string };

/**
 * Resolves dropdown selection into either no project, a single UUID, or all accessible project IDs.
 */
export function useEffectiveProjectScope(): EffectiveProjectScope {
  const { projectId, accessibleProjects, projectsDirectoryLoaded } = useProject();

  return useMemo(() => {
    if (!projectId) return { kind: "none" };
    if (isAllProjects(projectId)) {
      if (!projectsDirectoryLoaded) return { kind: "loading_all" };
      const ids = accessibleProjects.map((p) => p.id);
      return { kind: "all", ids, projects: accessibleProjects };
    }
    return { kind: "single", id: projectId };
  }, [projectId, accessibleProjects, projectsDirectoryLoaded]);
}
