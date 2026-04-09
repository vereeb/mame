"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatHufAmount } from "@/lib/formatHuf";
import { useOwnerProjectPageAccess } from "@/hooks/useOwnerProjectPageAccess";
import { useEffectiveProjectScope } from "@/hooks/useEffectiveProjectScope";

export type CalendarEventType =
  | "planned_expense"
  | "planned_income"
  | "deadline"
  | "general";

type CalendarEventRow = {
  id: string;
  project_id: string;
  event_type: CalendarEventType;
  title: string;
  description: string | null;
  event_date: string;
  amount: number | null;
  /** Ha kitöltött: az Embernapok (Munkanapló) táblázatból szinkronizált tétel. */
  embernapok_sync_key: string | null;
};

const EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  planned_expense: "Kiadás",
  planned_income: "Bevétel",
  deadline: "Határidő",
  general: "Általános",
};

const EVENT_TYPE_STYLES: Record<CalendarEventType, string> = {
  planned_expense: "bg-red-100 text-red-900 border-red-200",
  planned_income: "bg-green-100 text-green-900 border-green-200",
  deadline: "bg-purple-100 text-purple-900 border-purple-200",
  general: "bg-blue-100 text-blue-900 border-blue-200",
};

/** DB may still return legacy `reminder` before migration 024 is applied. */
function normalizeCalendarEventType(raw: string): CalendarEventType {
  if (raw === "reminder") return "general";
  const allowed: CalendarEventType[] = [
    "planned_expense",
    "planned_income",
    "deadline",
    "general",
  ];
  if (allowed.includes(raw as CalendarEventType)) return raw as CalendarEventType;
  return "general";
}

/** Formatted amount for calendar list preview (planned expense / income only). */
function formatEventAmountPreview(ev: CalendarEventRow): string | null {
  if (ev.event_type !== "planned_expense" && ev.event_type !== "planned_income") {
    return null;
  }
  if (ev.amount == null) return null;
  const n = Number(ev.amount);
  if (!Number.isFinite(n)) return null;
  return formatHufAmount(n);
}

function eventPreviewMainLine(ev: CalendarEventRow, projectName: string | undefined): string {
  const displayTitle = ev.title?.trim() || EVENT_TYPE_LABELS[ev.event_type];
  return projectName ? `${projectName} · ${displayTitle}` : displayTitle;
}

function eventPreviewHoverTitle(ev: CalendarEventRow, projectName: string | undefined): string {
  const head = projectName ? `${projectName} · ` : "";
  const label = `${EVENT_TYPE_LABELS[ev.event_type]}: ${ev.title?.trim() || EVENT_TYPE_LABELS[ev.event_type]}`;
  const amt = formatEventAmountPreview(ev);
  const ember = ev.embernapok_sync_key ? " · Embernapok" : "";
  return `${head}${label}${amt != null ? ` · ${amt}` : ""}${ember} — megnyitás`;
}

function isEmbernapokSyncedEvent(ev: CalendarEventRow): boolean {
  return Boolean(ev.embernapok_sync_key);
}

const WEEKDAY_NAMES_HU = [
  "Hétfő",
  "Kedd",
  "Szerda",
  "Csütörtök",
  "Péntek",
  "Szombat",
  "Vasárnap",
];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Monday 00:00 local for the week containing `d`. */
function getMonday(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const offset = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - offset);
  return x;
}

function getWeekDates(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const cell = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    return cell;
  });
}

const MONTH_NAMES_HU = [
  "január",
  "február",
  "március",
  "április",
  "május",
  "június",
  "július",
  "augusztus",
  "szeptember",
  "október",
  "november",
  "december",
];

/** e.g. "24. – 30. március 2026." or cross-month */
function formatWeekRangeLabel(monday: Date, sunday: Date): string {
  const y = monday.getFullYear();
  const y2 = sunday.getFullYear();
  const m1 = MONTH_NAMES_HU[monday.getMonth()];
  const m2 = MONTH_NAMES_HU[sunday.getMonth()];
  const d1 = monday.getDate();
  const d2 = sunday.getDate();
  if (monday.getMonth() === sunday.getMonth() && y === y2) {
    return `${d1}. – ${d2}. ${m1} ${y}.`;
  }
  const left = `${d1}. ${m1}${y !== y2 ? ` ${y}` : ""}`;
  const right = `${d2}. ${m2} ${y2}.`;
  return `${left} – ${right}`;
}

export default function CalendarPage() {
  const scope = useEffectiveProjectScope();
  const { allowed, error: accessError } = useOwnerProjectPageAccess();
  const canCreateEvents = scope.kind === "single";
  /** Monday of the visible week (local date). */
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [events, setEvents] = useState<CalendarEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [viewingEvent, setViewingEvent] = useState<CalendarEventRow | null>(null);
  const [eventDetailEditing, setEventDetailEditing] = useState(false);
  const [formType, setFormType] = useState<CalendarEventType>("general");
  const [formTitle, setFormTitle] = useState("");
  const [formDate, setFormDate] = useState(toISODate(new Date()));
  const [formDescription, setFormDescription] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const weekSunday = weekDates[6];
  const weekRangeLabel = useMemo(
    () => formatWeekRangeLabel(weekStart, weekSunday),
    [weekStart, weekSunday],
  );

  const rangeStart = toISODate(weekDates[0]);
  const rangeEnd = toISODate(weekDates[6]);

  const fetchEvents = useCallback(async () => {
    if (scope.kind === "none") {
      setEvents([]);
      setLoading(false);
      return;
    }
    if (scope.kind === "loading_all") {
      setLoading(true);
      return;
    }
    const ids = scope.kind === "all" ? scope.ids : [scope.id];
    if (ids.length === 0) {
      setEvents([]);
      setLoading(false);
      return;
    }
    if (allowed !== true) {
      if (allowed === false) {
        setEvents([]);
        setLoading(false);
      }
      return;
    }
    const supabase = createClient();
    if (!supabase) {
      setError("A Supabase nincs beállítva");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let q = supabase
        .from("calendar_events")
        .select(
          "id, project_id, event_type, title, description, event_date, amount, embernapok_sync_key",
        )
        .gte("event_date", rangeStart)
        .lte("event_date", rangeEnd);
      q = ids.length === 1 ? q.eq("project_id", ids[0]) : q.in("project_id", ids);
      const { data, error: qErr } = await q.order("event_date", { ascending: true });
      if (qErr) throw qErr;
      setEvents(
        (data ?? []).map((row) => {
          const r = row as CalendarEventRow;
          return {
            ...r,
            embernapok_sync_key: r.embernapok_sync_key ?? null,
            event_type: normalizeCalendarEventType(String(r.event_type)),
          };
        }),
      );
    } catch (e: any) {
      setError(e?.message ?? "Naptár betöltése sikertelen");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [scope, allowed, rangeStart, rangeEnd]);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  const eventsByDate = useMemo(() => {
    const m = new Map<string, CalendarEventRow[]>();
    for (const ev of events) {
      const list = m.get(ev.event_date) ?? [];
      list.push(ev);
      m.set(ev.event_date, list);
    }
    return m;
  }, [events]);

  function openAddModal(prefillDate?: string) {
    if (!canCreateEvents) return;
    setViewingEvent(null);
    setFormType("general");
    setFormTitle("");
    setFormDescription("");
    setFormAmount("");
    setFormDate(prefillDate ?? toISODate(new Date()));
    setModalOpen(true);
  }

  function openEventDetail(ev: CalendarEventRow) {
    setModalOpen(false);
    setEventDetailEditing(false);
    setViewingEvent(ev);
  }

  function closeEventDetail() {
    setEventDetailEditing(false);
    setViewingEvent(null);
  }

  function startEditingFromView() {
    if (!viewingEvent || isEmbernapokSyncedEvent(viewingEvent)) return;
    setFormType(viewingEvent.event_type);
    setFormTitle(viewingEvent.title);
    setFormDescription(viewingEvent.description ?? "");
    setFormDate(viewingEvent.event_date);
    setFormAmount(viewingEvent.amount != null ? String(viewingEvent.amount) : "");
    setEventDetailEditing(true);
  }

  function cancelEventEdit() {
    setEventDetailEditing(false);
  }

  async function saveEvent() {
    if (scope.kind !== "single" || !formTitle.trim()) return;
    const supabase = createClient();
    if (!supabase) return;
    setSaving(true);
    setError(null);
    try {
      const amount =
        formType === "planned_expense" || formType === "planned_income"
          ? Number(formAmount || 0)
          : null;
      const { error: insErr } = await supabase.from("calendar_events").insert({
        project_id: scope.id,
        event_type: formType,
        title: formTitle.trim(),
        description: formDescription.trim() || null,
        event_date: formDate,
        amount: Number.isFinite(amount as number) ? amount : null,
      });
      if (insErr) throw insErr;
      setModalOpen(false);
      await fetchEvents();
    } catch (e: any) {
      setError(e?.message ?? "Mentés sikertelen");
    } finally {
      setSaving(false);
    }
  }

  async function saveEventUpdate() {
    if (!viewingEvent || !formTitle.trim()) return;
    const supabase = createClient();
    if (!supabase) return;
    setSaving(true);
    setError(null);
    try {
      const amount =
        formType === "planned_expense" || formType === "planned_income"
          ? Number(formAmount || 0)
          : null;
      const { data, error: upErr } = await supabase
        .from("calendar_events")
        .update({
          event_type: formType,
          title: formTitle.trim(),
          description: formDescription.trim() || null,
          event_date: formDate,
          amount: Number.isFinite(amount as number) ? amount : null,
        })
        .eq("id", viewingEvent.id)
        .select(
          "id, project_id, event_type, title, description, event_date, amount, embernapok_sync_key",
        )
        .single();
      if (upErr) throw upErr;
      setViewingEvent(data as CalendarEventRow);
      setEventDetailEditing(false);
      await fetchEvents();
    } catch (e: any) {
      setError(e?.message ?? "Mentés sikertelen");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvent(id: string) {
    if (!window.confirm("Törlöd ezt az eseményt?")) return;
    const supabase = createClient();
    if (!supabase) return;
    setDeletingId(id);
    setError(null);
    try {
      const { error: delErr } = await supabase.from("calendar_events").delete().eq("id", id);
      if (delErr) throw delErr;
      setViewingEvent((cur) => (cur?.id === id ? null : cur));
      await fetchEvents();
    } catch (e: any) {
      setError(e?.message ?? "Törlés sikertelen");
    } finally {
      setDeletingId(null);
    }
  }

  if (scope.kind === "none") {
    return (
      <div className="p-4 md:p-6 flex flex-col items-center justify-center min-h-[40vh] text-center">
        <p className="font-serif text-lg text-black/70">
          Válassz egy projektet vagy az „Összes projekt” nézetet a naptárhoz.
        </p>
      </div>
    );
  }

  if (scope.kind === "loading_all") {
    return (
      <div className="p-4 md:p-6 flex flex-col items-center justify-center min-h-[40vh] text-center">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <p className="font-serif text-lg text-black/70">Projektek betöltése…</p>
      </div>
    );
  }

  if (allowed === null) {
    return (
      <div className="p-4 md:p-6">
        <h2 className="font-serif text-xl font-semibold text-black mb-4">Naptár</h2>
        <p className="text-sm text-black/70">Betöltés...</p>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="p-4 md:p-6">
        <h2 className="font-serif text-xl font-semibold text-black mb-2">Naptár</h2>
        <p className="text-sm text-black/70 mb-4">
          Csak a projekt Owner jogosultságával férhetsz hozzá.
        </p>
        {accessError && <p className="text-sm text-red-600">{accessError}</p>}
      </div>
    );
  }

  const projectNameById: Record<string, string> =
    scope.kind === "all"
      ? Object.fromEntries(scope.projects.map((p) => [p.id, p.name]))
      : {};

  return (
    <div className="p-4 md:p-6 pb-28 md:pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="font-serif text-xl font-semibold text-black">Naptár</h2>
          <p className="text-sm text-black/70 mt-1">
            Kiadás, bevétel, határidő és általános események dátum szerint. Az Embernapokban beosztott
            munkások napi bére automatikusan megjelenik tervezett kiadásként a megfelelő napon és projekten.
            {scope.kind === "all" && (
              <span className="block mt-1 text-black/60">
                Összesített nézet: az események a projektjeik szerint vannak jelölve. Új eseményhez válassz
                egy konkrét projektet.
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() =>
              setWeekStart(
                new Date(
                  weekStart.getFullYear(),
                  weekStart.getMonth(),
                  weekStart.getDate() - 7,
                ),
              )
            }
            className="h-10 px-3 rounded-lg border border-outline font-sans text-sm font-medium text-black hover:bg-surface-variant"
            aria-label="Előző hét"
          >
            ←
          </button>
          <span className="font-serif text-base sm:text-lg font-semibold text-black min-w-[12rem] sm:min-w-[16rem] text-center leading-snug px-1">
            {weekRangeLabel}
          </span>
          <button
            type="button"
            onClick={() =>
              setWeekStart(
                new Date(
                  weekStart.getFullYear(),
                  weekStart.getMonth(),
                  weekStart.getDate() + 7,
                ),
              )
            }
            className="h-10 px-3 rounded-lg border border-outline font-sans text-sm font-medium text-black hover:bg-surface-variant"
            aria-label="Következő hét"
          >
            →
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(getMonday(new Date()))}
            className="h-10 px-3 rounded-lg border border-outline font-sans text-sm font-medium text-black hover:bg-surface-variant"
          >
            Ma
          </button>
          <button
            type="button"
            onClick={() => openAddModal(toISODate(new Date()))}
            disabled={!canCreateEvents}
            title={
              canCreateEvents
                ? "Új esemény"
                : "Új eseményhez válassz egy konkrét projektet a fejlécben"
            }
            className="h-10 px-4 rounded-lg bg-primary text-black font-sans text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Esemény
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 font-sans text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="md:rounded-xl md:border md:border-outline md:bg-white md:shadow-m3-1 md:overflow-hidden">
            {/* Mobile: one card per day */}
            <div className="flex flex-col gap-3 md:hidden">
              {weekDates.map((d, i) => {
                const iso = toISODate(d);
                const dayEvents = eventsByDate.get(iso) ?? [];
                const isToday = iso === toISODate(new Date());
                return (
                  <div
                    key={iso}
                    className="rounded-xl border border-outline bg-white shadow-m3-1 overflow-hidden"
                  >
                    <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-outline bg-surface-variant">
                      <div>
                        <p className="font-sans text-xs font-semibold text-black/60">
                          {WEEKDAY_NAMES_HU[i]}
                        </p>
                        <p className="font-serif text-xl font-semibold text-black">
                          <span className={isToday ? "text-primary" : ""}>{d.getDate()}.</span>{" "}
                          <span className="text-base font-normal text-black/70 capitalize">
                            {MONTH_NAMES_HU[d.getMonth()]}
                          </span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openAddModal(iso)}
                        title={
                          canCreateEvents
                            ? "Új esemény ezen a napon"
                            : "Új eseményhez válassz egy konkrét projektet"
                        }
                        className={`shrink-0 h-9 px-3 rounded-lg font-sans text-sm font-medium ${
                          canCreateEvents
                            ? "bg-primary text-black hover:opacity-90"
                            : "bg-black/5 text-black/40 cursor-default"
                        }`}
                      >
                        +
                      </button>
                    </div>
                    <div className="p-3 min-h-[4rem] space-y-2">
                      {dayEvents.length === 0 ? (
                        <p className="font-sans text-sm text-black/45">Nincs esemény</p>
                      ) : (
                        dayEvents.map((ev) => {
                          const pName =
                            scope.kind === "all" ? projectNameById[ev.project_id] : undefined;
                          const main = eventPreviewMainLine(ev, pName);
                          const amountStr = formatEventAmountPreview(ev);
                          return (
                            <button
                              key={ev.id}
                              type="button"
                              onClick={() => openEventDetail(ev)}
                              title={eventPreviewHoverTitle(ev, pName)}
                              className={`flex w-full flex-col items-stretch gap-0.5 rounded-lg border px-2.5 py-2 text-left font-sans text-sm leading-snug ${EVENT_TYPE_STYLES[ev.event_type]}`}
                            >
                              <span className="flex flex-wrap items-center gap-1 min-w-0">
                                {isEmbernapokSyncedEvent(ev) && (
                                  <span className="shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-black/10 text-black/80">
                                    Embernapok
                                  </span>
                                )}
                                <span className="line-clamp-2">{main}</span>
                              </span>
                              {amountStr != null && (
                                <span className="font-semibold tabular-nums">{amountStr}</span>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop: 7 columns, tall cells, full event list */}
            <div className="hidden md:block">
              <div className="grid grid-cols-7 border-b border-outline bg-surface-variant">
                {weekDates.map((d, i) => {
                  const iso = toISODate(d);
                  const isToday = iso === toISODate(new Date());
                  return (
                    <div
                      key={`h-${iso}`}
                      className="py-3 px-2 text-center border-r border-outline last:border-r-0"
                    >
                      <div className="font-sans text-xs font-semibold text-black/60">
                        {WEEKDAY_NAMES_HU[i]}
                      </div>
                      <button
                        type="button"
                        onClick={() => openAddModal(iso)}
                        title={
                          canCreateEvents
                            ? "Új esemény ezen a napon"
                            : "Új eseményhez válassz egy konkrét projektet"
                        }
                        className={`mt-1 inline-flex min-h-[2.25rem] min-w-[2.25rem] items-center justify-center rounded-full font-serif text-xl font-semibold ${
                          isToday
                            ? "bg-primary text-black ring-2 ring-primary/40"
                            : "text-black hover:bg-black/5"
                        } ${canCreateEvents ? "" : "cursor-default opacity-80"}`}
                      >
                        {d.getDate()}
                      </button>
                      <div className="font-sans text-[10px] text-black/50 capitalize mt-0.5">
                        {MONTH_NAMES_HU[d.getMonth()]}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-7 min-h-[20rem]">
                {weekDates.map((d) => {
                  const iso = toISODate(d);
                  const dayEvents = eventsByDate.get(iso) ?? [];
                  return (
                    <div
                      key={`c-${iso}`}
                      className="border-r border-outline last:border-r-0 bg-white p-2 flex flex-col"
                    >
                      <div className="flex-1 space-y-1.5 overflow-y-auto min-h-0 max-h-[min(70vh,32rem)] pr-0.5">
                        {dayEvents.length === 0 ? (
                          <p className="font-sans text-xs text-black/40 px-1 py-2">—</p>
                        ) : (
                          dayEvents.map((ev) => {
                            const pName =
                              scope.kind === "all" ? projectNameById[ev.project_id] : undefined;
                            const main = eventPreviewMainLine(ev, pName);
                            const amountStr = formatEventAmountPreview(ev);
                            return (
                              <button
                                key={ev.id}
                                type="button"
                                onClick={() => openEventDetail(ev)}
                                title={eventPreviewHoverTitle(ev, pName)}
                                className={`flex w-full flex-col items-stretch gap-0.5 rounded-lg border px-2 py-1.5 text-left font-sans text-xs leading-snug ${EVENT_TYPE_STYLES[ev.event_type]}`}
                              >
                                <span className="flex flex-wrap items-start gap-1 min-w-0">
                                  {isEmbernapokSyncedEvent(ev) && (
                                    <span className="shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide bg-black/10 text-black/80">
                                      EN
                                    </span>
                                  )}
                                  <span className="line-clamp-3">{main}</span>
                                </span>
                                {amountStr != null && (
                                  <span className="font-semibold tabular-nums">{amountStr}</span>
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-outline bg-surface-variant p-4">
            <h3 className="font-serif text-sm font-semibold text-black mb-3">Jelmagyarázat</h3>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(EVENT_TYPE_LABELS) as CalendarEventType[]).map((t) => (
                <span
                  key={t}
                  className={`inline-flex items-center rounded-full border px-3 py-1 font-sans text-xs ${EVENT_TYPE_STYLES[t]}`}
                >
                  {EVENT_TYPE_LABELS[t]}
                </span>
              ))}
            </div>
            <p className="mt-3 font-sans text-xs text-black/60">
              Esemény megnyitása: kattints a naptárban a színes címkére. Az Embernapokból jövő tételek a
              Munkanaplóban módosíthatók (beosztás és bérek).
            </p>
          </div>
        </>
      )}

      {viewingEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="calendar-view-modal-title"
          onClick={(e) => {
            if (e.target !== e.currentTarget) return;
            if (deletingId !== null || saving) return;
            if (eventDetailEditing) {
              cancelEventEdit();
              return;
            }
            closeEventDetail();
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-m3-2 border border-outline max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="calendar-view-modal-title"
              className="font-serif text-lg font-semibold text-black mb-1"
            >
              {eventDetailEditing ? "Esemény szerkesztése" : viewingEvent.title}
            </h3>
            {!eventDetailEditing && (
              <>
                <p
                  className={`inline-flex rounded-full border px-2.5 py-0.5 font-sans text-xs mb-4 ${EVENT_TYPE_STYLES[viewingEvent.event_type]}`}
                >
                  {EVENT_TYPE_LABELS[viewingEvent.event_type]}
                </p>
                {isEmbernapokSyncedEvent(viewingEvent) && (
                  <p className="mb-4 rounded-lg border border-outline bg-surface-variant px-3 py-2 font-sans text-xs text-black/80">
                    Ez a tétel az <strong className="font-semibold text-black">Embernapok</strong> beosztásból és a
                    munkavállalók napi béréből számolódik. A beosztást és a béreket a{" "}
                    <strong className="font-semibold text-black">Munkanapló</strong>ban módosíthatod.
                  </p>
                )}
                <dl className="space-y-3 font-sans text-sm">
                  <div>
                    <dt className="text-black/50 text-xs font-medium uppercase tracking-wide">Dátum</dt>
                    <dd className="text-black mt-0.5">{viewingEvent.event_date}</dd>
                  </div>
                  {scope.kind === "all" && projectNameById[viewingEvent.project_id] && (
                    <div>
                      <dt className="text-black/50 text-xs font-medium uppercase tracking-wide">Projekt</dt>
                      <dd className="text-black mt-0.5">{projectNameById[viewingEvent.project_id]}</dd>
                    </div>
                  )}
                  {(viewingEvent.event_type === "planned_expense" ||
                    viewingEvent.event_type === "planned_income") &&
                    viewingEvent.amount != null && (
                      <div>
                        <dt className="text-black/50 text-xs font-medium uppercase tracking-wide">Összeg</dt>
                        <dd className="text-black mt-0.5 tabular-nums">
                          {formatHufAmount(Number(viewingEvent.amount))}
                        </dd>
                      </div>
                    )}
                  {viewingEvent.description?.trim() && (
                    <div>
                      <dt className="text-black/50 text-xs font-medium uppercase tracking-wide">Megjegyzés</dt>
                      <dd className="text-black mt-0.5 whitespace-pre-wrap">{viewingEvent.description}</dd>
                    </div>
                  )}
                </dl>
              </>
            )}
            {eventDetailEditing && (
              <div className="space-y-3 mt-2">
                {scope.kind === "all" && projectNameById[viewingEvent.project_id] && (
                  <p className="font-sans text-xs text-black/60 pb-1">
                    Projekt: <span className="font-medium text-black">{projectNameById[viewingEvent.project_id]}</span>{" "}
                    (nem módosítható)
                  </p>
                )}
                <label className="block">
                  <span className="font-sans text-sm font-medium text-black">Típus</span>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as CalendarEventType)}
                    className="mt-1 w-full h-11 px-3 rounded-lg border border-outline bg-surface-variant font-sans text-sm text-black focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    {(Object.keys(EVENT_TYPE_LABELS) as CalendarEventType[]).map((t) => (
                      <option key={t} value={t}>
                        {EVENT_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="font-sans text-sm font-medium text-black">Cím</span>
                  <input
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="mt-1 w-full h-11 px-3 rounded-lg border border-outline bg-surface-variant font-sans text-sm text-black focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="Rövid megnevezés"
                  />
                </label>
                <label className="block">
                  <span className="font-sans text-sm font-medium text-black">Dátum</span>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="mt-1 w-full h-11 px-3 rounded-lg border border-outline bg-surface-variant font-sans text-sm text-black focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </label>
                {(formType === "planned_expense" || formType === "planned_income") && (
                  <label className="block">
                    <span className="font-sans text-sm font-medium text-black">Összeg (opcionális)</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                      className="mt-1 w-full h-11 px-3 rounded-lg border border-outline bg-surface-variant font-sans text-sm text-black focus:outline-none focus:ring-2 focus:ring-primary/50"
                      placeholder="0"
                    />
                  </label>
                )}
                <label className="block">
                  <span className="font-sans text-sm font-medium text-black">Megjegyzés (opcionális)</span>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    rows={3}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-outline bg-surface-variant font-sans text-sm text-black focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </label>
              </div>
            )}
            {!eventDetailEditing ? (
              <div className="flex flex-col gap-3 mt-6">
                <div
                  className={`flex flex-col-reverse sm:flex-row gap-3 ${isEmbernapokSyncedEvent(viewingEvent) ? "sm:justify-end" : ""}`}
                >
                  {!isEmbernapokSyncedEvent(viewingEvent) && (
                    <>
                      <button
                        type="button"
                        onClick={() => void deleteEvent(viewingEvent.id)}
                        disabled={deletingId !== null}
                        className="flex-1 h-11 rounded-lg font-sans text-sm font-medium text-red-700 border border-red-200 hover:bg-red-50 disabled:opacity-50"
                      >
                        {deletingId === viewingEvent.id ? "Törlés…" : "Törlés"}
                      </button>
                      <button
                        type="button"
                        onClick={startEditingFromView}
                        disabled={deletingId !== null}
                        className="flex-1 h-11 rounded-lg font-sans text-sm font-medium text-black border border-outline hover:bg-surface-variant disabled:opacity-50"
                      >
                        Szerkesztés
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={closeEventDetail}
                    disabled={deletingId !== null}
                    className={`h-11 rounded-lg font-sans text-sm font-medium bg-primary text-black hover:opacity-90 disabled:opacity-50 ${isEmbernapokSyncedEvent(viewingEvent) ? "w-full sm:w-auto sm:min-w-[10rem] px-6" : "flex-1"}`}
                  >
                    Bezárás
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => !saving && cancelEventEdit()}
                  disabled={saving}
                  className="flex-1 h-11 rounded-lg font-sans text-sm font-medium text-black/80 hover:bg-surface-variant disabled:opacity-50"
                >
                  Mégse
                </button>
                <button
                  type="button"
                  onClick={() => void saveEventUpdate()}
                  disabled={saving || !formTitle.trim()}
                  className="flex-1 h-11 rounded-lg font-sans text-sm font-medium bg-primary text-black disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                >
                  {saving ? "Mentés..." : "Mentés"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="calendar-modal-title"
          onClick={(e) => e.target === e.currentTarget && !saving && setModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-m3-2 border border-outline"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="calendar-modal-title" className="font-serif text-lg font-semibold text-black mb-4">
              Új esemény
            </h3>
            <div className="space-y-3">
              <label className="block">
                <span className="font-sans text-sm font-medium text-black">Típus</span>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as CalendarEventType)}
                  className="mt-1 w-full h-11 px-3 rounded-lg border border-outline bg-surface-variant font-sans text-sm text-black focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {(Object.keys(EVENT_TYPE_LABELS) as CalendarEventType[]).map((t) => (
                    <option key={t} value={t}>
                      {EVENT_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="font-sans text-sm font-medium text-black">Cím</span>
                <input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="mt-1 w-full h-11 px-3 rounded-lg border border-outline bg-surface-variant font-sans text-sm text-black focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Rövid megnevezés"
                />
              </label>
              <label className="block">
                <span className="font-sans text-sm font-medium text-black">Dátum</span>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="mt-1 w-full h-11 px-3 rounded-lg border border-outline bg-surface-variant font-sans text-sm text-black focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </label>
              {(formType === "planned_expense" || formType === "planned_income") && (
                <label className="block">
                  <span className="font-sans text-sm font-medium text-black">Összeg (opcionális)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="mt-1 w-full h-11 px-3 rounded-lg border border-outline bg-surface-variant font-sans text-sm text-black focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="0"
                  />
                </label>
              )}
              <label className="block">
                <span className="font-sans text-sm font-medium text-black">Megjegyzés (opcionális)</span>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={3}
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
                onClick={() => void saveEvent()}
                disabled={saving || !formTitle.trim()}
                className="flex-1 h-11 rounded-lg font-sans text-sm font-medium bg-primary text-black disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
              >
                {saving ? "Mentés..." : "Mentés"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
