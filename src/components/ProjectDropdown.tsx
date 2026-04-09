"use client";

import { useEffect, useState, useCallback } from "react";
import { useProject, type AccessibleProject } from "@/contexts/ProjectContext";
import { createClient } from "@/lib/supabase/client";
import { ALL_PROJECTS_VALUE, isAllProjects } from "@/lib/projectScope";
import { userHasOwnerOnAnyProject } from "@/lib/ownerAccess";

export function ProjectDropdown() {
  const {
    projectId,
    setProjectId,
    setProjectsFromDirectory,
    markProjectsDirectoryStale,
  } = useProject();
  const [projects, setProjects] = useState<AccessibleProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperuser, setIsSuperuser] = useState<boolean>(false);
  /** Superuser or owner on ≥1 accessible project — gets „Összes projekt” default, no empty option. */
  const [isOwnerLike, setIsOwnerLike] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");

  const fetchProjects = useCallback(
    async (supabase: any, cancelled: boolean): Promise<AccessibleProject[] | null> => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name")
        .order("name");

      if (cancelled) return null;

      if (error) {
        setProjects([]);
        setProjectsFromDirectory([]);
        return [];
      }

      const list = (data ?? []) as AccessibleProject[];
      setProjects(list);
      setProjectsFromDirectory(list);
      return list;
    },
    [setProjectsFromDirectory]
  );

  useEffect(() => {
    let cancelled = false;

    const supabase = createClient();
    if (!supabase) {
      if (!cancelled) {
        setLoading(false);
        setIsOwnerLike(false);
        setProjectsFromDirectory([]);
      }
      return;
    }

    async function refresh() {
      setLoading(true);
      markProjectsDirectoryStale();
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const userId =
          session?.user?.id ??
          (await supabase.auth.getUser()).data.user?.id ??
          null;

        if (!userId) {
          if (!cancelled) {
            setIsSuperuser(false);
            setIsOwnerLike(false);
            setProjects([]);
            setProjectsFromDirectory([]);
          }
          return;
        }

        // `profiles.is_superuser` is protected by RLS (users can read their own profile).
        const { data: profileData } = await supabase
          .from("profiles")
          .select("is_superuser")
          .eq("id", userId)
          .single();

        const superuser = Boolean(profileData?.is_superuser);
        if (!cancelled) setIsSuperuser(superuser);

        const list = await fetchProjects(supabase, cancelled);
        if (cancelled || list === null) return;

        const ownerLike =
          superuser ||
          (list.length > 0 &&
            (await userHasOwnerOnAnyProject(
              supabase,
              userId,
              list.map((p) => p.id)
            )));

        if (!cancelled) {
          setIsOwnerLike(ownerLike);
          if (ownerLike && list.length > 0) {
            setProjectId((prev) =>
              prev == null || prev === "" ? ALL_PROJECTS_VALUE : prev
            );
          }
          if (!ownerLike) {
            setProjectId((prev) => (isAllProjects(prev) ? null : prev));
          }
        }
      } catch {
        if (!cancelled) {
          setIsSuperuser(false);
          setIsOwnerLike(false);
          setProjects([]);
          setProjectsFromDirectory([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void refresh();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // Session becoming available is what fixes the "empty until hard refresh" issue on Vercel.
      if (!cancelled) void refresh();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [fetchProjects, markProjectsDirectoryStale, setProjectId, setProjectsFromDirectory]);

  const showSelectPlaceholder =
    loading || projects.length === 0 || !isOwnerLike;

  return (
    <div className="flex-1 min-w-0">
      <select
        value={projectId ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          setProjectId(v ? v : null);
        }}
        disabled={loading}
        className="w-full max-w-[200px] md:max-w-xs h-9 pl-3 pr-8 rounded-lg border border-outline bg-surface-variant text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary appearance-none cursor-pointer disabled:opacity-60"
        aria-label={isOwnerLike ? "Projekt vagy összesített nézet" : "Projekt kiválasztása"}
      >
        {loading ? (
          <option value="" disabled>
            Betöltés…
          </option>
        ) : (
          <>
            {showSelectPlaceholder && (
              <option value="">Projekt kiválasztása…</option>
            )}
            {projects.length > 0 && (
              <option value={ALL_PROJECTS_VALUE}>Összes projekt</option>
            )}
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </>
        )}
      </select>

      {/* Create Project Dialog (superuser only) */}
      {createOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Új projekt létrehozása"
          onClick={(e) => {
            if (e.target === e.currentTarget && !creating) setCreateOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white border border-outline shadow-m3-2 p-4">
            <div className="px-2 py-3">
              <h3 className="font-serif text-lg font-semibold text-black">
                Projekt létrehozása
              </h3>
              <p className="font-sans text-sm text-black/60 mt-1">
                Szuperfelhasználói művelet.
              </p>
            </div>

            <div className="space-y-3 px-2 pb-4">
              <label className="block">
                <span className="font-sans text-sm font-medium text-black">
                  Név
                </span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full h-11 px-4 rounded-lg border border-outline bg-surface-variant font-sans text-sm text-black focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="pl. Midtown Renovation"
                  required
                />
              </label>

              <label className="block">
                <span className="font-sans text-sm font-medium text-black">
                  Leírás (opcionális)
                </span>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 w-full h-11 px-4 rounded-lg border border-outline bg-surface-variant font-sans text-sm text-black focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Rövid megjegyzések"
                />
              </label>

              <label className="block">
                <span className="font-sans text-sm font-medium text-black">
                  Cím (opcionális)
                </span>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="mt-1 w-full h-11 px-4 rounded-lg border border-outline bg-surface-variant font-sans text-sm text-black focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Utca / telephely címe"
                />
              </label>

              {createError && (
                <div className="p-3 rounded-lg bg-red-50 text-red-700 font-sans text-sm">
                  {createError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  disabled={creating}
                  onClick={() => setCreateOpen(false)}
                  className="flex-1 h-11 rounded-xl font-sans text-sm font-medium text-black/80 hover:bg-surface-variant active:bg-outline disabled:opacity-60"
                >
                  Mégse
                </button>
                <button
                  type="button"
                  disabled={creating || !name.trim()}
                  onClick={async () => {
                    setCreating(true);
                    setCreateError(null);
                    try {
                      const supabase = createClient();
                      if (!supabase) throw new Error("A Supabase nincs konfigurálva");

                      const { data: authData } = await supabase.auth.getUser();
                      const userId = authData?.user?.id;
                      if (!userId) throw new Error("Jelentkezz be szuperfelhasználóként");

                      const { data: projectInsert, error: projErr } = await supabase
                        .from("projects")
                        .insert({
                          name: name.trim(),
                          description: description.trim() || null,
                          address: address.trim() || null,
                        })
                        .select("id")
                        .single();

                      if (projErr) throw projErr;

                      const newProjectId = projectInsert.id as string;

                      const { error: memberErr } = await supabase
                        .from("project_members")
                        .insert({
                          project_id: newProjectId,
                          user_id: userId,
                          role: "owner",
                        });

                      if (memberErr) throw memberErr;

                      setProjectId(newProjectId);
                      await fetchProjects(supabase, false);
                      setCreateOpen(false);
                    } catch (e: any) {
                      setCreateError(
                        e?.message ?? "A projekt létrehozása sikertelen"
                      );
                    } finally {
                      setCreating(false);
                    }
                  }}
                  className="flex-1 h-11 rounded-xl font-sans text-sm font-medium bg-primary text-black hover:opacity-90 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {creating ? "Létrehozás..." : "Létrehozás"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
