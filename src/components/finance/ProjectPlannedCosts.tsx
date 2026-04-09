"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatHufAmount } from "@/lib/formatHuf";

type ExpenseRow = {
  id: string;
  title: string;
  event_date: string;
  amount: number | null;
};

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseAmount(v: number | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function ProjectPlannedCosts({ projectId }: { projectId: string | null }) {
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState(() => toISODate(new Date()));
  const [amountStr, setAmountStr] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchCosts = useCallback(async () => {
    if (!projectId) {
      setRows([]);
      return;
    }
    const supabase = createClient();
    if (!supabase) {
      setError("A Supabase nincs beállítva");
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from("calendar_events")
        .select("id, title, event_date, amount")
        .eq("project_id", projectId)
        .eq("event_type", "planned_expense")
        .order("event_date", { ascending: true })
        .order("title", { ascending: true });
      if (qErr) throw qErr;
      setRows((data ?? []) as ExpenseRow[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Költségek betöltése sikertelen");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchCosts();
  }, [fetchCosts]);

  const total = useMemo(
    () => rows.reduce((s, r) => s + parseAmount(r.amount), 0),
    [rows],
  );

  function openModal() {
    setTitle("");
    setEventDate(toISODate(new Date()));
    setAmountStr("");
    setDescription("");
    setModalOpen(true);
  }

  async function saveNew() {
    if (!projectId || !title.trim()) return;
    const supabase = createClient();
    if (!supabase) return;
    const amountNum = amountStr.trim() === "" ? null : Number(amountStr.replace(",", "."));
    const amount =
      amountNum != null && Number.isFinite(amountNum) ? amountNum : null;
    setSaving(true);
    setError(null);
    try {
      const { error: insErr } = await supabase.from("calendar_events").insert({
        project_id: projectId,
        event_type: "planned_expense",
        title: title.trim(),
        description: description.trim() || null,
        event_date: eventDate,
        amount,
      });
      if (insErr) throw insErr;
      setModalOpen(false);
      await fetchCosts();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Mentés sikertelen");
    } finally {
      setSaving(false);
    }
  }

  if (!projectId) {
    return (
      <p className="text-sm text-black/60 font-sans">
        Válassz egy konkrét projektet a fejlécben — a naptár „Tervezett kiadás” tételei itt jelennek meg, és
        itt adhatsz hozzá újakat.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-black/60 font-sans">
        A lista a naptárban rögzített <strong className="text-black/80">tervezett kiadásokat</strong>{" "}
        (Kiadás típus) tartalmazza ehhez a projekthez. Az összeg a naptárban megadott összegekből számolódik.
      </p>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700 font-sans text-sm">{error}</div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => openModal()}
          className="h-10 px-4 rounded-lg bg-primary text-black font-sans text-sm font-medium hover:opacity-90"
        >
          + Új költség
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 py-6 text-black/60 font-sans text-sm">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
          Betöltés…
        </div>
      ) : rows.length === 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-black/55 font-sans py-1">
            Még nincs tervezett kiadás ehhez a projekthez. Adj hozzá a gombbal, vagy a Naptárban.
          </p>
          <div className="rounded-xl border border-outline bg-white px-3 py-3 flex justify-between items-center font-sans text-sm">
            <span className="font-semibold text-black">Összesen</span>
            <span className="tabular-nums font-semibold text-red-900">{formatHufAmount(0)}</span>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-outline bg-white shadow-m3-1">
          <table className="w-full min-w-[280px] text-left font-sans text-sm">
            <thead>
              <tr className="border-b border-outline bg-surface-variant">
                <th className="px-3 py-2.5 font-semibold text-black/80 whitespace-nowrap">Dátum</th>
                <th className="px-3 py-2.5 font-semibold text-black/80">Megnevezés</th>
                <th className="px-3 py-2.5 font-semibold text-black/80 text-right whitespace-nowrap">
                  Összeg
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-outline/80 hover:bg-surface-variant/40">
                  <td className="px-3 py-2 text-black whitespace-nowrap tabular-nums">{r.event_date}</td>
                  <td className="px-3 py-2 text-black max-w-[min(100vw,20rem)] md:max-w-none">
                    <span className="line-clamp-2" title={r.title}>
                      {r.title}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-red-900 font-medium">
                    {r.amount != null && Number.isFinite(Number(r.amount))
                      ? formatHufAmount(Number(r.amount))
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-surface-variant border-t-2 border-outline">
                <td colSpan={2} className="px-3 py-3 font-semibold text-black">
                  Összesen
                </td>
                <td className="px-3 py-3 text-right tabular-nums font-semibold text-red-900">
                  {formatHufAmount(total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="planned-cost-modal-title"
          onClick={(e) => e.target === e.currentTarget && !saving && setModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-m3-2 border border-outline"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="planned-cost-modal-title"
              className="font-serif text-lg font-semibold text-black mb-1"
            >
              Új tervezett kiadás
            </h3>
            <p className="font-sans text-xs text-black/60 mb-4">
              Ugyanaz a tétel jelenik meg a Naptárban (Kiadás).
            </p>
            <div className="space-y-3">
              <label className="block">
                <span className="font-sans text-sm font-medium text-black">Megnevezés</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 w-full h-11 px-3 rounded-lg border border-outline bg-surface-variant font-sans text-sm text-black focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="pl. Anyag, alvállalkozó"
                />
              </label>
              <label className="block">
                <span className="font-sans text-sm font-medium text-black">Dátum</span>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="mt-1 w-full h-11 px-3 rounded-lg border border-outline bg-surface-variant font-sans text-sm text-black focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </label>
              <label className="block">
                <span className="font-sans text-sm font-medium text-black">Összeg (Ft, opcionális)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  className="mt-1 w-full h-11 px-3 rounded-lg border border-outline bg-surface-variant font-sans text-sm text-black focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="0"
                />
              </label>
              <label className="block">
                <span className="font-sans text-sm font-medium text-black">Megjegyzés (opcionális)</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-outline bg-surface-variant font-sans text-sm text-black focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => !saving && setModalOpen(false)}
                className="flex-1 h-11 rounded-lg font-sans text-sm font-medium text-black/80 hover:bg-surface-variant"
              >
                Mégse
              </button>
              <button
                type="button"
                onClick={() => void saveNew()}
                disabled={saving || !title.trim()}
                className="flex-1 h-11 rounded-lg font-sans text-sm font-medium bg-primary text-black disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
              >
                {saving ? "Mentés…" : "Mentés"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
