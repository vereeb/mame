"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { EffectiveProjectScope } from "@/hooks/useEffectiveProjectScope";
import { formatHufAmount } from "@/lib/formatHuf";

function todayISODateLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type ProjectRow = {
  id: string;
  name: string;
  address: string | null;
  offered_price: number | null;
};

type DeadlineRow = {
  id: string;
  title: string;
  event_date: string;
};

export function ProjectDashboardSummary({ scope }: { scope: EffectiveProjectScope }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [costsByProject, setCostsByProject] = useState<Record<string, number>>({});
  const [deadlinesByProject, setDeadlinesByProject] = useState<Record<string, DeadlineRow[]>>({});

  const scopeStableKey =
    scope.kind === "all"
      ? scope.ids.join(",")
      : scope.kind === "single"
        ? scope.id
        : "";

  const load = useCallback(async () => {
    if (scope.kind === "none" || scope.kind === "loading_all") {
      setProjects([]);
      setCostsByProject({});
      setDeadlinesByProject({});
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setError("A Supabase nincs beállítva");
      return;
    }

    const ids = scope.kind === "all" ? scope.ids : [scope.id];
    if (ids.length === 0) {
      setProjects([]);
      setCostsByProject({});
      setDeadlinesByProject({});
      return;
    }

    setLoading(true);
    setError(null);
    const today = todayISODateLocal();

    try {
      const { data: projData, error: projErr } = await supabase
        .from("projects")
        .select("id, name, address, offered_price")
        .in("id", ids)
        .order("name");
      if (projErr) throw projErr;

      const { data: expenseRows, error: expErr } = await supabase
        .from("calendar_events")
        .select("project_id, amount")
        .eq("event_type", "planned_expense")
        .in("project_id", ids);
      if (expErr) throw expErr;

      const { data: deadlineRows, error: dlErr } = await supabase
        .from("calendar_events")
        .select("id, project_id, title, event_date")
        .eq("event_type", "deadline")
        .in("project_id", ids)
        .gte("event_date", today);
      if (dlErr) throw dlErr;

      const costs: Record<string, number> = {};
      for (const id of ids) costs[id] = 0;
      for (const row of expenseRows ?? []) {
        const pid = row.project_id as string;
        const n = Number(row.amount);
        if (!costs[pid]) costs[pid] = 0;
        if (Number.isFinite(n)) costs[pid] += n;
      }

      const byPid = new Map<string, { id: string; title: string; event_date: string }[]>();
      for (const row of deadlineRows ?? []) {
        const pid = row.project_id as string;
        if (!byPid.has(pid)) byPid.set(pid, []);
        byPid.get(pid)!.push({
          id: row.id as string,
          title: ((row.title as string) ?? "").trim() || "Határidő",
          event_date: row.event_date as string,
        });
      }
      const dls: Record<string, DeadlineRow[]> = {};
      for (const id of ids) {
        const list = (byPid.get(id) ?? []).sort((a, b) => a.event_date.localeCompare(b.event_date)).slice(0, 8);
        dls[id] = list;
      }

      setProjects((projData ?? []) as ProjectRow[]);
      setCostsByProject(costs);
      setDeadlinesByProject(dls);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Adatok betöltése sikertelen");
      setProjects([]);
      setCostsByProject({});
      setDeadlinesByProject({});
    } finally {
      setLoading(false);
    }
  }, [scope.kind, scopeStableKey]);

  useEffect(() => {
    void load();
  }, [load]);

  if (scope.kind === "none") {
    return null;
  }

  if (scope.kind === "loading_all") {
    return (
      <div className="flex items-center gap-3 py-8 text-black/60 font-sans text-sm">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
        Projektek betöltése…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-800 font-sans text-sm">{error}</div>
    );
  }

  if (loading && projects.length === 0) {
    return (
      <div className="flex items-center gap-3 py-8 text-black/60 font-sans text-sm">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
        Irányítópult adatok betöltése…
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <p className="font-sans text-sm text-black/60 py-4">Nincs megjeleníthető projekt.</p>
    );
  }

  if (scope.kind === "single") {
    const p = projects[0];
    if (!p) return null;
    const totalCosts = costsByProject[p.id] ?? 0;
    const deadlines = deadlinesByProject[p.id] ?? [];
    const offered = p.offered_price != null && Number.isFinite(Number(p.offered_price)) ? Number(p.offered_price) : null;

    return (
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-outline bg-white p-4 shadow-m3-1">
          <h3 className="font-sans text-xs font-semibold uppercase tracking-wide text-black/50 mb-2">Helyszín / cím</h3>
          <p className="font-sans text-sm text-black leading-relaxed">
            {p.address?.trim() ? p.address : <span className="text-black/45">Nincs megadva</span>}
          </p>
        </div>
        <div className="rounded-xl border border-outline bg-white p-4 shadow-m3-1">
          <h3 className="font-sans text-xs font-semibold uppercase tracking-wide text-black/50 mb-2">
            Költségek összesen
          </h3>
          <p className="font-serif text-xl font-semibold text-red-900 tabular-nums">{formatHufAmount(totalCosts)}</p>
          <p className="font-sans text-xs text-black/50 mt-1">Naptár „Kiadás” tételek összege</p>
        </div>
        <div className="rounded-xl border border-outline bg-white p-4 shadow-m3-1 sm:col-span-2">
          <h3 className="font-sans text-xs font-semibold uppercase tracking-wide text-black/50 mb-2">
            Következő határidők
          </h3>
          {deadlines.length === 0 ? (
            <p className="font-sans text-sm text-black/45">Nincs közeli határidő a naptárban.</p>
          ) : (
            <ul className="space-y-2">
              {deadlines.map((d) => (
                <li key={d.id} className="flex flex-wrap items-baseline justify-between gap-2 font-sans text-sm border-b border-outline/60 last:border-0 pb-2 last:pb-0">
                  <span className="text-black font-medium">{d.title}</span>
                  <span className="text-black/70 tabular-nums shrink-0">{d.event_date}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-outline bg-white p-4 shadow-m3-1 sm:col-span-2">
          <h3 className="font-sans text-xs font-semibold uppercase tracking-wide text-black/50 mb-2">Ajánlati ár</h3>
          <p className="font-serif text-xl font-semibold text-black tabular-nums">
            {offered != null ? formatHufAmount(offered) : <span className="text-black/45 font-sans text-sm font-normal">Nincs megadva</span>}
          </p>
          {offered == null && (
            <p className="font-sans text-xs text-black/50 mt-1">Megadható az Admin → Projektek menüben.</p>
          )}
        </div>
      </div>
    );
  }

  // scope.kind === "all"
  return (
    <div className="mt-6 space-y-4">
      <p className="font-sans text-sm text-black/60">
        Összesített nézet — {projects.length} projekt. Részletes kártyákhoz válassz egy projektet a fejlécben.
      </p>
      <div className="overflow-x-auto rounded-xl border border-outline bg-white shadow-m3-1">
        <table className="w-full min-w-[640px] text-left font-sans text-sm">
          <thead>
            <tr className="border-b border-outline bg-surface-variant">
              <th className="px-3 py-2.5 font-semibold text-black/80">Projekt</th>
              <th className="px-3 py-2.5 font-semibold text-black/80">Cím</th>
              <th className="px-3 py-2.5 font-semibold text-black/80 text-right whitespace-nowrap">Költség</th>
              <th className="px-3 py-2.5 font-semibold text-black/80 text-right whitespace-nowrap">Ajánlat</th>
              <th className="px-3 py-2.5 font-semibold text-black/80">Következő határidő</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => {
              const dl = (deadlinesByProject[p.id] ?? [])[0];
              const cost = costsByProject[p.id] ?? 0;
              const off =
                p.offered_price != null && Number.isFinite(Number(p.offered_price))
                  ? Number(p.offered_price)
                  : null;
              return (
                <tr key={p.id} className="border-b border-outline/80 hover:bg-surface-variant/40">
                  <td className="px-3 py-2 font-medium text-black">{p.name}</td>
                  <td className="px-3 py-2 text-black/80 max-w-[12rem] truncate" title={p.address ?? ""}>
                    {p.address?.trim() || "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-red-900">{formatHufAmount(cost)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{off != null ? formatHufAmount(off) : "—"}</td>
                  <td className="px-3 py-2 text-black/80">
                    {dl ? (
                      <span>
                        {dl.event_date} — <span className="text-black">{dl.title}</span>
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
