import React, { useCallback, useEffect, useState } from "react";
import { Brain, Database, Info, Loader2, ShieldCheck } from "lucide-react";
import { Card, CardHeader, ErrorState, PageHeader, Spinner, SettingsSkeleton } from "@/components/ui";
import { useStore } from "@/lib/store";
import { AI_THRESHOLDS, loadVaptSettings, saveVaptSettings, type VaptSettings as Settings } from "@/lib/vaptOps";
import { cx } from "@/lib/utils";
import DocLink from "@/components/DocLink";

// ── VAPT engine settings ─────────────────────────────────────────────────────
// Two org-level switches: whether your engagement data may feed correlation-rule
// mining, and how severe a finding has to be before the AI planner is consulted.
// Both are consent decisions, so each one states plainly what it turns on.

const THRESHOLD_COPY: Record<string, string> = {
  off: "Never consult the AI planner. Procedures run exactly as written.",
  critical: "Only for critical findings — the narrowest AI involvement.",
  high: "Critical and high findings.",
  medium: "Critical, high and medium findings.",
  low: "Almost everything except informational noise.",
  always: "Consult the AI planner on every finding.",
};

export default function VaptSettings() {
  const { toast, withOperate } = useStore();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSettings(await loadVaptSettings());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load VAPT settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = async (
    field: string,
    body: { mining_consent_enabled?: boolean; ai_threshold?: string },
    reason: string,
  ) => {
    setSaving(field);
    try {
      const next = await withOperate(reason, () => saveVaptSettings(body));
      if (next) {
        setSettings(next);
        toast("success", "Settings updated");
      }
    } catch (e) {
      toast("error", "Could not update settings", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(null);
    }
  };

  const mining = Boolean(settings?.mining_consent_enabled);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="VAPT settings"
        description="How the testing engine behaves for your organization — data-mining consent and the severity floor at which the AI planner gets involved."
       actions={<DocLink docId="howto-app-23" label="VAPT scheduling how-to" />} />

      {loading && !settings ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <SettingsSkeleton groups={1} rows={4} />
          <SettingsSkeleton groups={1} rows={3} />
        </div>
      ) : error ? (
        <ErrorState title="Settings unavailable" body={error} onRetry={() => void load()} />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="Correlation-rule mining"
              subtitle="Let your engagement data improve detection rules"
              action={<Database size={15} className="text-emerald-400" />}
            />
            <p className="text-sm leading-6 text-slate-400">
              With consent on, patterns from your campaigns can be mined into candidate correlation
              rules. Candidates always go through human review before they become active rules —
              nothing is applied automatically.
            </p>

            <button
              onClick={() =>
                void patch(
                  "mining",
                  { mining_consent_enabled: !mining },
                  mining
                    ? "Withdrawing mining consent requires an operate session."
                    : "Granting mining consent requires an operate session.",
                )
              }
              disabled={saving === "mining"}
              className={cx(
                "mt-4 flex w-full items-center justify-between gap-3 rounded-md border p-3 text-left transition-colors",
                mining ? "border-emerald-400/40 bg-emerald-400/10" : "border-phantix-700 bg-phantix-900/60 hover:border-phantix-600",
              )}
            >
              <span className="min-w-0">
                <span className={cx("block text-sm font-medium", mining ? "text-emerald-300" : "text-slate-300")}>
                  {mining ? "Consent granted" : "Consent not granted"}
                </span>
                <span className="block text-[11px] text-slate-500">
                  {settings?.mining_consent_granted_at
                    ? `Since ${new Date(settings.mining_consent_granted_at).toLocaleDateString()}`
                    : "Tap to change"}
                </span>
              </span>
              {saving === "mining"
                ? <Loader2 size={15} className="shrink-0 animate-spin text-slate-400" />
                : <ShieldCheck size={15} className={cx("shrink-0", mining ? "text-emerald-400" : "text-slate-600")} />}
            </button>

            {settings?.mining_data_scope && (
              <p className="mt-3 flex items-start gap-2 rounded-md border border-phantix-700 bg-phantix-900/60 p-3 text-[11px] leading-5 text-slate-400">
                <Info size={12} className="mt-0.5 shrink-0 text-gold-400" />
                Data scope: <span className="font-mono text-slate-300">{settings.mining_data_scope}</span>
              </p>
            )}
          </Card>

          <Card>
            <CardHeader
              title="AI planner threshold"
              subtitle="When the engine may consult the AI planner"
              action={<Brain size={15} className="text-gold-400" />}
            />
            <p className="text-sm leading-6 text-slate-400">
              The floor at which a finding is escalated to AI-assisted planning. Lower thresholds
              mean more AI involvement and more spend.
            </p>
            <div className="mt-4 space-y-1.5">
              {AI_THRESHOLDS.map((t) => {
                const active = settings?.ai_threshold === t;
                return (
                  <button
                    key={t}
                    onClick={() =>
                      void patch("threshold", { ai_threshold: t }, "Changing the AI planner threshold requires an operate session.")
                    }
                    disabled={saving === "threshold"}
                    className={cx(
                      "flex w-full items-center justify-between gap-3 rounded-md border p-2.5 text-left transition-colors",
                      active ? "border-gold-400/40 bg-gold-400/10" : "border-phantix-700 bg-phantix-900/60 hover:border-phantix-600",
                    )}
                  >
                    <span className="min-w-0">
                      <span className={cx("block text-sm capitalize", active ? "text-gold-200" : "text-slate-300")}>{t}</span>
                      <span className="block text-[11px] leading-4 text-slate-500">{THRESHOLD_COPY[t]}</span>
                    </span>
                    {active && saving === "threshold" && <Loader2 size={13} className="shrink-0 animate-spin text-gold-300" />}
                  </button>
                );
              })}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
