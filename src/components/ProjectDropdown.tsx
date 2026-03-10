"use client";

import { useEffect, useState } from "react";
import { useProject } from "@/contexts/ProjectContext";
import { createClient } from "@/lib/supabase/client";

type Project = { id: string; name: string };

export function ProjectDropdown() {
  const { projectId, setProjectId } = useProject();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.from("projects").select("id, name").order("name");
        if (!cancelled) setProjects(data ?? []);
      } catch {
        if (!cancelled) setProjects([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex-1 min-w-0">
      <select
        value={projectId ?? ""}
        onChange={(e) => setProjectId(e.target.value || null)}
        disabled={loading}
        className="w-full max-w-[200px] md:max-w-xs h-9 pl-3 pr-8 rounded-lg border border-outline bg-surface-variant text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary appearance-none cursor-pointer disabled:opacity-60"
        aria-label="Select project"
      >
        <option value="">Select project…</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}
