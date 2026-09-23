/**
 * Testing mode (blackbox / greybox / whitebox) + the engagement context that
 * answers the agent's operator questions up front, so a run does not stop to ask.
 *
 * The keys written into the engagement `config` mirror the runner's
 * `ModeQuestion.satisfied_by` / `engagement_context_block`, so anything filled
 * here suppresses the matching question and is injected as a fact.
 */
import React from "react";

export type TestingMode = "blackbox" | "greybox" | "whitebox";

export type TestingModeDef = {
  id: TestingMode;
  label: string;
  short: string;
  description: string;
};

export const TESTING_MODES: TestingModeDef[] = [
  {
    id: "blackbox",
    label: "Blackbox",
    short: "External attacker",
    description:
      "No credentials, no source, no docs. The agent discovers the surface from live traffic and infers business logic from behaviour.",
  },
  {
    id: "greybox",
    label: "Greybox",
    short: "Authorized tester",
    description:
      "Test accounts + API docs + inventory. The agent skips discovery and attacks authz seams, workflows and tenant isolation.",
  },
  {
    id: "whitebox",
    label: "Whitebox",
    short: "Source-informed",
    description:
      "Source, configs and IaC. The agent reads code paths first, targets sinks, and verifies the deployed build against the reviewed code.",
  },
];

export const DEFAULT_TESTING_MODE: TestingMode = "greybox";

export type EngagementContext = {
  process_flow?: string;
  critical_workflows?: string;
  out_of_scope_behaviours?: string;
  rate_limit?: string;
  active_exploitation_authorized?: boolean;
  registration_open?: boolean;
  api_spec_urls?: string;
  tenant_model?: string;
  source_paths?: string;
  repo?: string;
  known_findings?: string;
  secrets_locations?: string;
  fix_lifecycle?: string;
  test_accounts?: string;
};

export const EMPTY_ENGAGEMENT_CONTEXT: EngagementContext = {};

export type FieldType = "text" | "textarea" | "toggle";

export type ContextField = {
  key: keyof EngagementContext;
  label: string;
  hint?: string;
  placeholder?: string;
  type: FieldType;
  modes: TestingMode[];
};

/** Fields shown per mode. Superset across modes; the form filters by mode. */
export const CONTEXT_FIELDS: ContextField[] = [
  {
    key: "process_flow",
    label: "Process flows",
    hint: "Login, checkout, admin, refund — how the app is meant to be used.",
    placeholder: "e.g. register → verify email → login → browse → checkout → admin panel",
    type: "textarea",
    modes: ["blackbox", "greybox", "whitebox"],
  },
  {
    key: "critical_workflows",
    label: "Critical workflows",
    hint: "The 2-3 flows that matter most; the agent prioritises their logic abuse.",
    placeholder: "e.g. payment capture, role assignment, data export",
    type: "text",
    modes: ["greybox", "whitebox"],
  },
  {
    key: "out_of_scope_behaviours",
    label: "Out-of-scope behaviours",
    hint: "Beyond the allowlist, what must not be touched.",
    placeholder: "e.g. no spam/emails, no data deletion, skip SSO",
    type: "text",
    modes: ["blackbox", "greybox", "whitebox"],
  },
  {
    key: "rate_limit",
    label: "Rate / volume ceiling",
    hint: "What request rate and hours are allowed (and any no-load window).",
    placeholder: "e.g. ≤ 5 req/s, business hours only",
    type: "text",
    modes: ["blackbox", "greybox", "whitebox"],
  },
  {
    key: "active_exploitation_authorized",
    label: "Active exploitation authorized",
    hint: "May the agent deliver payloads, brute-force and inject? Off = passive discovery only.",
    type: "toggle",
    modes: ["blackbox"],
  },
  {
    key: "registration_open",
    label: "Self-service registration open",
    hint: "May the agent create its own test accounts?",
    type: "toggle",
    modes: ["blackbox"],
  },
  {
    key: "test_accounts",
    label: "Test accounts (one per line)",
    hint: "Format: email:password@https://app.example/login — one per role.",
    placeholder: "user@example.com:Passw0rd@https://app.example/login\nadmin@example.com:Passw0rd@https://app.example/login",
    type: "textarea",
    modes: ["greybox", "whitebox"],
  },
  {
    key: "api_spec_urls",
    label: "API spec URLs",
    hint: "OpenAPI/Swagger URLs, comma-separated. Leave blank to discover live.",
    placeholder: "https://app.example/openapi.json",
    type: "text",
    modes: ["greybox", "whitebox"],
  },
  {
    key: "tenant_model",
    label: "Tenancy model",
    hint: "Single/multi-tenant and one cross-tenant ID pair to test isolation.",
    placeholder: "e.g. multi-tenant by org_id; org A project 101 vs org B project 202",
    type: "text",
    modes: ["greybox", "whitebox"],
  },
  {
    key: "source_paths",
    label: "Source / repo paths",
    hint: "Where the agent can read source (path, bundle, or opencode handoff).",
    placeholder: "/repos/app  |  gs://bucket/src.zip",
    type: "text",
    modes: ["whitebox"],
  },
  {
    key: "repo",
    label: "Repository",
    hint: "Repository URL and the DEPLOYED commit/tag.",
    placeholder: "https://github.com/org/app @ commit abc123",
    type: "text",
    modes: ["whitebox"],
  },
  {
    key: "known_findings",
    label: "Known / accepted risks",
    hint: "Already-triaged issues so the agent does not re-report them.",
    placeholder: "e.g. missing CSP accepted; /debug internal only",
    type: "textarea",
    modes: ["whitebox"],
  },
  {
    key: "secrets_locations",
    label: "Config / secrets locations",
    hint: "Where config and secrets live (env files, vault, IaC) that may be read.",
    placeholder: "e.g. .env.production, k8s Secrets, Terraform state",
    type: "text",
    modes: ["whitebox"],
  },
  {
    key: "fix_lifecycle",
    label: "Fix / deploy lifecycle",
    hint: "How fixes land so the agent can replay the PoC after.",
    placeholder: "e.g. PR to main, deploy within 24h",
    type: "text",
    modes: ["whitebox"],
  },
];

export function fieldsForMode(mode: TestingMode): ContextField[] {
  return CONTEXT_FIELDS.filter((f) => f.modes.includes(mode));
}

/** Parse "a: b@https://login" lines into credential_accounts rows. */
export function parseTestAccounts(
  raw?: string,
): Array<{ login_url: string; username: string; password: string; label?: string }> {
  if (!raw) return [];
  const out: Array<{ login_url: string; username: string; password: string; label?: string }> = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const at = trimmed.lastIndexOf("@");
    if (at < 0) continue;
    const login_url = trimmed.slice(at + 1).trim();
    const creds = trimmed.slice(0, at);
    const colon = creds.indexOf(":");
    if (colon < 0) continue;
    const username = creds.slice(0, colon).trim();
    const password = creds.slice(colon + 1).trim();
    if (username && password && login_url) out.push({ login_url, username, password });
  }
  return out;
}

/** Build the engagement `config` payload from the mode + context answers. */
export function buildEngagementConfig(
  mode: TestingMode,
  ctx: EngagementContext,
  base: Record<string, unknown> = {},
): Record<string, unknown> {
  const config: Record<string, unknown> = { ...base, testing_mode: mode };
  const put = (key: string, value: unknown) => {
    if (typeof value === "string" ? value.trim() : value != null && value !== "") {
      config[key] = typeof value === "string" ? value.trim() : value;
    }
  };
  put("process_flow", ctx.process_flow);
  put("critical_workflows", ctx.critical_workflows);
  put("out_of_scope_behaviours", ctx.out_of_scope_behaviours);
  put("rate_limit", ctx.rate_limit);
  put("tenant_model", ctx.tenant_model);
  put("source_paths", ctx.source_paths);
  put("repo", ctx.repo);
  put("known_findings", ctx.known_findings);
  put("secrets_locations", ctx.secrets_locations);
  put("fix_lifecycle", ctx.fix_lifecycle);
  if (ctx.active_exploitation_authorized != null) {
    config.active_exploitation_authorized = ctx.active_exploitation_authorized;
  }
  if (ctx.registration_open != null) config.registration_open = ctx.registration_open;
  const specs = (ctx.api_spec_urls || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (specs.length) config.api_spec_urls = specs;
  const accounts = parseTestAccounts(ctx.test_accounts);
  if (accounts.length) config.credential_accounts = accounts;
  return config;
}

/** Segmented control for the testing mode. */
export function TestingModePicker({
  value,
  onChange,
  disabled,
}: {
  value: TestingMode;
  onChange: (mode: TestingMode) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {TESTING_MODES.map((m) => {
        const active = m.id === value;
        return (
          <button
            key={m.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(m.id)}
            className={
              "rounded-lg border px-3 py-2 text-left transition-colors disabled:opacity-60 " +
              (active
                ? "border-gold-400/50 bg-gold-400/10"
                : "border-phantix-700/50 bg-phantix-950/40 hover:border-phantix-600")
            }
          >
            <span className="block text-xs font-semibold text-slate-200">{m.label}</span>
            <span className="block text-[11px] leading-4 text-slate-500">{m.short}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Mode-filtered context fields. */
export function EngagementContextFields({
  mode,
  values,
  onChange,
  disabled,
}: {
  mode: TestingMode;
  values: EngagementContext;
  onChange: (next: EngagementContext) => void;
  disabled?: boolean;
}) {
  const set = (key: keyof EngagementContext, value: string | boolean) =>
    onChange({ ...values, [key]: value });
  return (
    <div className="space-y-3">
      {fieldsForMode(mode).map((f) => (
        <label key={String(f.key)} className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-400">{f.label}</span>
          {f.type === "toggle" ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => set(f.key, !(values[f.key] as boolean))}
              className={
                "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left disabled:opacity-60 " +
                (values[f.key]
                  ? "border-gold-400/50 bg-gold-400/10"
                  : "border-phantix-700/50 bg-phantix-950/40")
              }
            >
              <span className="text-xs text-slate-300">{values[f.key] ? "Yes" : "No"}</span>
              <span className="text-[11px] text-slate-500">{values[f.key] ? "authorized" : "not authorized"}</span>
            </button>
          ) : f.type === "textarea" ? (
            <textarea
              value={(values[f.key] as string) || ""}
              disabled={disabled}
              placeholder={f.placeholder}
              onChange={(e) => set(f.key, e.target.value)}
              rows={3}
              className="wb-sm w-full rounded-lg border border-phantix-700/50 bg-phantix-950/60 px-3 py-2 font-mono text-slate-200 outline-none placeholder:text-slate-600 focus:border-gold-400/40"
            />
          ) : (
            <input
              value={(values[f.key] as string) || ""}
              disabled={disabled}
              placeholder={f.placeholder}
              onChange={(e) => set(f.key, e.target.value)}
              className="wb-sm w-full rounded-lg border border-phantix-700/50 bg-phantix-950/60 px-3 py-2 text-slate-200 outline-none placeholder:text-slate-600 focus:border-gold-400/40"
            />
          )}
          {f.hint && <span className="mt-1 block text-[11px] leading-4 text-slate-600">{f.hint}</span>}
        </label>
      ))}
    </div>
  );
}
