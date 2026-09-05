import React, { useState } from "react";
import { motion } from "framer-motion";
import { Monitor, Download, Terminal, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { PageHeader, Card, CardHeader, Spinner, PageSkeleton, ErrorState, EmptyState, StatusBadge } from "@/components/ui";
import { loadAgentFleet, loadSocAgentInstall, downloadSocAgent } from "@/lib/data";
import { useResource } from "@/lib/useResource";
import { timeAgo, cx } from "@/lib/utils";
import type { SocAgentFleet, SocAgentInstallCatalog } from "@/lib/types";

export default function SocAgentManager() {
  const { data: fleet, loading: fl } = useResource<SocAgentFleet | null>(() => loadAgentFleet(), null, "agent-fleet");
  const { data: install, loading: il } = useResource<SocAgentInstallCatalog | null>(() => loadSocAgentInstall(), null, "agent-install");

  if (fl) return <PageSkeleton variant="list" rows={4} />;

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Agents"
        description="Unified Phantix agent fleet: register, monitor, and deploy log-shipping agents."
      />

      {fleet && (
        <div className="grid grid-cols-3 gap-3 mb-6">
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

      <div className="space-y-2">
        {fleet?.agents?.map((agent, i) => (
          <motion.div
            key={agent.agent_id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <Card className="!p-4">
              <div className="flex items-center gap-3">
                <Monitor size={16} className="text-slate-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-200">{agent.hostname}</p>
                  <p className="text-xs text-slate-500">v{agent.version} &middot; ID: {agent.agent_id.slice(0, 12)}</p>
                </div>
                <StatusBadge status={agent.status} />
                {agent.last_heartbeat && <span className="text-[11px] text-slate-500">{timeAgo(agent.last_heartbeat)}</span>}
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {install && (
        <div className="mt-6">
          <Card className="!p-4">
            <CardHeader title="Agent installation" subtitle="Deploy the Phantix agent to start log-shipping." />
            <div className="mt-4 space-y-3">
              {(install.channels ?? []).map((ch) => (
                <div key={ch.id} className="flex items-center justify-between rounded-md border border-phantix-700 bg-phantix-950/50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-200">{ch.title}</p>
                    {ch.commands?.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {ch.commands.map((cmd, i) => (
                          <code key={i} className="block font-mono text-[11px] text-slate-400">{cmd}</code>
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