import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Download, Loader2, Plug, RefreshCw, Save, XCircle } from "lucide-react";
import { Card, CardHeader, EmptyState, ErrorState, Modal, PageHeader, Spinner, StatCard, PageBodySkeleton } from "@/components/ui";
import { useStore } from "@/lib/store";
import {
  collectEvidence,
  connectorKey,
  connectorLabel,
  loadConnectors,
  loadEvidenceSummary,
  saveConnectorConfig,
  type EvidenceConnector,
} from "@/lib/complianceGrc";
import { cx } from "@/lib/utils";
import DocLink from "@/components/DocLink";

// ── Evidence connectors ──────────────────────────────────────────────────────
// Connectors pull control evidence automatically. Readiness comes from
// GET /compliance/connectors; configuration is stored per connector (secrets
// encrypted server-side where the backend can), and a collection run writes
// results into the org's security DB.

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function ComplianceConnectors() {
  const { toast } = useStore();
  const [connectors, setConnectors] = useState<EvidenceConnector[]>([]);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collecting, setCollecting] = useState(false);
  const [editing, setEditing] = useState<EvidenceConnector | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, s] = await Promise.all([
        loadConnectors(),
        // The summary is a nice-to-have — a failure here must not blank the page.
        loadEvidenceSummary().catch(() => null),
      ]);
      setConnectors(Array.isArray(c.connectors) ? c.connectors : []);
      setSummary(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load evidence connectors.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runCollection = async (only?: string) => {
    setCollecting(true);
    try {
      const res = await collectEvidence(only ? [only] : undefined);
      const stored = num(res.stored ?? res.count ?? res.items_stored);
      toast("success", "Evidence collected", stored ? `${stored} item(s) stored.` : "Collection finished.");
      await load();
    } catch (e) {
      toast("error", "Collection failed", e instanceof Error ? e.message : undefined);
    } finally {
      setCollecting(false);
    }
  };

  const ready = connectors.filter((c) => c.ready ?? c.configured).length;

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Evidence connectors"
        description="Automated control evidence. Configure a connector once and each collection run stores fresh evidence against the controls it covers."
        actions={<>
            <DocLink docId="howto-app-24" label="Compliance review how-to" />
          <div className="flex items-center gap-2">
            <button onClick={() => void runCollection()} disabled={collecting} className="btn-primary text-xs !py-2">
              {collecting ? <Loader2 size={13} className="mr-1.5 inline animate-spin" /> : <Download size={13} className="mr-1.5 inline" />}
              Collect now
            </button>
            <button onClick={() => void load()} className="btn-ghost text-xs !py-2" title="Refresh">
              <RefreshCw size={13} className={cx("inline", loading && "animate-spin")} />
            </button>
          </div>
        </>}
      />

      {loading && !connectors.length ? (
        <PageBodySkeleton stats={4} variant="section" rows={5} />
      ) : error ? (
        <ErrorState title="Connectors unavailable" body={error} onRetry={() => void load()} />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Connectors" value={String(connectors.length)} hint="available adapters" />
            <StatCard label="Ready" value={String(ready)} hint="configured and usable" />
            <StatCard label="Evidence items" value={String(num(summary?.total ?? summary?.total_evidence))} hint="stored in security DB" />
            <StatCard label="Controls covered" value={String(num(summary?.controls ?? summary?.controls_covered))} hint="with at least one item" />
          </div>

          <Card>
            <CardHeader title="Connectors" subtitle="Configure, then collect" />
            {!connectors.length ? (
              <EmptyState icon={<Plug size={22} />} title="No connectors registered" body="The compliance engine has no evidence adapters available for this deployment." />
            ) : (
              <div className="space-y-2">
                {connectors.map((c) => {
                  const key = connectorKey(c);
                  const isReady = Boolean(c.ready ?? c.configured);
                  return (
                    <div key={key} className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-phantix-700 bg-phantix-900/60 p-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-200">{connectorLabel(c)}</span>
                          <span className={cx("chip", isReady ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400" : "border-phantix-700 text-slate-500")}>
                            {isReady ? <CheckCircle2 size={10} className="mr-1 inline" /> : <XCircle size={10} className="mr-1 inline" />}
                            {isReady ? "Ready" : "Not configured"}
                          </span>
                        </div>
                        {c.description && <p className="mt-1 text-xs leading-5 text-slate-400">{String(c.description)}</p>}
                        <p className="mt-1 font-mono text-[11px] text-slate-600">{key}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button onClick={() => setEditing(c)} className="btn-ghost text-xs !py-1.5">Configure</button>
                        <button
                          onClick={() => void runCollection(key)}
                          disabled={collecting || !isReady}
                          className="btn-secondary text-xs !py-1.5 disabled:opacity-40"
                        >
                          Collect
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {editing && (
        <ConnectorConfigModal
          connector={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void load(); }}
        />
      )}
    </div>
  );
}

function ConnectorConfigModal({
  connector,
  onClose,
  onSaved,
}: {
  connector: EvidenceConnector;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useStore();
  const key = connectorKey(connector);
  const [raw, setRaw] = useState("{\n  \n}");
  const [saving, setSaving] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const save = async () => {
    let config: Record<string, unknown>;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setParseError("Configuration must be a JSON object.");
        return;
      }
      config = parsed as Record<string, unknown>;
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Invalid JSON.");
      return;
    }
    setParseError(null);
    setSaving(true);
    try {
      await saveConnectorConfig(key, config);
      toast("success", "Configuration saved", `${connectorLabel(connector)} is ready to collect.`);
      onSaved();
    } catch (e) {
      toast("error", "Could not save configuration", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Configure ${connectorLabel(connector)}`} wide>
      <div className="space-y-4">
        <p className="text-sm leading-6 text-slate-400">
          Connector settings are stored per organization. Secrets are encrypted server-side where the
          deployment supports it — do not paste credentials you cannot rotate.
        </p>
        <div>
          <label className="label" htmlFor="connector-config">Configuration (JSON)</label>
          <textarea
            id="connector-config"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            spellCheck={false}
            className="input mt-1 min-h-[200px] resize-y font-mono !text-xs"
          />
          {parseError && <p className="mt-2 text-xs text-severity-critical">{parseError}</p>}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost text-xs !py-2">Cancel</button>
          <button onClick={() => void save()} disabled={saving} className="btn-primary text-xs !py-2">
            {saving ? <Loader2 size={13} className="mr-1.5 inline animate-spin" /> : <Save size={13} className="mr-1.5 inline" />}
            Save configuration
          </button>
        </div>
      </div>
    </Modal>
  );
}
