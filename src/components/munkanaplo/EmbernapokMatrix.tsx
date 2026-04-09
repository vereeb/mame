"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const SAJAT_KIND = "Sajat projekt" as const;

/** Maps PostgREST “table missing” errors to setup instructions (migrations not applied on Supabase). */
function friendlyDbError(raw: string): string {
  const lower = raw.toLowerCase();
  if (
    lower.includes("laborer_project_day_assignments") &&
    (lower.includes("could not find") ||
      lower.includes("does not exist") ||
      lower.includes("schema cache") ||
      lower.includes("pgrst"))
  ) {
    return (
      "Az adatbázisban még nincs létrehozva a szükséges tábla. A Supabase Dashboard → SQL szerkesztőjében futtasd a repó " +
      "supabase/migrations/029_embernapok_assignments.sql fájlját, majd szükség szerint a 030 és 031 migrációkat is. " +
      "Ezután frissíts az oldalon."
    );
  }
  return raw;
}

function cellKey(laborerId: string, projectId: string) {
  return `${laborerId}\t${projectId}`;
}

function toISODateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type ProjectCol = { id: string; name: string };
type LaborerRow = { id: string; name: string };

type MatrixStructure = {
  sajatProjectIds: string[];
  projects: ProjectCol[];
  laborers: LaborerRow[];
};

export function EmbernapokMatrix() {
  const [workDate, setWorkDate] = useState(() => toISODateLocal(new Date()));
  const [loadingBase, setLoadingBase] = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [structure, setStructure] = useState<MatrixStructure | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const loadAssignments = useCallback(async (date: string, sajatProjectIds: string[]) => {
    if (sajatProjectIds.length === 0) {
      setChecked(new Set());
      return;
    }

    const supabase = createClient();
    if (!supabase) return;

    setLoadingAssignments(true);
    setError(null);
    try {
      const { data: assignRows, error: aErr } = await supabase
        .from("laborer_project_day_assignments")
        .select("laborer_id, project_id")
        .eq("work_date", date)
        .in("project_id", sajatProjectIds);

      if (aErr) {
        throw new Error(aErr.message || String(aErr));
      }

      const nextChecked = new Set<string>();
      for (const row of assignRows ?? []) {
        nextChecked.add(cellKey(row.laborer_id as string, row.project_id as string));
      }
      setChecked(nextChecked);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Bejegyzések betöltése sikertelen";
      setError(friendlyDbError(msg));
      setChecked(new Set());
    } finally {
      setLoadingAssignments(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadBase() {
      const supabase = createClient();
      if (!supabase) {
        if (!cancelled) {
          setError("A Supabase nincs beállítva");
          setLoadingBase(false);
          setStructure({ sajatProjectIds: [], projects: [], laborers: [] });
        }
        return;
      }

      if (!cancelled) {
        setLoadingBase(true);
        setError(null);
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const userId = session?.user?.id ?? (await supabase.auth.getUser()).data.user?.id;
        if (!userId) {
          if (!cancelled) {
            setError("Nincs bejelentkezve");
            setStructure({ sajatProjectIds: [], projects: [], laborers: [] });
          }
          return;
        }

        const { data: profileData } = await supabase
          .from("profiles")
          .select("is_superuser")
          .eq("id", userId)
          .single();

        const isSuperuser = Boolean(profileData?.is_superuser);

        let sajatProjectIds: string[] = [];

        if (isSuperuser) {
          const { data: prs, error: prErr } = await supabase
            .from("projects")
            .select("id")
            .eq("project_kind", SAJAT_KIND);

          if (prErr) throw prErr;
          sajatProjectIds = (prs ?? []).map((p) => p.id as string);
        } else {
          const { data: owned, error: omErr } = await supabase
            .from("project_members")
            .select("project_id")
            .eq("user_id", userId)
            .eq("role", "owner");

          if (omErr) throw omErr;
          const ownedIds = (owned ?? []).map((r) => r.project_id as string);
          if (ownedIds.length === 0) {
            if (!cancelled) {
              setStructure({ sajatProjectIds: [], projects: [], laborers: [] });
            }
            return;
          }

          const { data: sajatRows, error: sjErr } = await supabase
            .from("projects")
            .select("id")
            .in("id", ownedIds)
            .eq("project_kind", SAJAT_KIND);

          if (sjErr) throw sjErr;
          sajatProjectIds = (sajatRows ?? []).map((p) => p.id as string);
        }

        if (sajatProjectIds.length === 0) {
          if (!cancelled) {
            setStructure({ sajatProjectIds: [], projects: [], laborers: [] });
          }
          return;
        }

        const { data: projectRows, error: pErr } = await supabase
          .from("projects")
          .select("id, name")
          .in("id", sajatProjectIds)
          .order("name");

        if (pErr) throw pErr;
        const projList: ProjectCol[] = (projectRows ?? []).map((r) => ({
          id: r.id as string,
          name: String(r.name ?? ""),
        }));

        const { data: labRows, error: lErr } = await supabase
          .from("laborers")
          .select("id, name")
          .neq("access_role", "owner")
          .order("name");

        if (lErr) throw lErr;
        const labList: LaborerRow[] = (labRows ?? []).map((r) => ({
          id: r.id as string,
          name: String(r.name ?? ""),
        }));

        if (!cancelled) {
          setStructure({
            sajatProjectIds,
            projects: projList,
            laborers: labList,
          });
        }
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Betöltés sikertelen";
          setError(friendlyDbError(msg));
          setStructure({ sajatProjectIds: [], projects: [], laborers: [] });
        }
      } finally {
        if (!cancelled) setLoadingBase(false);
      }
    }

    void loadBase();
    return () => {
      cancelled = true;
    };
  }, []);

  const sajatKey = structure?.sajatProjectIds.join(",") ?? "";

  useEffect(() => {
    if (loadingBase) return;
    const ids = sajatKey.length > 0 ? sajatKey.split(",") : [];
    void loadAssignments(workDate, ids);
  }, [workDate, sajatKey, loadingBase, loadAssignments]);

  const toggle = useCallback(
    async (laborerId: string, projectId: string, next: boolean) => {
      if (!structure) return;
      const key = cellKey(laborerId, projectId);

      const supabase = createClient();
      if (!supabase) return;

      setSaving(true);
      setError(null);
      try {
        if (next) {
          const { error: insErr } = await supabase.from("laborer_project_day_assignments").insert({
            laborer_id: laborerId,
            project_id: projectId,
            work_date: workDate,
          });
          if (insErr) throw new Error(insErr.message || String(insErr));
          setChecked((prev) => new Set(prev).add(key));
        } else {
          const { error: delErr } = await supabase
            .from("laborer_project_day_assignments")
            .delete()
            .eq("laborer_id", laborerId)
            .eq("project_id", projectId)
            .eq("work_date", workDate);
          if (delErr) throw new Error(delErr.message || String(delErr));
          setChecked((prev) => {
            const n = new Set(prev);
            n.delete(key);
            return n;
          });
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Mentés sikertelen";
        setError(friendlyDbError(msg));
      } finally {
        setSaving(false);
      }
    },
    [structure, workDate]
  );

  const projects = structure?.projects ?? [];
  const laborers = structure?.laborers ?? [];

  const loading = loadingBase || loadingAssignments;
  const matrixDisabled = loading || saving;

  const emptyMessage = useMemo(() => {
    if (loadingBase) return null;
    if (projects.length === 0) {
      return "Nincs „Saját projekt” típusú projekt, amelynek Ön a tulajdonosa (vagy nincs ilyen a listában).";
    }
    if (laborers.length === 0) {
      return "Nincs listázható munkavállaló. Vegyen fel munkavállalókat az Admin → Munkavállalók menüben (Owner szerepkörűek itt nem jelennek meg).";
    }
    return null;
  }, [loadingBase, projects.length, laborers.length]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <label className="flex flex-col gap-1 font-sans text-sm text-black/80">
          <span>Dátum</span>
          <input
            type="date"
            value={workDate}
            onChange={(e) => setWorkDate(e.target.value)}
            className="rounded-lg border border-outline bg-white px-3 py-2 text-sm text-black font-sans max-w-[12rem]"
            disabled={matrixDisabled}
          />
        </label>
        <p className="text-xs text-black/55 font-sans sm:max-w-md">
          Csak „Saját projekt” oszlopok jelennek meg. A munkavállalók globális lista az Adminból; a napi beosztás és hogy ki
          melyik projekten dolgozik, csak itt rögzítendő. Nem jelennek meg a „Owner” jogosultságú munkavállalók.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-800 font-sans text-sm" role="alert">
          {error}
        </div>
      )}

      {loadingBase && <p className="text-sm text-black/60 font-sans">Betöltés…</p>}

      {!loadingBase && emptyMessage && <p className="text-sm text-black/60 font-sans">{emptyMessage}</p>}

      {!loadingBase && !emptyMessage && projects.length > 0 && laborers.length > 0 && (
        <div className="relative overflow-x-auto rounded-xl border border-outline bg-white shadow-m3-1 -mx-1">
          {loadingAssignments && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/50 text-sm text-black/60 font-sans rounded-xl">
              Nap frissítése…
            </div>
          )}
          <table className="w-full min-w-[480px] text-left font-sans text-sm border-collapse">
            <thead>
              <tr className="border-b border-outline bg-surface-variant/80">
                <th className="sticky left-0 z-10 bg-surface-variant px-3 py-2 font-medium text-black whitespace-nowrap border-r border-outline">
                  Munkavállaló
                </th>
                {projects.map((p) => (
                  <th
                    key={p.id}
                    className="px-2 py-2 font-medium text-black text-center min-w-[7rem] max-w-[10rem]"
                    title={p.name}
                  >
                    <span className="line-clamp-2">{p.name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {laborers.map((lab) => (
                <tr key={lab.id} className="border-b border-outline/70 last:border-0">
                  <td className="sticky left-0 z-10 bg-white px-3 py-2 text-black whitespace-nowrap border-r border-outline font-medium">
                    {lab.name}
                  </td>
                  {projects.map((p) => {
                    const key = cellKey(lab.id, p.id);
                    const isOn = checked.has(key);
                    return (
                      <td key={p.id} className="px-1 py-1.5 text-center align-middle">
                        <input
                          type="checkbox"
                          checked={isOn}
                          disabled={matrixDisabled}
                          onChange={(e) => void toggle(lab.id, p.id, e.target.checked)}
                          className="h-5 w-5 rounded border-outline text-primary focus:ring-primary cursor-pointer disabled:opacity-50"
                          aria-label={`${lab.name} — ${p.name} — ${workDate}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
