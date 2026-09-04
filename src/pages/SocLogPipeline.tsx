import React, { useState } from "react";
import { motion } from "framer-motion";
import { Logs, Search, Filter, BarChart3, Activity } from "lucide-react";
import { PageHeader, Card, CardHeader, Tabs, Spinner, PageSkeleton, ErrorState, EmptyState } from "@/components/ui";
import { searchSocLogs, loadLogPipelineStats } from "@/lib/data";
import { useResource } from "@/lib/useResource";
import { timeAgo, cx } from "@/lib/utils";
import type { SocLogEntry, SocLogSearchResponse, SocLogPipelineStats } from "@/lib/types";

export default function SocLogPipeline() {
  const [tab, setTab] = useState("search");
  const [query, setQuery] = useState("");
  const [host, setHost] = useState("");
  const [level, setLevel] = useState("");
  const [searched, setSearched] = useState<SocLogEntry[]>([]);

  const { data: stats, loading: sl } = useResource<SocLogPipelineStats | null>(() => loadLogPipelineStats(), null, "log-stats");

  const handleSearch = async () => {
    const result = await searchSocLogs({ q: query, host: host || undefined, level: level || undefined, limit: 100 });
    setSearched(result.items || []);
  };

  if (sl) return <PageSkeleton variant="list" rows={4} />;

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Log Pipeline"
        description="Search and monitor security log ingestion from deployed agents and cloud integrations."
      />

      <Tabs
        tabs={[
          { id: "search", label: "Log search" },
          { id: "stats", label: "Pipeline stats" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "search" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-3">
            <input className="input flex-1 min-w-[200px]" placeholder="Search logs..." value={query} onChange={(e) => setQuery(e.target.value)} />
            <select className="input w-32" value={host} onChange={(e) => setHost(e.target.value)}>
              <option value="">All hosts</option>
              <option value="web">web</option>
              <option value="db">db</option>
              <option value="app">app</option>
            </select>
            <select className="input w-28" value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">All levels</option>
              <option value="error">error</option>
              <option value="warn">warn</option>
              <option value="info">info</option>
              <option value="debug">debug</option>
            </select>
            <button className="btn-primary" onClick={handleSearch}>
              <Search size={14} /> Search
            </button>
          </div>

          <div className="space-y-1.5">
            {searched.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">Enter a query and press Search to find log entries.</p>
            ) : searched.map((entry, i) => (
              <motion.div
                key={`${entry.id}-${i}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className="flex items-start gap-3 rounded-md border border-phantix-700 bg-phantix-900 px-4 py-2.5"
              >
                <span className={cx("mt-1 h-2 w-2 shrink-0 rounded-full", entry.level === "error" ? "bg-severity-critical" : entry.level === "warn" ? "bg-severity-high" : "bg-slate-500")} />
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-xs text-slate-200 truncate">{entry.message}</p>
                  <p className="text-[10px] text-slate-500">
                    {entry.host} &middot; {entry.facility} &middot; {entry.timestamp ? timeAgo(entry.timestamp) : ""}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {tab === "stats" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-4">
          {stats && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Card className="!p-4">
                  <p className="text-2xl font-semibold text-white">{stats.total_24h}</p>
                  <p className="text-xs text-slate-400">Events (24h)</p>
                </Card>
                <Card className="!p-4">
                  <p className="text-2xl font-semibold text-severity-critical">{stats.error_pct}%</p>
                  <p className="text-xs text-slate-400">Error rate</p>
                </Card>
                <Card className="!p-4">
                  <p className="text-2xl font-semibold text-slate-200">{Object.keys(stats.by_host || {}).length}</p>
                  <p className="text-xs text-slate-400">Active hosts</p>
                </Card>
              </div>

              <Card className="!p-4">
                <CardHeader title="By level" />
                <div className="mt-3 space-y-2">
                  {Object.entries(stats.by_level || {}).map(([level, count]) => (
                    <div key={level} className="flex items-center gap-3">
                      <span className="w-16 text-xs text-slate-200">{level}</span>
                      <div className="flex-1 h-2 rounded-full bg-phantix-800">
                        <div className={cx("h-full rounded-full", level === "error" ? "bg-severity-critical" : level === "warn" ? "bg-severity-high" : "bg-gold-400")} style={{ width: `${Math.min(100, (count / stats.total_24h) * 100)}%` }} />
                      </div>
                      <span className="text-xs text-slate-400">{count}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="!p-4">
                <CardHeader title="Top hosts" />
                <div className="mt-3 space-y-2">
                  {Object.entries(stats.by_host || {})
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 10)
                    .map(([hostname, count]) => (
                      <div key={hostname} className="flex items-center justify-between text-xs">
                        <span className="text-slate-200">{hostname}</span>
                        <span className="text-slate-400">{count} events</span>
                      </div>
                    ))}
                </div>
              </Card>
            </>
          )}
        </motion.div>
      )}
    </div>
  );
}