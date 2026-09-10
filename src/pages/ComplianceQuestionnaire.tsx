import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck, ClipboardList, Info, Loader2, RefreshCw, Search, UserCheck, Users,
} from "lucide-react";
import { Card, CardHeader, EmptyState, ErrorState, Modal, PageHeader, ProgressBar, Spinner, StatCard, PageBodySkeleton } from "@/components/ui";
import { useStore } from "@/lib/store";
import { ApiError } from "@/lib/api";
import {
  ANSWER_CHOICES,
  EMPTY_PROGRESS,
  loadQuestionnaire,
  rebuildQuestionnaire,
  startAnswererSession,
  submitAnswer,
  type QuestionnaireList,
  type QuestionnaireQuestion,
} from "@/lib/complianceGrc";
import { cx } from "@/lib/utils";

// ── Compliance questionnaire (self-attestation) ──────────────────────────────
// The merged GRC question set for whichever frameworks apply to this org.
// The server refuses answers until the user declares the role they are
// answering as, because every answer is attributed to person *and* role for the
// audit trail — so the role gate is the first thing this page resolves.

const ROLE_SUGGESTIONS = ["CISO", "IT Admin", "Compliance Officer", "Security Engineer", "CTO", "DPO"];

const ANSWER_TONE: Record<string, string> = {
  yes: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  no: "border-severity-critical/40 bg-severity-critical/10 text-severity-critical",
  partial: "border-severity-medium/40 bg-severity-medium/10 text-severity-medium",
  na: "border-phantix-600 bg-phantix-800/60 text-slate-400",
};

const ANSWER_LABEL: Record<string, string> = {
  yes: "Yes", no: "No", partial: "Partial", na: "N/A",
};

const EMPTY_LIST: QuestionnaireList = {
  applicable_frameworks: [],
  total: 0,
  items: [],
  progress: EMPTY_PROGRESS,
  answer_choices: [...ANSWER_CHOICES],
  disclaimer: "",
};

export default function ComplianceQuestionnaire() {
  const { toast } = useStore();
  const [data, setData] = useState<QuestionnaireList>(EMPTY_LIST);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sessionId, setSessionId] = useState<number | null>(null);
  const [roleOpen, setRoleOpen] = useState(false);
  const [role, setRole] = useState("");
  const [title, setTitle] = useState("");
  const [startingSession, setStartingSession] = useState(false);

  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState<number | null>(null);
  const [rebuilding, setRebuilding] = useState(false);
  const [audit, setAudit] = useState<QuestionnaireQuestion | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await loadQuestionnaire());
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 409
          ? "Your security storage is not activated yet, so questionnaire answers cannot be stored. Connect it on the Platform under Connections."
          : e instanceof Error
            ? e.message
            : "Failed to load the questionnaire.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const q of data.items) if (q.category) set.add(q.category);
    return ["all", ...[...set].sort()];
  }, [data.items]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.items.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (!q) return true;
      return (
        item.prompt.toLowerCase().includes(q) ||
        (item.help_text ?? "").toLowerCase().includes(q) ||
        item.framework_ids.some((f) => f.toLowerCase().includes(q))
      );
    });
  }, [data.items, category, search]);

  const beginSession = async () => {
    if (role.trim().length < 2) {
      toast("warning", "State your role", "The server records the role you answer as — at least 2 characters.");
      return;
    }
    setStartingSession(true);
    try {
      const sess = await startAnswererSession(role.trim(), title.trim() || undefined);
      setSessionId(sess.id);
      setRoleOpen(false);
      toast("success", "Role recorded", `Answering as ${sess.stated_role}. Every answer is attributed to you and this role.`);
    } catch (e) {
      toast(
        "error",
        "Could not start the session",
        e instanceof ApiError && e.status === 403
          ? "Answering needs a named user session — sign in as an organization user rather than with an org token."
          : e instanceof Error ? e.message : undefined,
      );
    } finally {
      setStartingSession(false);
    }
  };

  const answer = async (question: QuestionnaireQuestion, value: string) => {
    if (!sessionId) {
      setRoleOpen(true);
      return;
    }
    setSaving(question.id);
    try {
      await submitAnswer({ sessionId, questionId: question.id, answerValue: value });
      // Refresh so progress, attestation score and the multi-user answer roll-up
      // all move together rather than drifting from the server's view.
      setData(await loadQuestionnaire());
    } catch (e) {
      toast("error", "Answer not saved", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(null);
    }
  };

  const rebuild = async () => {
    setRebuilding(true);
    try {
      await rebuildQuestionnaire();
      await load();
      toast("success", "Questionnaire rebuilt", "Merged again from every applicable framework control.");
    } catch (e) {
      toast("error", "Rebuild failed", e instanceof Error ? e.message : undefined);
    } finally {
      setRebuilding(false);
    }
  };

  const p = data.progress;

  return (
    <div>
      <PageHeader
        title="Compliance questionnaire"
        description="Self-attestation across every control that applies to your organization. Answers are attributed to the person and the role they declared, so the trail stands up in an audit."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setRoleOpen(true)}
              className={cx("text-xs !py-2", sessionId ? "btn-secondary" : "btn-primary")}
            >
              <UserCheck size={13} className="mr-1.5 inline" />
              {sessionId ? "Change role" : "Declare your role"}
            </button>
            <button onClick={() => void rebuild()} disabled={rebuilding} className="btn-ghost text-xs !py-2">
              {rebuilding ? <Loader2 size={13} className="mr-1.5 inline animate-spin" /> : <RefreshCw size={13} className="mr-1.5 inline" />}
              Rebuild
            </button>
          </div>
        }
      />

      {loading && !data.items.length ? (
        <PageBodySkeleton stats={4} variant="section" rows={5} />
      ) : error ? (
        <ErrorState title="Questionnaire unavailable" body={error} onRetry={() => void load()} />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Answered" value={`${p.answered_unique_questions}/${p.total_questions}`} icon={<ClipboardList size={18} />} hint={`${p.unanswered} left`} />
            <StatCard label="Complete" value={`${Math.round(p.percent_complete)}%`} icon={<BadgeCheck size={18} />} hint="of applicable controls" />
            <StatCard
              label="Attestation level"
              value={p.compliance_level?.label ?? "Not started"}
              icon={<BadgeCheck size={18} />}
              hint={p.attestation_score != null ? `score ${Math.round(p.attestation_score)}` : "no score yet"}
            />
            <StatCard label="Answer events" value={String(p.total_answer_events)} icon={<Users size={18} />} hint="including colleagues" />
          </div>

          <Card>
            <CardHeader
              title="Progress"
              subtitle={p.applicable_frameworks.length ? `Frameworks: ${p.applicable_frameworks.join(", ")}` : "No frameworks resolved yet"}
            />
            <ProgressBar value={p.percent_complete} />
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">
              <span className="text-emerald-400">{p.yes_count} yes</span>
              <span className="text-severity-medium">{p.partial_count} partial</span>
              <span className="text-severity-critical">{p.no_count} no</span>
              <span>{p.not_applicable} n/a</span>
            </div>
            {(p.disclaimer || data.disclaimer) && (
              <p className="mt-4 flex items-start gap-2 rounded-md border border-phantix-700 bg-phantix-900/60 p-3 text-[11px] leading-5 text-slate-400">
                <Info size={12} className="mt-0.5 shrink-0 text-gold-400" />
                {p.disclaimer || data.disclaimer}
              </p>
            )}
          </Card>

          {!sessionId && (
            <button
              onClick={() => setRoleOpen(true)}
              className="flex w-full items-center gap-2 rounded-md border border-gold-400/30 bg-gold-400/10 p-3 text-left text-xs text-gold-200 transition-colors hover:bg-gold-400/15"
            >
              <UserCheck size={14} className="shrink-0" />
              Declare the role you are answering as before you can record answers.
            </button>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search questions"
                className="input w-64 !py-1.5 !pl-8 !text-xs"
                aria-label="Search questions"
              />
            </div>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cx(
                  "chip capitalize transition-colors",
                  category === c ? "border-gold-400/40 bg-gold-400/10 text-gold-200" : "border-phantix-700 text-slate-400 hover:text-slate-200",
                )}
              >
                {c === "all" ? "All categories" : c}
              </button>
            ))}
          </div>

          {!visible.length ? (
            <Card>
              <EmptyState
                icon={<ClipboardList size={22} />}
                title="No questions here"
                body={data.items.length ? "Nothing matches that filter." : "Rebuild the questionnaire to merge questions from your frameworks."}
              />
            </Card>
          ) : (
            <div className="space-y-3">
              {visible.map((q) => (
                <QuestionRow
                  key={q.id}
                  question={q}
                  saving={saving === q.id}
                  disabled={!sessionId}
                  onAnswer={(v) => void answer(q, v)}
                  onShowAudit={() => setAudit(q)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <Modal open={roleOpen} onClose={() => setRoleOpen(false)} title="Declare your answering role">
        <div className="space-y-4">
          <p className="text-sm leading-6 text-slate-400">
            Answers are recorded against your name and the role you state here. Pick the role you
            actually hold for these controls — it is part of the audit record.
          </p>
          <div>
            <label className="label" htmlFor="grc-role">Role</label>
            <input
              id="grc-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="CISO"
              className="input mt-1"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ROLE_SUGGESTIONS.map((r) => (
                <button key={r} onClick={() => setRole(r)} className="chip border-phantix-700 text-slate-400 hover:text-slate-200">
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label" htmlFor="grc-title">Job title (optional)</label>
            <input
              id="grc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Head of Information Security"
              className="input mt-1"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setRoleOpen(false)} className="btn-ghost text-xs !py-2">Cancel</button>
            <button onClick={() => void beginSession()} disabled={startingSession} className="btn-primary text-xs !py-2">
              {startingSession ? <Loader2 size={13} className="mr-1.5 inline animate-spin" /> : <UserCheck size={13} className="mr-1.5 inline" />}
              Start answering
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!audit} onClose={() => setAudit(null)} title="Who answered this" wide>
        {audit && (
          <div className="space-y-3">
            <p className="text-sm leading-6 text-slate-300">{audit.prompt}</p>
            {!audit.my_answer && !audit.answers_from_others.length ? (
              <p className="text-xs text-slate-500">No answers recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {[...(audit.my_answer ? [audit.my_answer] : []), ...audit.answers_from_others].map((a, i) => (
                  <div key={`${a.answered_by_email}-${i}`} className="rounded-md border border-phantix-700 bg-phantix-900/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-slate-200">{a.answered_by_name}</span>
                      <span className={cx("chip", ANSWER_TONE[a.answer_value] ?? ANSWER_TONE.na)}>
                        {ANSWER_LABEL[a.answer_value] ?? a.answer_value}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {a.stated_role}{a.stated_title ? ` · ${a.stated_title}` : ""} · {a.answered_by_email}
                    </p>
                    {a.notes && <p className="mt-2 text-xs leading-5 text-slate-400">{a.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function QuestionRow({
  question,
  saving,
  disabled,
  onAnswer,
  onShowAudit,
}: {
  question: QuestionnaireQuestion;
  saving: boolean;
  disabled: boolean;
  onAnswer: (value: string) => void;
  onShowAudit: () => void;
}) {
  const [showHelp, setShowHelp] = useState(false);
  const mine = question.my_answer?.answer_value ?? null;
  const isFreeText = question.answer_type === "free_text";

  return (
    <Card className={cx(mine && "border-phantix-600")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-6 text-slate-200">{question.prompt}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {question.category && <span className="chip border-phantix-700 text-slate-400">{question.category}</span>}
            {question.framework_ids.map((f) => (
              <span key={f} className="chip border-phantix-700 uppercase text-phantix-300">{f}</span>
            ))}
            {question.risk && <span className="chip border-severity-medium/30 text-severity-medium">{question.risk}</span>}
            {question.answer_count > 0 && (
              <button onClick={onShowAudit} className="chip border-phantix-700 text-slate-400 hover:text-slate-200">
                <Users size={10} className="mr-1 inline" />
                {question.answer_count} answered
              </button>
            )}
            {question.help_text && (
              <button onClick={() => setShowHelp((v) => !v)} className="chip border-phantix-700 text-slate-400 hover:text-slate-200">
                <Info size={10} className="mr-1 inline" /> Guidance
              </button>
            )}
          </div>
          {showHelp && question.help_text && (
            <p className="mt-3 rounded-md border border-phantix-700 bg-phantix-900/60 p-3 text-xs leading-5 text-slate-400">
              {question.help_text}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {saving && <Loader2 size={13} className="animate-spin text-slate-500" />}
          {isFreeText ? (
            <span className="text-[11px] text-slate-500">Free-text — answer in the audit view</span>
          ) : (
            ANSWER_CHOICES.map((choice) => (
              <button
                key={choice}
                onClick={() => onAnswer(choice)}
                disabled={saving || disabled}
                title={disabled ? "Declare your role first" : undefined}
                className={cx(
                  "chip transition-colors disabled:opacity-40",
                  mine === choice ? ANSWER_TONE[choice] : "border-phantix-700 text-slate-400 hover:text-slate-200",
                )}
              >
                {ANSWER_LABEL[choice]}
              </button>
            ))
          )}
        </div>
      </div>
    </Card>
  );
}
