import React from "react";
import { Monitor, Download, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { PageHeader, Card, CardHeader, PageSkeleton, ErrorState, EmptyState, StatusBadge } from "@sg/ui";
import { loadAgentFleet, loadSocAgentInstall, downloadSocAgent } from "@sg/data";
import { useResource } from "@sg/useResource";
import { timeAgo, cx } from "@sg/utils";
import type { SocAgentFleet, SocAgentInstallCatalog } from "@sg/types";
import DocLink from "@sg/components/DocLink";

export default function SocAgentManager() {
  const { data: fleet, loading: fl } = useResource<SocAgentFleet | null>(() => loadAgentFleet(), null, "agent-fleet");
  const { data: install, loading: il } = useResource<SocAgentInstallCatalog | null>(() => loadSocAgentInstall(), null, "agent-install");

  if (fl) return <PageSkeleton variant="list" rows={4} />;

  return (
    <div>
      <PageHeader
        title="Agents"
        description="Unified SecureGraph agent fleet: register, monitor, and deploy log-shipping agents."
       actions={<DocLink docId="howto-app-25" label="SOC operations how-to" />} />

      {fleet && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="!p-4">
            <div className="flex items-center gap-2">
              <Wifi size={14} className="text-emerald-400" />
              <p className="text-2xl font-semibold text-emerald-400">{fleet.active}</p>
            </div>
            <p className="text-xs text-slate-400">Active agents</p>
          </Card>
          <Card className="!p-4">
            <div className="flex items-center gap-2">
              <RefreshCw size={14} className="text-gold-400" />
              <p className="text-2xl font-semibold text-gold-400">{fleet.stale}</p>
            </div>
            <p className="text-xs text-slate-400">Stale</p>
          </Card>
          <Card className="!p-4">
            <div className="flex items-center gap-2">
              <WifiOff size={14} className="text-slate-500" />
              <p className="text-2xl font-semibold text-slate-500">{fleet.offline}</p>
            </div>
            <p className="text-xs text-slate-400">Offline</p>
          </Card>
        </div>
      )}

      {(fleet?.agents?.length ?? 0) === 0 ? (
        <EmptyState icon={<Monitor size={24} />} title="No agents" body="No SecureGraph agents have registered yet." />
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-phantix-700/40">
                  <th className="th">Hostname</th>
                  <th className="th">Version</th>
                  <th className="th">Agent ID</th>
                  <th className="th">Status</th>
                  <th className="th">Last heartbeat</th>
                </tr>
              </thead>
              <tbody>
                {fleet?.agents?.map((agent) => (
                  <tr key={agent.agent_id} className="border-b border-phantix-800/40 hover:bg-phantix-800/35">
                    <td className="td">
                      <div className="flex items-center gap-2">
                        <Monitor size={14} className="text-slate-400 shrink-0" />
                        <span className="font-medium text-slate-200">{agent.hostname}</span>
                      </div>
                    </td>
                    <td className="td text-xs text-slate-400">v{agent.version}</td>
                    <td className="td font-mono text-xs text-slate-500">{agent.agent_id.slice(0, 12)}</td>
                    <td className="td"><StatusBadge status={agent.status} /></td>
                    <td className="td text-xs text-slate-500">{agent.last_heartbeat ? timeAgo(agent.last_heartbeat) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {install && (
        <div className="mt-6">
          <Card className="!p-4">
            <CardHeader title="Agent installation" subtitle="Deploy the SecureGraph agent to start log-shipping." />
            <div className="mt-4 space-y-3">
              {(install.channels ?? []).map((ch) => (
                <div key={ch.id} className="flex items-center justify-between rounded-md border border-phantix-700 bg-phantix-950/50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-200">{ch.title}</p>
                    {ch.commands?.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {ch.commands.map((cmd, i) => (
                          <code key={i} className="block font-mono text-[13px] text-slate-400">{cmd}</code>
                        ))}
                      </div>
                    )}
                  </div>
                  {ch.download && (
                    <button
                      className="btn-secondary !px-3 !py-1.5 !text-xs"
                      onClick={() => { void downloadSocAgent(ch.os); }}
                    >
                      <Download size={12} /> Download
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}