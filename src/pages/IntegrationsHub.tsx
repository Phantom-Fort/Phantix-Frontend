import React, { useState } from "react";
import { motion } from "framer-motion";
import { Cable, Plug, PlugZap, Key, Shield, TestTube, Trash2, RefreshCw, ExternalLink, Webhook, Bot, MessageSquare, Send, ChevronRight } from "lucide-react";
import { PageHeader, Card, CardHeader, Tabs, Spinner, PageSkeleton, ErrorState, EmptyState, StatusBadge, Modal } from "@/components/ui";
import { useResource } from "@/lib/useResource";
import { useStore } from "@/lib/store";
import { loadHubCatalog, loadHubInstallations, installHubIntegration, uninstallHubIntegration, testHubInstallation, rotateHubSecret } from "@/lib/data";
import { timeAgo, cx } from "@/lib/utils";
import type { IntegrationConnector, IntegrationInstallation } from "@/lib/types";

const connectorIcons: Record<string, React.ReactNode> = {
  slack: <MessageSquare size={16} />,
  teams: <Send size={16} />,
  whatsapp: <MessageSquare size={16} />,
  telegram: <Send size={16} />,
  webhook: <Webhook size={16} />,
  entra_oidc: <Shield size={16} />,
  okta_oidc: <Shield size={16} />,
  google_oidc: <Shield size={16} />,
  scim: <Key size={16} />,
};

export default function IntegrationsHub() {
  const [tab, setTab] = useState("catalog");
  const [showInstall, setShowInstall] = useState<string | null>(null);
  const { toast, requireDualControl } = useStore();

  const { data: catalog, loading: cl } = useResource<IntegrationConnector[]>(() => loadHubCatalog(), [], "hub-catalog");
  const { data: installations, loading: dil, reload } = useResource<IntegrationInstallation[]>(() => loadHubInstallations(), [], "hub-installations");

  if (cl || dil) return <PageSkeleton variant="list" rows={6} actions />;

  const activeInstallations = installations.filter((i) => i.status === "active");
  const pendingAuth = installations.filter((i) => i.status === "pending_auth");

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Integrations Hub"
        description="Connect your tools and services: alert channels, SSO providers, webhooks, and SCIM provisioning."
      />

      <Tabs
        tabs={[
          { id: "catalog", label: "Connector catalog", count: catalog.length },
          { id: "installed", label: "Installed", count: activeInstallations.length },
          { id: "pending", label: "Pending auth", count: pendingAuth.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "catalog" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {catalog.length === 0 ? (
            <EmptyState icon={<Cable size={32} />} title="No connectors" body="The integration catalog is loading or empty." />
          ) : catalog.map((conn, i) => (
            <motion.div key={conn.connector_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <div className="cursor-pointer" onClick={() => setShowInstall(conn.connector_id)}>
              <Card hover className="!p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md border border-gold-400/30 bg-gold-400/10 text-gold-300">
                    {connectorIcons[conn.connector_id] || <Plug size={15} />}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-200">{conn.name}</p>
                    <p className="text-xs text-slate-400">{conn.description}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {conn.auth_modes.map((mode) => (
                        <span key={mode} className="rounded-md bg-phantix-800 px-2 py-0.5 text-[10px] text-slate-400">{mode}</span>
                      ))}
                      <StatusBadge status={conn.status} />
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-slate-500 mt-1" />
                </div>
              </Card>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {tab === "installed" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-3">
          {activeInstallations.length === 0 ? (
            <EmptyState icon={<PlugZap size={32} />} title="No integrations installed" body="Browse the catalog and install a connector to get started." />
          ) : activeInstallations.map((inst, i) => (
            <motion.div
              key={inst.installation_id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Card className="!p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md border border-emerald-400/30 bg-emerald-400/10 text-emerald-400">
                    {connectorIcons[inst.connector_id] || <PlugZap size={15} />}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-200">{inst.label}</p>
                    <p className="text-xs text-slate-500">{inst.connector_id} &middot; {inst.auth_mode}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="btn-ghost !px-2 !py-1 !text-xs" onClick={() => { void testHubInstallation(inst.installation_id); toast("info", "Test sent", "Integration health check completed."); }}>
                      <TestTube size={12} /> Test
                    </button>
                    <button
                      className="btn-ghost !px-2 !py-1 !text-xs"
                      onClick={() => { void rotateHubSecret(inst.installation_id); toast("success", "Secret rotated", "New secret generated."); }}
                    >
                      <RefreshCw size={12} /> Rotate
                    </button>
                    <button
                      className="btn-ghost !px-2 !py-1 !text-xs text-severity-critical"
                      onClick={async () => {
                        if (!(await requireDualControl("Uninstall requires dual-control."))) return;
                        await uninstallHubIntegration(inst.installation_id);
                        reload();
                        toast("success", "Uninstalled", `${inst.label} disconnected.`);
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                {inst.last_test_at && (
                  <p className="mt-2 text-[11px] text-slate-500">Last test: {inst.last_test_ok ? "OK" : "Failed"} &middot; {timeAgo(inst.last_test_at)}</p>
                )}
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {tab === "pending" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-3">
          {pendingAuth.length === 0 ? (
            <EmptyState icon={<Key size={32} />} title="No pending authorizations" body="Installations awaiting OAuth completion will appear here." />
          ) : pendingAuth.map((inst, i) => (
            <motion.div key={inst.installation_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card className="!p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md border border-gold-400/30 bg-gold-400/10 text-gold-300">
                    {connectorIcons[inst.connector_id] || <Key size={15} />}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-200">{inst.label}</p>
                    <p className="text-xs text-slate-500">Awaiting OAuth authorization</p>
                  </div>
                  <span className="chip border-gold-400/30 bg-gold-400/10 text-gold-300">Pending auth</span>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {showInstall && (
        <InstallModal
          connectorId={showInstall}
          catalog={catalog}
          onClose={() => setShowInstall(null)}
          onInstalled={() => { setShowInstall(null); reload(); }}
        />
      )}
    </div>
  );
}

function InstallModal({ connectorId, catalog, onClose, onInstalled }: { connectorId: string; catalog: IntegrationConnector[]; onClose: () => void; onInstalled: () => void }) {
  const [label, setLabel] = useState("");
  const [secrets, setSecrets] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useStore();

  const connector = catalog.find((c) => c.connector_id === connectorId);
  if (!connector) return null;

  const handleInstall = async () => {
    if (!label.trim()) return;
    setLoading(true);
    const body: Record<string, unknown> = {
      connector_id: connectorId,
      auth_mode: connector.auth_modes[0] || "oauth2",
      label: label.trim(),
    };
    if (secrets.trim()) {
      body.secrets = { webhook_url: secrets.trim() };
    }
    await installHubIntegration(body);
    toast("success", "Installed", `${connector.name} installed successfully.`);
    onInstalled();
  };

  return (
    <Modal open={true} onClose={onClose} title={connector.name}>
      <div className="space-y-4">
        <p className="text-xs text-slate-400">{connector.description}</p>
        <input className="input" placeholder="Label (e.g. Production Slack)" value={label} onChange={(e) => setLabel(e.target.value)} />
        {connector.auth_modes.includes("copy_webhook") && (
          <textarea
            className="input !min-h-[80px]"
            placeholder="Webhook URL (for Teams / custom webhook)"
            value={secrets}
            onChange={(e) => setSecrets(e.target.value)}
          />
        )}
        <div className="flex gap-3 justify-end">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!label.trim() || loading} onClick={handleInstall}>
            {loading ? "Installing..." : "Install"}
          </button>
        </div>
      </div>
    </Modal>
  );
}