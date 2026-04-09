"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { EffectiveProjectScope } from "@/hooks/useEffectiveProjectScope";

/** Cashflow only includes planned items from this date; earlier calendar edits do not affect the table. */
export const CASHFLOW_EPOCH = "2026-01-01";

const OPENING_ROW_ID = "__cashflow_nullpoint__";

type PlannedEventType = "planned_income" | "planned_expense";

type CalendarPlannedRow = {
  id: string;
  project_id: string;
  event_type: PlannedEventType;
  title: string;
  event_date: string;
  amount: number | null;
};

export type CashflowTableRow = CalendarPlannedRow & {
  income: number;
  expense: number;
  /** Running balance for this project (account) after the row */
  accountBalance: number;
  /** Sum of all project balances after this row (same as accountBalance when only one project) */
  totalBalance: number;
};

function formatMoney(n: number) {
  return `${new Intl.NumberFormat("hu-HU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n)}\u00A0Ft`;
}

function parseAmount(v: number | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

type ScopeReady = Extract<
  EffectiveProjectScope,
  { kind: "single" } | { kind: "all" }
>;

export function PlannedCashflowTable({
  scope,
  projectNameById,
}: {
  scope: ScopeReady;
  projectNameById: Record<string, string>;
}) {
  const [raw, setRaw] = useState<CalendarPlannedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  /** Stable array identity — `[scope.id]` would be a new [] every render and retrigger fetch in a loop. */
  const projectIds = useMemo((): string[] => {
    if (scope.kind === "all") return scope.ids;
    return [scope.id];
  }, [scope.kind, scope.kind === "all" ? scope.ids.join(",") : scope.id]);

  const showAccountColumn = projectIds.length > 1;

  const fetchPlanned = useCallback(async () => {
    if (projectIds.length === 0) {
      setRaw([]);
      setLoading(false);
      return;
    }
    const supabase = createClient();
    if (!supabase) {
      setFetchError("A Supabase nincs beállítva");
      setRaw([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setFetchError(null);
    try {
      let q = supabase
        .from("calendar_events")
        .select("id, project_id, event_type, title, event_date, amount")
        .in("event_type", ["planned_income", "planned_expense"])
        .gte("event_date", CASHFLOW_EPOCH)
        .order("event_date", { ascending: true })
        .order("title", { ascending: true });
      q = projectIds.length === 1 ? q.eq("project_id", projectIds[0]) : q.in("project_id", projectIds);
      const { data, error } = await q;
      if (error) throw error;
      const list = ((data ?? []) as CalendarPlannedRow[]).filter(
        (r) => r.event_date >= CASHFLOW_EPOCH
      );
      list.sort((a, b) => {
        const d = a.event_date.localeCompare(b.event_date);
        if (d !== 0) return d;
        return a.title.localeCompare(b.title);
      });
      setRaw(list);
    } catch (e: unknown) {
      setFetchError(e instanceof Error ? e.message : "Betöltés sikertelen");
      setRaw([]);
    } finally {
      setLoading(false);
    }
  }, [projectIds]);

  useEffect(() => {
    void fetchPlanned();
  }, [fetchPlanned]);

  const tableRows = useMemo((): CashflowTableRow[] => {
    const balances = new Map<string, number>();
    for (const id of projectIds) {
      balances.set(id, 0);
    }

    const placeholderProjectId = projectIds[0] ?? "";
    const openingRow: CashflowTableRow = {
      id: OPENING_ROW_ID,
      project_id: placeholderProjectId,
      event_type: "planned_income",
      title: "Nyitó egyenleg — nullpont 2026.01.01.",
      event_date: CASHFLOW_EPOCH,
      amount: null,
      income: 0,
      expense: 0,
      accountBalance: 0,
      totalBalance: 0,
    };

    const rows: CashflowTableRow[] = [];
    for (const ev of raw) {
      const amt = parseAmount(ev.amount);
      const income = ev.event_type === "planned_income" ? amt : 0;
      const expense = ev.event_type === "planned_expense" ? amt : 0;
      const net = income - expense;
      const pid = ev.project_id;
      if (!balances.has(pid)) {
        balances.set(pid, 0);
      }
      balances.set(pid, (balances.get(pid) ?? 0) + net);
      const accountBalance = balances.get(pid) ?? 0;
      let totalBalance = 0;
      for (const v of balances.values()) {
        totalBalance += v;
      }
      rows.push({
        ...ev,
        income,
        expense,
        accountBalance,
        totalBalance,
      });
    }
    return [openingRow, ...rows];
  }, [raw, projectIds]);

  const closingByProject = useMemo(() => {
    const m = new Map<string, number>();
    for (const id of projectIds) {
      m.set(id, 0);
    }
    for (const r of tableRows) {
      if (r.id === OPENING_ROW_ID) continue;
      m.set(r.project_id, r.accountBalance);
    }
    return m;
  }, [tableRows, projectIds]);

  const closingTotal = useMemo(() => {
    let t = 0;
    for (const v of closingByProject.values()) {
      t += v;
    }
    return t;
  }, [closingByProject]);

  /** Footer lines only for projects that have at least one planned cashflow row */
  const footerProjectIds = useMemo(() => {
    const seen = new Set(
      tableRows.filter((r) => r.id !== OPENING_ROW_ID).map((r) => r.project_id)
    );
    return projectIds.filter((id) => seen.has(id));
  }, [tableRows, projectIds]);

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-8 text-black/60 font-sans text-sm">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
        Tervezett cashflow betöltése…
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="p-4 rounded-lg bg-red-50 text-red-700 font-sans text-sm">{fetchError}</div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="font-sans text-sm text-black/70">
        <strong>Időbeli nullpont: {CASHFLOW_EPOCH}</strong> — minden számla (projekt) egyenlege ettől a
        naptól számítva indul <strong>0 Ft</strong>-ról. A naptárban ennél korábbi{" "}
        <em>tervezett</em> tételek nem kerülnek a táblába, így a múlt hetek szerkesztése nem zavarja a
        cashflow-t. A lista a naptár <em>Tervezett bevétel</em> és <em>Költség</em> eseményeit
        tartalmazza ({CASHFLOW_EPOCH} és későbbi dátumok). Több projektnél az{" "}
        <strong>Összes egyenleg</strong> oszlop a számlák összege minden lépés után.
      </p>

      {raw.length === 0 && (
        <p className="font-sans text-sm text-black/55 py-1">
          Nincs tétel {CASHFLOW_EPOCH} után — csak a nyitó nullpont sor látható. Adj hozzá eseményeket a
          Naptárban (ezen a napon vagy későbbi dátummal).
        </p>
      )}

      {projectIds.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-outline bg-white shadow-m3-1">
          <table className="w-full min-w-[640px] text-left font-sans text-sm">
            <thead>
              <tr className="border-b border-outline bg-surface-variant">
                <th className="px-3 py-2.5 font-semibold text-black/80">Dátum</th>
                {showAccountColumn && (
                  <th className="px-3 py-2.5 font-semibold text-black/80">Számla (projekt)</th>
                )}
                <th className="px-3 py-2.5 font-semibold text-black/80">Megnevezés</th>
                <th className="px-3 py-2.5 font-semibold text-emerald-800 text-right whitespace-nowrap">
                  Tervezett bevétel
                </th>
                <th className="px-3 py-2.5 font-semibold text-orange-900 text-right whitespace-nowrap">
                  Költség
                </th>
                <th className="px-3 py-2.5 font-semibold text-black/80 text-right whitespace-nowrap">
                  Egyenleg (számla)
                </th>
                {showAccountColumn && (
                  <th className="px-3 py-2.5 font-semibold text-black/80 text-right whitespace-nowrap">
                    Összes egyenleg
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r) => {
                const isOpening = r.id === OPENING_ROW_ID;
                return (
                  <tr
                    key={r.id}
                    className={`border-b border-outline/80 ${
                      isOpening ? "bg-surface-variant/70" : "hover:bg-surface-variant/50"
                    }`}
                  >
                    <td className="px-3 py-2 text-black whitespace-nowrap">{r.event_date}</td>
                    {showAccountColumn && (
                      <td
                        className="px-3 py-2 text-black/90 max-w-[10rem] truncate"
                        title={isOpening ? undefined : projectNameById[r.project_id]}
                      >
                        {isOpening ? (
                          <span className="text-black/50">—</span>
                        ) : (
                          projectNameById[r.project_id] ?? r.project_id.slice(0, 8) + "…"
                        )}
                      </td>
                    )}
                    <td className="px-3 py-2 text-black max-w-[14rem] truncate" title={r.title}>
                      {r.title}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-800">
                      {isOpening ? "—" : r.income > 0 ? formatMoney(r.income) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-orange-900">
                      {isOpening ? "—" : r.expense > 0 ? formatMoney(r.expense) : "—"}
                    </td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums font-medium ${
                        r.accountBalance < 0 ? "text-red-700" : "text-black"
                      }`}
                    >
                      {formatMoney(r.accountBalance)}
                    </td>
                    {showAccountColumn && (
                      <td
                        className={`px-3 py-2 text-right tabular-nums font-medium ${
                          r.totalBalance < 0 ? "text-red-700" : "text-black"
                        }`}
                      >
                        {formatMoney(r.totalBalance)}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            {tableRows.length > 0 && (
              <tfoot>
                {showAccountColumn ? (
                  <>
                    {footerProjectIds.map((pid) => (
                      <tr key={pid} className="bg-surface-variant border-t border-outline/80">
                        <td colSpan={5} className="px-3 py-2 pl-5 text-black/80 text-xs sm:text-sm">
                          Számla záró:{" "}
                          <span className="font-medium text-black">
                            {projectNameById[pid] ?? pid.slice(0, 8) + "…"}
                          </span>
                        </td>
                        <td
                          className={`px-3 py-2 text-right tabular-nums font-medium ${
                            (closingByProject.get(pid) ?? 0) < 0 ? "text-red-700" : "text-black"
                          }`}
                        >
                          {formatMoney(closingByProject.get(pid) ?? 0)}
                        </td>
                        <td className="px-3 py-2 text-right text-black/35">—</td>
                      </tr>
                    ))}
                    <tr className="bg-surface-variant border-t-2 border-outline font-semibold">
                      <td colSpan={5} className="px-3 py-3 text-black">
                        Összesített záró egyenleg
                      </td>
                      <td className="px-3 py-3 text-right text-black/40">—</td>
                      <td
                        className={`px-3 py-3 text-right tabular-nums ${
                          closingTotal < 0 ? "text-red-700" : "text-black"
                        }`}
                      >
                        {formatMoney(closingTotal)}
                      </td>
                    </tr>
                  </>
                ) : (
                  <tr className="bg-surface-variant border-t-2 border-outline">
                    <td colSpan={2} className="px-3 py-3 font-semibold text-black">
                      Záró egyenleg (tervezett)
                    </td>
                    <td colSpan={2} className="px-3 py-3" />
                    <td
                      className={`px-3 py-3 text-right tabular-nums font-semibold ${
                        closingTotal < 0 ? "text-red-700" : "text-black"
                      }`}
                    >
                      {formatMoney(closingTotal)}
                    </td>
                  </tr>
                )}
              </tfoot>
            )}
          </table>
        </div>
      )}

    </div>
  );
}
