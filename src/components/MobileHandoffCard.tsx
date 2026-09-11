import React, { useEffect, useState } from "react";
import { Loader2, Send, Smartphone, ShieldCheck, AlertTriangle } from "lucide-react";
import { Card, CardHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { cx } from "@/lib/utils";

// ── Mobile endpoints → authorized scope (W6 NS-08) ───────────────────────────
// Hands discovered mobile endpoints to authorized W4 reassessment. The backend
// always returns requires_authorization=true and never starts scans — this card
// only submits the proposal.

export default function MobileHandoffCard() {
  const { toast } = useStore();
  const [projects, setProjects] = useState<{ id: number; name?: string }[]>([]);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    void api
      .get<any>("/context/projects")
      .then((r) => {
        const items = Array.isArray(r) ? r : (r?.items ?? []);
        setProjects(items);
        setProjectId((prev) => prev ?? items[0]?.id ?? null);
      })
      .catch(() => undefined);
  }, []);

  const handoff = async () => {
    let parsed: Record<string, unknown> = {};
    try {
      parsed = analysis.trim() ? JSON.parse(analysis) : {};
    } catch {
      toast("error", "Analysis must be valid JSON");
      return;
    }
    setBusy(true);
    try {
      const res = await api.post<any>("/mobile/handoff", {
        analysis: parsed,
        project_id: projectId ?? undefined,
      });
      setResult(res);
      toast(
        "success",
        "Handoff proposed",
        "Returned a scope proposal requiring authorization — no scans were started.",
      );
    } catch (e: any) {
      toast("error", "Handoff failed", e?.message || "");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Mobile endpoints → authorized scope"
        subtitle="Hand off discovered mobile API endpoints to W4 reassessment (never auto-scans)"
        action={<Smartphone size={16} className="text-gold-300" />}
      />
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Product project</label>
            <select className="input" value={projectId ?? ""} onChange={(e) => setProjectId(Number(e.target.value) || null)}>
              <option value="">(none)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name || `Project #${p.id}`}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Mobile analysis (JSON)</label>
          <textarea
            className="input !min-h-[110px] font-mono !text-xs"
            placeholder='{ "endpoints": ["https://api.example.com/…"], "findings": [ … ] }'
            value={analysis}
            onChange={(e) => setAnalysis(e.target.value)}
          />
          <p className="mt-1 text-[11px] text-slate-500">
            From a static APK/AAB/IPA analysis. Only endpoints that are in an authorized scope can be reassessed.
          </p>
        </div>

        {result && (
          <div
            className={cx(
              "rounded-md border p-3 text-xs leading-5",
              result.requires_authorization
                ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
                : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
            )}
          >
            <p className="flex items-center gap-1.5">
              <AlertTriangle size={12} /> {result.requires_authorization ? "Requires authorization — parked for an authorizer." : "Proposal created."}
            </p>
            {result.hosts?.length ? (
              <p className="mt-1 font-mono text-[10px] text-slate-400">{result.hosts.slice(0, 8).join(", ")}</p>
            ) : null}
            {result.message && <p className="mt-1 text-slate-400">{result.message}</p>}
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-1 text-[11px] text-slate-500">
            <ShieldCheck size={12} /> No scan starts without authorization.
          </p>
          <button className="btn-primary text-xs" disabled={busy} onClick={() => void handoff()}>
            {busy ? <Loader2 size={13} className="mr-1.5 inline animate-spin" /> : <Send size={13} className="mr-1.5 inline" />}
            Hand off to scope
          </button>
        </div>
      </div>
    </Card>
  );
}
