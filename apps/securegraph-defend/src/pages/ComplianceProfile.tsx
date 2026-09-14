import React, { useCallback, useEffect, useState } from "react";
import { Building2, Cloud, Globe, Loader2, Save, Sparkles } from "lucide-react";
import { Card, CardHeader, EmptyState, ErrorState, PageHeader, Spinner, PageBodySkeleton } from "@/components/ui";
import { useStore } from "@/lib/store";
import { ApiError } from "@/lib/api";
import {
  loadFrameworkRecommendations,
  loadProfile,
  saveProfile,
  type BusinessProfile,
  type BusinessProfileUpdate,
} from "@/lib/complianceGrc";
import { cx } from "@/lib/utils";
import DocLink from "@/components/DocLink";

// ── Business profile ─────────────────────────────────────────────────────────
// The profile is what drives GET /compliance/recommendations: which frameworks
// actually apply to this organization. Without it the recommendations endpoint
// answers 400 telling you to create one — so this page owns both.

const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-1000", "1000+"];
const CLOUD_PROVIDERS = ["aws", "azure", "gcp", "digitalocean", "on-prem", "other"];

const DATA_FLAGS: Array<{ key: keyof BusinessProfileUpdate; label: string; hint: string }> = [
  { key: "handles_personal_data", label: "Personal data", hint: "Drives NDPR / GDPR applicability" },
  { key: "handles_health_records", label: "Health records", hint: "Drives HIPAA-style controls" },
  { key: "handles_payment_cards", label: "Payment cards", hint: "Drives PCI DSS" },
  { key: "handles_financial_transactions", label: "Financial transactions", hint: "Drives financial-sector controls" },
  { key: "handles_government_contracts", label: "Government contracts", hint: "Drives public-sector requirements" },
  { key: "has_public_apis", label: "Public APIs", hint: "Expands the assessed attack surface" },
  { key: "uses_ai", label: "Uses AI", hint: "Drives AI governance controls" },
];

export default function ComplianceProfile() {
  const { toast } = useStore();
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [draft, setDraft] = useState<BusinessProfileUpdate>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [recs, setRecs] = useState<unknown[] | null>(null);
  const [recsNote, setRecsNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const row = await loadProfile();
      setProfile(row);
      setDraft(row ? toDraft(row) : { country: "", customer_countries: [], cloud_providers: [] });
      await refreshRecs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load the business profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshRecs = async () => {
    try {
      const res = await loadFrameworkRecommendations();
      setRecs(Array.isArray(res.recommendations) ? res.recommendations : []);
      setRecsNote(null);
    } catch (e) {
      setRecs(null);
      // A 400 here is the documented "create a profile first" answer, not a fault.
      setRecsNote(
        e instanceof ApiError && e.status === 400
          ? "Save your profile to get framework recommendations."
          : e instanceof Error ? e.message : "Recommendations unavailable.",
      );
    }
  };

  useEffect(() => {
    void load();
  }, [load]);

  const set = <K extends keyof BusinessProfileUpdate>(key: K, value: BusinessProfileUpdate[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const toggleList = (key: "customer_countries" | "cloud_providers", value: string) => {
    const current = (draft[key] as string[] | undefined) ?? [];
    set(key, current.includes(value) ? current.filter((v) => v !== value) : [...current, value]);
  };

  const persist = async () => {
    setSaving(true);
    try {
      const row = await saveProfile(draft);
      setProfile(row);
      setDraft(toDraft(row));
      await refreshRecs();
      toast("success", "Profile saved", "Framework recommendations refreshed.");
    } catch (e) {
      toast("error", "Could not save the profile", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const cloud = (draft.cloud_providers as string[] | undefined) ?? [];

  return (
    <div>
      <PageHeader
        title="Business profile"
        description="What your organization does, where it operates and what data it touches. This is the input that decides which compliance frameworks apply to you."
        actions={<>
            <DocLink docId="howto-app-24" label="Compliance review how-to" />
          <button onClick={() => void persist()} disabled={saving} className="btn-primary text-xs !py-2">
            {saving ? <Loader2 size={13} className="mr-1.5 inline animate-spin" /> : <Save size={13} className="mr-1.5 inline" />}
            Save profile
          </button>
        </>}
      />

      {loading ? (
        <PageBodySkeleton variant="form" rows={6} />
      ) : error ? (
        <ErrorState title="Profile unavailable" body={error} onRetry={() => void load()} />
      ) : (
        <div className="space-y-5">
          {!profile && (
            <p className="rounded-md border border-gold-400/30 bg-gold-400/10 p-3 text-xs leading-5 text-gold-200">
              No profile yet. Fill this in and save — framework recommendations and the questionnaire scope both depend on it.
            </p>
          )}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader title="Organization" subtitle="Sector and size" action={<Building2 size={15} className="text-gold-400" />} />
              <div className="space-y-3">
                <div>
                  <label className="label" htmlFor="cp-country">Primary country</label>
                  <input
                    id="cp-country"
                    value={draft.country ?? ""}
                    onChange={(e) => set("country", e.target.value)}
                    placeholder="NG"
                    className="input mt-1"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="cp-industry">Industry</label>
                  <input
                    id="cp-industry"
                    value={draft.industry ?? ""}
                    onChange={(e) => set("industry", e.target.value)}
                    placeholder="Fintech"
                    className="input mt-1"
                  />
                </div>
                <div>
                  <p className="label">Company size</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {COMPANY_SIZES.map((s) => (
                      <button
                        key={s}
                        onClick={() => set("company_size", s)}
                        className={cx(
                          "chip transition-colors",
                          draft.company_size === s ? "border-gold-400/40 bg-gold-400/10 text-gold-200" : "border-phantix-700 text-slate-400 hover:text-slate-200",
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label" htmlFor="cp-retention">Data retention (days)</label>
                  <input
                    id="cp-retention"
                    type="number"
                    min={0}
                    value={draft.data_retention_period_days ?? ""}
                    onChange={(e) => set("data_retention_period_days", e.target.value === "" ? null : Number(e.target.value))}
                    className="input mt-1"
                  />
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader title="Data handled" subtitle="Each one pulls in a different control set" action={<Globe size={15} className="text-phantix-300" />} />
              <div className="space-y-2">
                {DATA_FLAGS.map((f) => {
                  const on = Boolean(draft[f.key]);
                  return (
                    <button
                      key={String(f.key)}
                      onClick={() => set(f.key, !on as never)}
                      className={cx(
                        "flex w-full items-center justify-between gap-3 rounded-md border p-2.5 text-left transition-colors",
                        on ? "border-gold-400/40 bg-gold-400/10" : "border-phantix-700 bg-phantix-900/60 hover:border-phantix-600",
                      )}
                    >
                      <span className="min-w-0">
                        <span className={cx("block text-sm", on ? "text-gold-200" : "text-slate-300")}>{f.label}</span>
                        <span className="block text-[11px] text-slate-500">{f.hint}</span>
                      </span>
                      <span className={cx("chip shrink-0", on ? "border-gold-400/40 text-gold-200" : "border-phantix-700 text-slate-500")}>
                        {on ? "Yes" : "No"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Card>

            <Card>
              <CardHeader title="Cloud providers" subtitle="Where the workloads run" action={<Cloud size={15} className="text-emerald-400" />} />
              <div className="flex flex-wrap gap-1.5">
                {CLOUD_PROVIDERS.map((p) => (
                  <button
                    key={p}
                    onClick={() => toggleList("cloud_providers", p)}
                    className={cx(
                      "chip uppercase transition-colors",
                      cloud.includes(p) ? "border-gold-400/40 bg-gold-400/10 text-gold-200" : "border-phantix-700 text-slate-400 hover:text-slate-200",
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <div className="mt-4">
                <label className="label" htmlFor="cp-customer-countries">Customer countries</label>
                <input
                  id="cp-customer-countries"
                  value={((draft.customer_countries as string[] | undefined) ?? []).join(", ")}
                  onChange={(e) =>
                    set("customer_countries", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))
                  }
                  placeholder="NG, GH, KE"
                  className="input mt-1"
                />
                <p className="mt-1 text-[11px] text-slate-500">Comma separated — drives cross-border data rules.</p>
              </div>
            </Card>

            <Card>
              <CardHeader title="Recommended frameworks" subtitle="Derived from the profile" action={<Sparkles size={15} className="text-gold-400" />} />
              {recsNote ? (
                <p className="text-xs text-slate-500">{recsNote}</p>
              ) : !recs?.length ? (
                <EmptyState icon={<Sparkles size={20} />} title="No recommendations yet" body="Save a more complete profile to get framework suggestions." />
              ) : (
                <div className="space-y-2">
                  {recs.map((r, i) => {
                    const rec = (r ?? {}) as Record<string, unknown>;
                    const name = rec.name ?? rec.framework_id ?? rec.id ?? `Framework ${i + 1}`;
                    return (
                      <div key={i} className="rounded-md border border-phantix-700 bg-phantix-900/60 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm text-slate-200">{String(name)}</span>
                          {rec.score != null && (
                            <span className="chip border-gold-400/30 text-gold-200">{String(rec.score)}</span>
                          )}
                        </div>
                        {(rec.reason ?? rec.rationale) != null && (
                          <p className="mt-1 text-xs leading-5 text-slate-400">{String(rec.reason ?? rec.rationale)}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function toDraft(row: BusinessProfile): BusinessProfileUpdate {
  return {
    country: row.country,
    customer_countries: (row.customer_countries ?? []).map(String),
    industry: row.industry,
    company_size: row.company_size,
    handles_personal_data: row.handles_personal_data,
    handles_health_records: row.handles_health_records,
    handles_payment_cards: row.handles_payment_cards,
    handles_government_contracts: row.handles_government_contracts,
    handles_financial_transactions: row.handles_financial_transactions,
    cloud_providers: (row.cloud_providers ?? []).map(String),
    has_public_apis: row.has_public_apis,
    uses_ai: row.uses_ai,
    data_retention_period_days: row.data_retention_period_days,
  };
}
