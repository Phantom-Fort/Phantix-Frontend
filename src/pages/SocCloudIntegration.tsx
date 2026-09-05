import React, { useState } from "react";
import { motion } from "framer-motion";
import { Cloud, Plus, Trash2, RefreshCw, CheckCircle, XCircle, Cable } from "lucide-react";
import { PageHeader, Card, CardHeader, Spinner, PageSkeleton, ErrorState, EmptyState, StatusBadge, Modal } from "@/components/ui";
import { loadCloudProviderCatalog, loadCloudConnections, connectCloudProvider, deleteCloudConnection, syncCloudConnection } from "@/lib/data";
import { useResource } from "@/lib/useResource";
import { useStore } from "@/lib/store";
import { timeAgo, cx } from "@/lib/utils";
import type { SocCloudConnection, SocCloudProviderCatalog } from "@/lib/types";

export default function SocCloudIntegration() {
  const { toast } = useStore();
  const [showConnect, setShowConnect] = useState(false);
  const { data: catalog, loading: cl } = useResource<SocCloudProviderCatalog | null>(() => loadCloudProviderCatalog(), null, "cloud-catalog");
  const { data: connections, loading: dl, reload } = useResource<SocCloudConnection[]>(() => loadCloudConnections(), [], "cloud-connections");

  if (cl || dl) return <PageSkeleton variant="list" rows={4} />;

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Cloud Integrations"
        description="Connect cloud providers for log ingestion, event monitoring, and security posture visibility."
        actions={
          <button className="btn-primary" onClick={() => setShowConnect(true)}>
            <Plus size={15} /> Connect provider
          </button>
        }
      />

      <div className="space-y-3">
        {connections.length === 0 ? (
          <EmptyState icon={<Cloud size={32} />} title="No cloud connections" body="Connect your AWS, Azure, or GCP account to start ingesting security events." />
        ) : connections.map((conn, i) => (
          <motion.div
            key={conn.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <Card className="!p-4">
              <div className="flex items-center gap-3">
                <Cloud size={16} className="text-gold-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-200">{conn.display_name}</p>
                  <p className="text-xs text-slate-500">{conn.provider} &middot; {conn.integration_type}</p>
                </div>
                <StatusBadge status={conn.status} />
                <div className="flex gap-1.5">
                  <button className="btn-ghost !px-2 !py-1 !text-xs" onClick={() => { void syncCloudConnection(conn.id); toast("info", "Sync started", "Cloud connection sync initiated."); }}>
                    <RefreshCw size={12} /> Sync
                  </button>
                  <button className="btn-ghost !px-2 !py-1 !text-xs text-severity-critical" onClick={() => { void deleteCloudConnection(conn.id); reload(); }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

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