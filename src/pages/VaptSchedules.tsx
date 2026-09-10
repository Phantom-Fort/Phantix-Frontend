import React, { useCallback, useEffect, useState } from "react";
import {
  CalendarClock, CalendarOff, CheckCircle2, Loader2, Moon, PauseCircle, Plus, RefreshCw, Timer,
} from "lucide-react";
import { Card, CardHeader, EmptyState, ErrorState, Modal, PageHeader, Spinner, StatCard, PageBodySkeleton } from "@/components/ui";
import { useStore } from "@/lib/store";
import {
  addBlackout, asArray, CRON_PRESETS, createSchedule, listProcedures, listSchedules,
  procedureKey, procedureName, WEEKDAYS,
  type VaptProcedure, type VaptSchedule,
} from "@/lib/vaptOps";
import { cx } from "@/lib/utils";

// ── Recurring VAPT schedules ─────────────────────────────────────────────────
// A schedule runs a procedure against a scope on a cadence. Blackout windows
// keep automated testing away from business-critical hours — the backend
// appends them one at a time, so the UI adds rather than replaces.

function when(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export default function VaptSchedules() {
  const [rows, setRows] = useState<VaptSchedule[]>([]);
  const [procedures, setProcedures] = useState<VaptProcedure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [blackoutFor, setBlackoutFor] = useState<VaptSchedule | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, p] = await Promise.all([
        listSchedules(),
        // The catalogue only feeds the create form — never block the list on it.
        listProcedures().catch(() => [] as VaptProcedure[]),
      ]);
      setRows(asArray(s));
      setProcedures(asArray(p));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load VAPT schedules.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const active = rows.filter((r) => r.is_active).length;
  const failures = rows.reduce((n, r) => n + (r.total_failures ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="VAPT schedules"
        description="Recurring authorized testing. Each schedule runs one procedure against a scope on a cadence, with blackout windows to keep it away from your busy hours."
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => setCreating(true)} className="btn-primary text-xs !py-2">
              <Plus size={13} className="mr-1.5 inline" /> New schedule
            </button>
            <button onClick={() => void load()} className="btn-ghost text-xs !py-2" title="Refresh">
              <RefreshCw size={13} className={cx("inline", loading && "animate-spin")} />
            </button>
          </div>
        }
      />

      {loading && !rows.length ? (
        <PageBodySkeleton stats={4} variant="list" rows={4} />
      ) : error ? (
        <ErrorState title="Schedules unavailable" body={error} onRetry={() => void load()} />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Schedules" value={String(rows.length)} icon={<CalendarClock size={18} />} hint={`${active} active`} />
            <StatCard label="Total runs" value={String(rows.reduce((n, r) => n + (r.total_runs ?? 0), 0))} icon={<Timer size={18} />} hint="across all schedules" />
            <StatCard label="Failures" value={String(failures)} icon={<PauseCircle size={18} />} hint="cumulative" />
            <StatCard
              label="Next run"
              value={rows.map((r) => r.next_run_at).filter(Boolean).sort()[0]?.slice(0, 10) ?? "—"}
              icon={<CalendarClock size={18} />}
              hint="soonest scheduled"
            />
          </div>

          {!rows.length ? (
            <Card>
              <EmptyState
                icon={<CalendarClock size={22} />}
                title="No schedules yet"
                body="Create one to run an authorized procedure on a recurring cadence instead of launching campaigns by hand."
                action={<button onClick={() => setCreating(true)} className="btn-primary text-xs !py-2"><Plus size={13} className="mr-1.5 inline" /> New schedule</button>}
              />
            </Card>
          ) : (
            <div className="space-y-3">
              {rows.map((s) => (
                <Card key={s.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-100">{s.schedule_name}</span>
                        <span className={cx("chip", s.is_active ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400" : "border-phantix-700 text-slate-500")}>
                          {s.is_active ? <CheckCircle2 size={10} className="mr-1 inline" /> : <PauseCircle size={10} className="mr-1 inline" />}
                          {s.is_active ? "Active" : "Paused"}
                        </span>
                        {s.skip_next && <span className="chip border-severity-medium/30 text-severity-medium">Skipping next</span>}
                      </div>
                      {s.description && <p className="mt-1 text-xs leading-5 text-slate-400">{s.description}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="chip border-phantix-700 font-mono text-phantix-300">{s.procedure_key}</span>
                        <span className="chip border-phantix-700 font-mono text-slate-400">{s.cron_expression}</span>
                        <span className="chip border-phantix-700 text-slate-400">{s.timezone}</span>
                        <span className="chip border-phantix-700 text-slate-400">max {s.max_concurrent_per_org} concurrent</span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] text-slate-500 sm:grid-cols-4">
                        <span>Last run <span className="text-slate-400">{when(s.last_run_at)}</span></span>
                        <span>Next run <span className="text-slate-400">{when(s.next_run_at)}</span></span>
                        <span>Runs <span className="text-slate-400">{s.total_runs}</span></span>
                        <span>Failures <span className={cx(s.total_failures ? "text-severity-high" : "text-slate-400")}>{s.total_failures}</span></span>
                      </div>
                      {s.blackout_windows?.length > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <Moon size={11} className="text-slate-500" />
                          {s.blackout_windows.map((w, i) => (
                            <span key={i} className="chip border-phantix-700 text-slate-400">
                              {w.start ?? "?"}–{w.end ?? "?"}{w.days?.length ? ` · ${w.days.join(",")}` : ""}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button onClick={() => setBlackoutFor(s)} className="btn-ghost shrink-0 text-xs !py-1.5">
                      <CalendarOff size={12} className="mr-1.5 inline" /> Blackout
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {creating && (
        <CreateScheduleModal
          procedures={procedures}
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); void load(); }}
        />
      )}

      {blackoutFor && (
        <BlackoutModal
          schedule={blackoutFor}
          onClose={() => setBlackoutFor(null)}
          onSaved={() => { setBlackoutFor(null); void load(); }}
        />
      )}
    </div>
  );
}

function CreateScheduleModal({
  procedures, onClose, onCreated,
}: {
  procedures: VaptProcedure[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast, withOperate: run } = useStore();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [procedure, setProcedure] = useState(procedures.length ? procedureKey(procedures[0]) : "");
  const [cron, setCron] = useState("7d");
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim() || !procedure.trim()) {
      toast("warning", "Name and procedure are required");
      return;
    }
    setSaving(true);
    try {
      const created = await run("Creating a recurring VAPT schedule requires an operate session.", () =>
        createSchedule({
          schedule_name: name.trim(),
          description: description.trim() || undefined,
          procedure_key: procedure.trim(),
          cron_expression: cron.trim() || "7d",
          timezone: timezone.trim() || "UTC",
        }),
      );
      if (created) {
        toast("success", "Schedule created", `${created.schedule_name} runs on ${created.cron_expression}.`);
        onCreated();
      }
    } catch (e) {
      toast("error", "Could not create the schedule", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="New VAPT schedule" wide>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="sch-name">Schedule name</label>
            <input id="sch-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Weekly external surface test" className="input mt-1" />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="sch-desc">Description (optional)</label>
            <input id="sch-desc" value={description} onChange={(e) => setDescription(e.target.value)} className="input mt-1" />
          </div>
          <div>
            <label className="label" htmlFor="sch-proc">Procedure</label>
            {procedures.length ? (
              <select id="sch-proc" value={procedure} onChange={(e) => setProcedure(e.target.value)} className="input mt-1">
                {procedures.map((p) => (
                  <option key={procedureKey(p)} value={procedureKey(p)}>{procedureName(p)}</option>
                ))}
              </select>
            ) : (
              <input id="sch-proc" value={procedure} onChange={(e) => setProcedure(e.target.value)} placeholder="procedure_key" className="input mt-1 font-mono" />
            )}
          </div>
          <div>
            <label className="label" htmlFor="sch-tz">Timezone</label>
            <input id="sch-tz" value={timezone} onChange={(e) => setTimezone(e.target.value)} className="input mt-1" />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="sch-cron">Cadence</label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {CRON_PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => setCron(p.value)}
                className={cx("chip transition-colors", cron === p.value ? "border-gold-400/40 bg-gold-400/10 text-gold-200" : "border-phantix-700 text-slate-400 hover:text-slate-200")}
              >
                {p.label}
              </button>
            ))}
          </div>
          <input id="sch-cron" value={cron} onChange={(e) => setCron(e.target.value)} className="input mt-2 font-mono !text-xs" />
          <p className="mt-1 text-[11px] text-slate-500">Simple interval (1d, 7d, 12h) or a 5-field cron expression.</p>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost text-xs !py-2">Cancel</button>
          <button onClick={() => void submit()} disabled={saving} className="btn-primary text-xs !py-2">
            {saving ? <Loader2 size={13} className="mr-1.5 inline animate-spin" /> : <Plus size={13} className="mr-1.5 inline" />}
            Create schedule
          </button>
        </div>
      </div>
    </Modal>
  );
}

function BlackoutModal({
  schedule, onClose, onSaved,
}: {
  schedule: VaptSchedule;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast, withOperate: run } = useStore();
  const [start, setStart] = useState("00:00");
  const [end, setEnd] = useState("06:00");
  const [days, setDays] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const toggle = (d: string) => setDays((v) => (v.includes(d) ? v.filter((x) => x !== d) : [...v, d]));

  const submit = async () => {
    setSaving(true);
    try {
      const updated = await run("Changing a testing blackout window requires an operate session.", () =>
        addBlackout(schedule.id, { start, end, days }),
      );
      if (updated) {
        toast("success", "Blackout added", `${start}–${end}${days.length ? ` on ${days.join(", ")}` : " every day"}.`);
        onSaved();
      }
    } catch (e) {
      toast("error", "Could not add the blackout", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Blackout window — ${schedule.schedule_name}`}>
      <div className="space-y-4">
        <p className="text-sm leading-6 text-slate-400">
          Automated runs are suppressed inside this window. Windows are appended, so existing ones stay in place.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="bo-start">Start</label>
            <input id="bo-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} className="input mt-1" />
          </div>
          <div>
            <label className="label" htmlFor="bo-end">End</label>
            <input id="bo-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="input mt-1" />
          </div>
        </div>
        <div>
          <p className="label">Days (leave empty for every day)</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {WEEKDAYS.map((d) => (
              <button
                key={d}
                onClick={() => toggle(d)}
                className={cx("chip uppercase transition-colors", days.includes(d) ? "border-gold-400/40 bg-gold-400/10 text-gold-200" : "border-phantix-700 text-slate-400 hover:text-slate-200")}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost text-xs !py-2">Cancel</button>
          <button onClick={() => void submit()} disabled={saving} className="btn-primary text-xs !py-2">
            {saving ? <Loader2 size={13} className="mr-1.5 inline animate-spin" /> : <CalendarOff size={13} className="mr-1.5 inline" />}
            Add blackout
          </button>
        </div>
      </div>
    </Modal>
  );
}
