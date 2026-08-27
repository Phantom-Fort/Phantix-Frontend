import { Check, ShieldCheck, ShieldX, RotateCw, UserCheck, Bot, FlaskConical } from "lucide-react";
import { cx } from "@/lib/utils";

export interface VerificationInfo {
  verdict?: string;
  verifier?: string;
  reason?: string;
  evidence?: string;
  by?: string;
  attempted_at?: string;
  subagent?: string;
}

/**
 * Findings verification layer badge.
 *
 * Surfaces which layer decided a finding's status:
 *   - adversarial_verifier (AI re-test)
 *   - exploit_subagent (AI exploit auditor)
 *   - human (operator / staff)
 * plus candidate / dismissed / inconclusive states. Nothing is ever reported
 * as final without a verdict attached.
 */
export function verificationBadge(v: VerificationInfo | null | undefined) {
  const verdict = (v?.verdict ?? "pending").toLowerCase();
  const verifier = (v?.verifier ?? "").toLowerCase();

  if (verdict === "confirmed") {
    const cls =
      verifier === "human"
        ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
        : verifier === "exploit_subagent"
          ? "border-gold-400/40 bg-gold-400/10 text-gold-300"
          : "border-blue-400/30 bg-blue-400/10 text-blue-300";
    const icon =
      verifier === "human" ? <UserCheck size={11} /> : verifier === "exploit_subagent" ? <FlaskConical size={11} /> : <Bot size={11} />;
    const label = verifier === "human" ? "Human verified" : verifier === "exploit_subagent" ? "Exploit verified" : "Auto verified";
    return { cls, icon, label };
  }
  if (verdict === "rejected") {
    return {
      cls: "border-severity-critical/40 bg-severity-critical/10 text-severity-critical",
      icon: <ShieldX size={11} />,
      label: verifier === "human" ? "Dismissed" : "Auto dismissed",
    };
  }
  if (verdict === "inconclusive") {
    return {
      cls: "border-severity-medium/40 bg-severity-medium/10 text-severity-medium",
      icon: <RotateCw size={11} />,
      label: "Inconclusive",
    };
  }
  if (verdict === "exempt") {
    return { cls: "border-phantix-600/40 bg-phantix-800/50 text-slate-400", icon: <ShieldCheck size={11} />, label: "Info / exempt" };
  }
  return { cls: "border-phantix-600/40 bg-phantix-800/50 text-slate-400", icon: <Check size={11} />, label: "Candidate" };
}

export function VerificationBadge({
  verification,
  className,
}: {
  verification?: VerificationInfo | null;
  className?: string;
}) {
  const b = verificationBadge(verification);
  return (
    <span className={cx("inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-medium", b.cls, className)}>
      {b.icon} {b.label}
    </span>
  );
}