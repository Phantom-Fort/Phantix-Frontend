import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Smartphone, Upload, Loader2, ShieldCheck, FileWarning, ScanSearch } from "lucide-react";
import { PageHeader, Card, CardHeader } from "@sg/ui";
import { api, publicErrorMessage } from "@sg/api";
import { sanitizeSingleLine, validateUploadFile } from "@sg/uploadValidation";
import { useStore } from "@sg/store";
import { cx } from "@sg/utils";
import DocLink from "@sg/components/DocLink";
import MobileHandoffCard from "@sg/components/MobileHandoffCard";
import { UpsellBanner } from "@sg/components/UpgradeGate";

// ── Mobile — static package analysis + governed endpoint handoff ─────────────
// W6: static APK/AAB/IPA analysis (secrets, manifest, permissions, endpoints)
// and NS-08 handoff of discovered mobile API endpoints to authorized
// reassessment. Runtime/dynamic (AVD) testing is a project engagement.

interface UploadResult {
  package_name?: string | null;
  sha256?: string;
  size_bytes?: number;
  findings_count?: number;
  findings_preview?: Array<Record<string, unknown>>;
  analysis_method?: string;
  message?: string;
  scan_hint?: string;
}

export default function Mobile() {
  const { toast, requireDualControl } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState("");
  const [criticality, setCriticality] = useState("medium");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [storageKey, setStorageKey] = useState("");
  const [analyzeBusy, setAnalyzeBusy] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState<UploadResult | null>(null);

  const upload = async () => {
    if (!file) {
      toast("error", "Choose a package", "Select an .apk file to analyze.");
      return;
    }
    const invalid = validateUploadFile(file, "apk");
    if (invalid) {
      toast("error", "Upload failed", invalid);
      return;
    }
    if (!(await requireDualControl("Uploading a mobile package requires a dual-control operate session."))) return;
    setBusy(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const cleanName = sanitizeSingleLine(name).slice(0, 255);
      const cleanEnvironment = sanitizeSingleLine(environment).slice(0, 50);
      if (cleanName) form.append("name", cleanName);
      if (cleanEnvironment) form.append("environment", cleanEnvironment);
      form.append("criticality", criticality);
      form.append("confirm_ownership", "true");
      const res = await api.upload<UploadResult>("/assets/upload/apk", form);
      setResult(res);
      toast("success", "Package analyzed", "A mobile_apk asset was created or updated.");
    } catch (e: unknown) {
      const err = e as { message?: string; detail?: { message?: string } };
      toast("error", "Upload failed", publicErrorMessage(err, "Could not analyze the package."));
    } finally {
      setBusy(false);
    }
  };

  const analyzeStored = async () => {
    if (!storageKey.trim()) {
      toast("error", "Storage key required", "Paste the storage key returned by an upload.");
      return;
    }
    setAnalyzeBusy(true);
    setAnalyzeResult(null);
    try {
      const res = await api.post<UploadResult>("/mobile/analyze", {
        storage_key: storageKey.trim(),
        filename: file?.name || name || "package.apk",
      });
      setAnalyzeResult(res);
      toast("success", "Analysis complete", "Static mobile analysis finished.");
    } catch (e: unknown) {
      const err = e as { message?: string; detail?: { message?: string } };
      toast("error", "Analysis failed", publicErrorMessage(err, "Could not analyze the stored package."));
    } finally {
      setAnalyzeBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Mobile"
        description="Static analysis of Android APK/AAB and iOS IPA packages"
        actions={<DocLink docId="howto-app-21" label="Mobile testing how-to" />}
      />

      {/* Dynamic runtime (AVD) testing is an engagement, not a self-serve scan. */}
      <UpsellBanner feature="dynamic_mobile" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader
              title="Analyze a package"
              subtitle="Upload an APK for inventory analysis. Runs statically — the binary is never executed."
              action={<Upload size={16} className="text-gold-300" />}
            />
            <div className="space-y-3 p-4">
              <div>
                <label className="label">Package file (.apk)</label>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".apk,application/vnd.android.package-archive"
                  aria-label="Package file (.apk)"
                  className="input !py-2"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setFile(f);
                    if (f && !name) setName(f.name.replace(/\.apk$/i, ""));
                  }}
                />
                <p className="mt-1 text-[13px] text-slate-500">
                  For AAB/IPA, upload to storage first and analyze by storage key below.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Display name</label>
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer app" />
                </div>
                <div>
                  <label className="label">Environment</label>
                  <input className="input" value={environment} onChange={(e) => setEnvironment(e.target.value)} placeholder="production" />
                </div>
              </div>
              <div>
                <label className="label">Criticality</label>
                <select className="input" value={criticality} onChange={(e) => setCriticality(e.target.value)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <button className="btn-primary w-full" disabled={busy || !file} onClick={() => void upload()}>
                {busy ? <Loader2 size={14} className="mr-1.5 inline animate-spin" /> : <Smartphone size={14} className="mr-1.5 inline" />}
                Upload &amp; analyze
              </button>
              {result && <AnalysisSummary result={result} />}
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader
              title="Analyze a stored package"
              subtitle="AAB / IPA or an object already in storage — analyze by storage key."
              action={<ScanSearch size={16} className="text-gold-300" />}
            />
            <div className="space-y-3 p-4">
              <div>
                <label className="label">Storage key</label>
                <input
                  className="input font-mono !text-xs"
                  value={storageKey}
                  onChange={(e) => setStorageKey(e.target.value)}
                  placeholder="uploads/org-24/app.aab"
                />
              </div>
              <button className="btn-secondary w-full" disabled={analyzeBusy} onClick={() => void analyzeStored()}>
                {analyzeBusy ? <Loader2 size={14} className="mr-1.5 inline animate-spin" /> : null}
                Analyze stored package
              </button>
              {analyzeResult && <AnalysisSummary result={analyzeResult} />}
              <p className="flex items-start gap-2 text-[13px] leading-5 text-slate-500">
                <ShieldCheck size={13} className="mt-0.5 shrink-0 text-emerald-400" />
                Static only. Any discovered endpoint must be inside an authorized scope before reassessment.
              </p>
            </div>
          </Card>
        </motion.div>
      </div>

      <div className="mt-4">
        <MobileHandoffCard />
      </div>
    </div>
  );
}

function AnalysisSummary({ result }: { result: UploadResult }) {
  const findings = result.findings_count ?? result.findings_preview?.length ?? 0;
  return (
    <div className="rounded-md border border-phantix-700/40 bg-phantix-900/40 p-3 text-xs leading-5">
      <p className="flex items-center gap-1.5 text-slate-200">
        {findings > 0 ? <FileWarning size={13} className="text-amber-300" /> : <ShieldCheck size={13} className="text-emerald-400" />}
        {result.package_name || "Package"} · {findings} finding{findings === 1 ? "" : "s"}
      </p>
      {result.sha256 && <p className="mt-1 truncate font-mono text-[12px] text-slate-500">sha256: {result.sha256}</p>}
      {result.analysis_method && <p className="text-[12px] text-slate-500">method: {result.analysis_method}</p>}
      {result.message && <p className="mt-1 text-slate-400">{result.message}</p>}
      {result.scan_hint && <p className="mt-1 font-mono text-[12px] text-slate-500">{result.scan_hint}</p>}
      {findings > 0 && result.findings_preview?.length ? (
        <ul className="mt-2 space-y-1">
          {result.findings_preview.slice(0, 5).map((f, i) => (
            <li key={i} className={cx("truncate text-[12px] text-slate-400")}>
              • {String((f as { title?: string; name?: string; message?: string }).title ?? (f as { name?: string }).name ?? (f as { message?: string }).message ?? JSON.stringify(f))}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
