import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Bot, MessageSquare, ShieldCheck, Sparkles } from "lucide-react";
import { PageHeader, Card, CardHeader, CardListSkeleton, EmptyState } from "../ui";
import { apiGet } from "../shell/api";
import { openAssistant } from "../components/AgentAssistant";
import { cx } from "../utils";
import type { ApplicationKey } from "../shell/types";

/**
 * Assistant — the SecureGraph Agent, and who is authorized to answer here.
 *
 * The agent mesh is scoped per application: Attack can invoke the pentest
 * agent, Defend the SOC / GRC / threat-intel / asset agents, Code the
 * threat-modelling one, and the Chief routes in all of them. This page is where
 * an operator sees that roster instead of guessing, with the agent that covers
 * the page they came from called out first.
 *
 * The roster and the page mapping both come from `GET /ai/agent/domains`, which
 * the backend filters by `X-Application` — so this page cannot offer an agent
 * the application may not invoke, or point at a page it does not have.
 */

interface AgentSurface {
  path: string;
  label: string;
}

interface DomainAgent {
  domain: string;
  agent_id: string;
  display_name: string;
  description?: string;
  primary_skills?: string[];
  surfaces?: AgentSurface[];
}

export default function Assistant({ application }: { application: ApplicationKey }) {
  const location = useLocation();
  const [agents, setAgents] = useState<DomainAgent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    apiGet<{ items: DomainAgent[] }>("/ai/agent/domains")
      .then((v) => alive && setAgents(v?.items || []))
      .catch((e: unknown) =>
        alive && setError(e instanceof Error ? e.message : "Could not load the agent roster"),
      )
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  // The page the operator came from, not this one.
  const from = useMemo(() => {
    const state = location.state as { from?: string } | null;
    return state?.from || "";
  }, [location.state]);

  const forThisPage = useMemo(() => {
    if (!agents || !from) return null;
    let best: DomainAgent | null = null;
    let bestLen = -1;
    for (const agent of agents) {
      for (const s of agent.surfaces || []) {
        if (from === s.path || from.startsWith(`${s.path}/`)) {
          if (s.path.length > bestLen) {
            bestLen = s.path.length;
            best = agent;
          }
        }
      }
    }
    return best;
  }, [agents, from]);

  const rest = (agents || []).filter((a) => a !== forThisPage);

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        title="Assistant"
        description="Ask about your security posture in plain language. Each application has its own specialists, and every answer is grounded in a real finding."
        actions={
          <button className="btn-primary !py-2" onClick={() => openAssistant("agent")}>
            <MessageSquare size={15} /> Ask the agent
          </button>
        }
      />

      {error && <p className="mb-5 text-sm text-severity-critical">{error}</p>}

      {loading ? (
        <CardListSkeleton rows={3} />
      ) : (agents || []).length === 0 ? (
        <EmptyState
          icon={<Bot size={20} />}
          title="No agents available here"
          body="This application has no specialist agents enabled for your organization yet."
        />
      ) : (
        <>
          {forThisPage && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5"
            >
              <Card className="border-gold-400/40">
                <CardHeader
                  title={
                    <span className="flex items-center gap-2">
                      <ShieldCheck size={16} className="text-gold-400" />
                      {forThisPage.display_name}
                    </span>
                  }
                  subtitle={`Covers the page you came from (${from})`}
                  action={
                    <button className="btn-secondary !py-1.5 !text-xs" onClick={() => openAssistant("agent")}>
                      Ask
                    </button>
                  }
                />
                {forThisPage.description && (
                  <p className="mt-1 text-sm text-slate-400">{forThisPage.description}</p>
                )}
              </Card>
            </motion.div>
          )}

          <p className="mb-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {forThisPage ? "Other agents in this application" : "Agents in this application"}
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {rest.map((agent, i) => (
              <motion.div
                key={agent.agent_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Card>
                  <CardHeader
                    title={
                      <span className="flex items-center gap-2">
                        <Sparkles size={15} className="text-slate-500" />
                        {agent.display_name}
                      </span>
                    }
                    subtitle={agent.domain}
                  />
                  {agent.description && (
                    <p className="mt-1 text-[13px] leading-5 text-slate-400">{agent.description}</p>
                  )}
                  {agent.surfaces && agent.surfaces.length > 0 && (
                    <p className="mt-3 text-xs text-slate-500">
                      Covers {agent.surfaces.map((s) => s.label).join(", ")}
                    </p>
                  )}
                </Card>
              </motion.div>
            ))}
          </div>

          <p className={cx("mt-5 text-xs text-slate-500")}>
            Agents are scoped to this application: {application} can only invoke the ones listed
            here. Anything that changes state still needs your approval first.
          </p>
        </>
      )}
    </div>
  );
}
