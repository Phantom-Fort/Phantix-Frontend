import React, { useState } from "react";
import { motion } from "framer-motion";
import { Cable, PlugZap, Key, TestTube, Trash2, RefreshCw, ChevronRight, Search, X } from "lucide-react";
import { PageHeader, Card, Tabs, PageSkeleton, EmptyState, Modal } from "@sg/ui";
import { Pagination } from "@sg/components/Pagination";
import { BrandIcon } from "@sg/components/BrandIcon";
import { useResource } from "@sg/useResource";
import { useStore } from "@sg/store";
import { isPendingApproval } from "@sg/api";
import { loadHubCatalog, loadHubInstallations, installHubIntegration, uninstallHubIntegration, testHubInstallation, rotateHubSecret } from "@sg/data";
import { timeAgo, cx, humanize } from "@sg/utils";
import type { IntegrationConnector, IntegrationInstallation, IntegrationCatalogPage } from "@sg/types";
import DocLink from "@sg/components/DocLink";

/** Statuses the backend can actually install today. */
const INSTALLABLE = new Set(["ga", "beta", "preview", "active"]);

function connectorStatusLabel(status?: string): string {
  switch (status) {
    case "ga":
    case "active":
      return "Available";
    case "beta":
      return "Beta";
    case "preview":
      return "Preview";
    case "planned":
      return "Coming soon";
    case "legacy_bridge":
      return "Legacy";
    default:
      return humanize(status || "unknown");
  }
}

function isInstallable(conn: IntegrationConnector): boolean {
  return INSTALLABLE.has(String(conn.status || "").toLowerCase());
}

export default function IntegrationsHub() {
  const [tab, setTab] = useState("catalog");
  const [showInstall, setShowInstall] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [category, setCategory] = useState("");
  const [qDraft, setQDraft] = useState("");
  const [q, setQ] = useState("");
  const { toast, requireDualControl } = useStore();

  const emptyPage: IntegrationCatalogPage = { items: [], total: 0, page: 1, page_size: pageSize, pages: 0 };
  const {
    data: catalog,
    loading: cl,
    reload: reloadCatalog,
  } = useResource<IntegrationCatalogPage>(
    () => loadHubCatalog({ page, pageSize, category: category || undefined, q: q || undefined }),
    emptyPage,
    `hub-catalog:${category}:${q}:${page}:${pageSize}`,
  );
  const { data: installations, loading: dil, reload } = useResource<IntegrationInstallation[]>(() => loadHubInstallations(), [], "hub-installations");

  if (cl || dil) return <PageSkeleton variant="list" rows={6} actions />;

  const connectors = catalog.items ?? [];
  const categories = catalog.categories ?? {};
  const activeInstallations = installations.filter((i) => i.status === "active");
  const pendingAuth = installations.filter((i) => i.status === "pending_auth");

  return (
    <div>
      <PageHeader
        title="Integrations Hub"
        description="Connect your tools and services: alert channels, SSO providers, source control, SIEM, cloud, webhooks and SCIM provisioning."
        actions={<DocLink docId="howto-app-27" label="Integrations how-to" />}
      />

      <Tabs
        tabs={[
          { id: "catalog", label: "Connector catalog", count: catalog.total },
          { id: "installed", label: "Installed", count: activeInstallations.length },
          { id: "pending", label: "Pending auth", count: pendingAuth.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "catalog" && (
        <>
          <div className="mt-4 flex flex-col gap-3">
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                setQ(qDraft.trim());
                setPage(1);
                reloadCatalog();
              }}
            >
              <div className="relative flex-1">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  className="input !pl-9"
                  placeholder={`Search ${catalog.total} integrations — Slack, Wazuh, AWS, GitLab…`}
                  value={qDraft}
                  onChange={(e) => setQDraft(e.target.value)}
                />
                {qDraft && (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    onClick={() => { setQDraft(""); setQ(""); setPage(1); reloadCatalog(); }}
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <button type="submit" className="btn-secondary">Search</button>
            </form>

            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => { setCategory(""); setPage(1); reloadCatalog(); }}
                className={cx("chip text-xs", !category && "border-gold-400/40 bg-gold-400/10 text-gold-200")}
              >
                All {catalog.total}
              </button>
              {Object.entries(categories).map(([key, count]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setCategory(key === category ? "" : key); setPage(1); reloadCatalog(); }}
                  className={cx("chip text-xs", category === key && "border-gold-400/40 bg-gold-400/10 text-gold-200")}
                >
                  {humanize(key)} {count}
                </button>
              ))}
            </div>
          </div>

          {connectors.length === 0 ? (
            <EmptyState icon={<Cable size={32} />} title="No connectors" body="No integration matches this filter." />
          ) : (
            <motion.div
              key={`${category}-${q}-${page}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
            >
              {connectors.map((conn, i) => {
                const installable = isInstallable(conn);
                return (
                  <motion.div key={conn.connector_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                    <div
                      className={cx(installable ? "cursor-pointer" : "cursor-default opacity-80")}
                      onClick={() => installable && setShowInstall(conn.connector_id)}
                    >
                      <Card hover={installable} className="!p-4">
                        <div className="flex items-start gap-3">
                          <span className={cx(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border",
                            installable
                              ? "border-gold-400/30 bg-gold-400/10 text-gold-300"
                              : "border-phantix-700/40 bg-phantix-800/40 text-slate-500",
                          )}>
                            <BrandIcon connectorId={conn.connector_id} iconHint={conn.icon} size={16} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-200">{conn.name || conn.display_name || conn.connector_id}</p>
                            <p className="line-clamp-2 text-xs text-slate-400">{conn.description}</p>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {(conn.auth_modes || []).slice(0, 3).map((mode) => (
                                <span key={mode} className="rounded-md bg-phantix-800 px-2 py-0.5 text-[12px] text-slate-400">{humanize(mode)}</span>
                              ))}
                              <span className={cx(
                                "rounded-md px-2 py-0.5 text-[12px]",
                                installable ? "bg-emerald-400/10 text-emerald-300" : "bg-phantix-800 text-slate-500",
                              )}>
                                {connectorStatusLabel(conn.status)}
                              </span>
                            </div>
                          </div>
                          {installable && <ChevronRight size={14} className="mt-1 shrink-0 text-slate-500" />}
                        </div>
                      </Card>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {catalog.total > 0 && (
            <Pagination
              totalItems={catalog.total}
              page={page}
              pageSize={pageSize}
              onPageChange={(p) => { setPage(p); reloadCatalog(); }}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); reloadCatalog(); }}
              className="mt-4 rounded-lg border border-phantix-800/40"
            />
          )}
        </>
      )}

      {tab === "installed" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
          {activeInstallations.length === 0 ? (
            <EmptyState icon={<PlugZap size={32} />} title="No integrations installed" body="Browse the catalog and install a connector to get started." />
          ) : (
            <Card className="!p-0 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-phantix-700/40">
                    <th className="th">Connector</th>
                    <th className="th">Label</th>
                    <th className="th">Auth mode</th>
                    <th className="th">Last test</th>
                    <th className="th">Status</th>
                    <th className="th">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeInstallations.map((inst, i) => (
                    <motion.tr
                      key={inst.installation_id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-phantix-800/40 hover:bg-phantix-800/35"
                    >
                      <td className="td">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-emerald-400/30 bg-emerald-400/10 text-emerald-400">
                            <BrandIcon connectorId={inst.connector_id} size={16} />
                          </span>
                          <span className="text-sm text-slate-300">{humanize(inst.connector_id)}</span>
                        </div>
                      </td>
                      <td className="td font-medium text-slate-200">{inst.label}</td>
                      <td className="td text-slate-400">{humanize(inst.auth_mode)}</td>
                      <td className="td text-slate-500">
                        {inst.last_test_at ? <>{inst.last_test_ok ? "OK" : "Failed"} &middot; {timeAgo(inst.last_test_at)}</> : "—"}
                      </td>
                      <td className="td">
                        <span className="chip border-emerald-400/30 bg-emerald-400/10 text-emerald-300 capitalize">{humanize(inst.status)}</span>
                      </td>
                      <td className="td">
                        <div className="flex items-center gap-2">
                          <button className="btn-ghost !px-2 !py-1 !text-xs" onClick={() => { void testHubInstallation(inst.installation_id); toast("info", "Test sent", "Integration health check completed."); }}>
                            <TestTube size={12} /> Test
                          </button>
                          <button
                            className="btn-ghost !px-2 !py-1 !text-xs"
                            onClick={async () => {
                              const res = await rotateHubSecret(inst.installation_id);
                              if (isPendingApproval(res)) toast("info", "Sent for approval", "Secret rotation is parked for an authorizer.");
                              else toast("success", "Secret rotated", "New secret generated.");
                            }}
                          >
                            <RefreshCw size={12} /> Rotate
                          </button>
                          <button
                            className="btn-ghost !px-2 !py-1 !text-xs text-severity-critical"
                            onClick={async () => {
                              if (!(await requireDualControl("Uninstall requires dual-control."))) return;
                              const res = await uninstallHubIntegration(inst.installation_id);
                              reload();
                              if (isPendingApproval(res)) toast("info", "Sent for approval", `${inst.label} disconnect is parked for an authorizer.`);
                              else toast("success", "Uninstalled", `${inst.label} disconnected.`);
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </motion.div>
      )}

      {tab === "pending" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
          {pendingAuth.length === 0 ? (
            <EmptyState icon={<Key size={32} />} title="No pending authorizations" body="Installations awaiting OAuth completion will appear here." />
          ) : (
            <Card className="!p-0 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-phantix-700/40">
                    <th className="th">Connector</th>
                    <th className="th">Label</th>
                    <th className="th">Auth mode</th>
                    <th className="th">Last test</th>
                    <th className="th">Status</th>
                    <th className="th">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingAuth.map((inst, i) => (
                    <motion.tr
                      key={inst.installation_id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-phantix-800/40 hover:bg-phantix-800/35"
                    >
                      <td className="td">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gold-400/30 bg-gold-400/10 text-gold-300">
                            <BrandIcon connectorId={inst.connector_id} size={16} />
                          </span>
                          <span className="text-sm text-slate-300">{humanize(inst.connector_id)}</span>
                        </div>
                      </td>
                      <td className="td font-medium text-slate-200">{inst.label}</td>
                      <td className="td text-slate-400">{humanize(inst.auth_mode)}</td>
                      <td className="td text-slate-500">
                        {inst.last_test_at ? <>{inst.last_test_ok ? "OK" : "Failed"} &middot; {timeAgo(inst.last_test_at)}</> : "—"}
                      </td>
                      <td className="td">
                        <span className="chip border-gold-400/30 bg-gold-400/10 text-gold-300">Pending auth</span>
                      </td>
                      <td className="td text-slate-600">Awaiting OAuth authorization</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </motion.div>
      )}

      {showInstall && (
        <InstallModal
          connectorId={showInstall}
          catalog={connectors}
          onClose={() => setShowInstall(null)}
          onInstalled={() => { setShowInstall(null); reload(); reloadCatalog(); }}
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
    const res = await installHubIntegration(body);
    if (isPendingApproval(res)) {
      toast("info", "Sent for approval", `${connector.name} install is parked for an authorizer — approve it from Authorizations to finish.`);
    } else {
      toast("success", "Installed", `${connector.name} installed successfully.`);
    }
    onInstalled();
  };

  return (
    <Modal open={true} onClose={onClose} title={connector.name || connector.connector_id}>
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
