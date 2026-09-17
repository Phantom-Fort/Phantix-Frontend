import React, { useState } from "react";
import { Cloud, Plus, Trash2, RefreshCw } from "lucide-react";
import { PageHeader, Card, CardHeader, PageSkeleton, ErrorState, EmptyState, StatusBadge, Modal } from "@sg/ui";
import { loadCloudProviderCatalog, loadCloudConnections, connectCloudProvider, deleteCloudConnection, syncCloudConnection } from "@sg/data";
import { useResource } from "@sg/useResource";
import { useStore } from "@sg/store";
import { timeAgo, cx, humanize } from "@sg/utils";
import type { SocCloudConnection, SocCloudProviderCatalog } from "@sg/types";
import DocLink from "@sg/components/DocLink";

export default function SocCloudIntegration() {
  const { toast } = useStore();
  const [showConnect, setShowConnect] = useState(false);
  const { data: catalog, loading: cl } = useResource<SocCloudProviderCatalog | null>(() => loadCloudProviderCatalog(), null, "cloud-catalog");
  const { data: connections, loading: dl, reload } = useResource<SocCloudConnection[]>(() => loadCloudConnections(), [], "cloud-connections");

  if (cl || dl) return <PageSkeleton variant="list" rows={4} />;

  return (
    <div>
      <PageHeader
        title="Cloud Integrations"
        description="Connect cloud providers for log ingestion, event monitoring, and security posture visibility."
        actions={<>
            <DocLink docId="howto-app-25" label="SOC operations how-to" />
          <button className="btn-primary" onClick={() => setShowConnect(true)}>
            <Plus size={15} /> Connect provider
          </button>
        </>}
      />

      {connections.length === 0 ? (
        <EmptyState icon={<Cloud size={32} />} title="No cloud connections" body="Connect your AWS, Azure, or GCP account to start ingesting security events." />
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-phantix-700/40">
                  <th className="th">Connection</th>
                  <th className="th">Provider</th>
                  <th className="th">Type</th>
                  <th className="th">Status</th>
                  <th className="th">Actions</th>
                </tr>
              </thead>
              <tbody>
                {connections.map((conn) => (
                  <tr key={conn.id} className="border-b border-phantix-800/40 hover:bg-phantix-800/35">
                    <td className="td">
                      <div className="flex items-center gap-2">
                        <Cloud size={14} className="text-gold-400 shrink-0" />
                        <span className="font-medium text-slate-200">{conn.display_name}</span>
                      </div>
                    </td>
                    <td className="td text-xs text-slate-400">{humanize(conn.provider)}</td>
                    <td className="td text-xs text-slate-400">{humanize(conn.integration_type)}</td>
                    <td className="td"><StatusBadge status={conn.status} /></td>
                    <td className="td">
                      <div className="flex gap-1.5">
                        <button className="btn-ghost !px-2 !py-1 !text-xs" onClick={() => { void syncCloudConnection(conn.id); toast("info", "Sync started", "Cloud connection sync initiated."); }}>
                          <RefreshCw size={12} /> Sync
                        </button>
                        <button className="btn-ghost !px-2 !py-1 !text-xs text-severity-critical" onClick={() => { void deleteCloudConnection(conn.id); reload(); }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showConnect && (
        <ConnectModal catalog={catalog} onClose={() => setShowConnect(false)} onConnected={() => { setShowConnect(false); reload(); }} />
      )}
    </div>
  );
}

function ConnectModal({ catalog, onClose, onConnected }: { catalog: SocCloudProviderCatalog | null; onClose: () => void; onConnected: () => void }) {
  const [selected, setSelected] = useState("");
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useStore();

  const handleConnect = async () => {
    if (!selected || !label.trim()) return;
    setLoading(true);
    await connectCloudProvider({ provider: selected, integration_type: "log_ingestion", display_name: label.trim(), config: {} });
    toast("success", "Connected", `Cloud provider ${selected} connected.`);
    onConnected();
  };

  return (
    <Modal open={true} onClose={onClose} title="Connect cloud provider">
      <div className="space-y-4">
        <select className="input" value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Select provider...</option>
          {(catalog?.providers ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input className="input" placeholder="Display name" value={label} onChange={(e) => setLabel(e.target.value)} />
        <div className="flex gap-3 justify-end">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!selected || !label.trim() || loading} onClick={handleConnect}>
            {loading ? "Connecting..." : "Connect"}
          </button>
        </div>
      </div>
    </Modal>
  );
}