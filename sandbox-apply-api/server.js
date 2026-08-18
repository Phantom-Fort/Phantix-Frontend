/**
 * Phantix sandbox apply API — lightweight JSON-file store.
 * Public: status + apply. Staff: list/patch with X-Sandbox-Staff-Key.
 */
import cors from "cors";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");

const PORT = Number(process.env.PORT || 8787);
const MAX_SEATS = Math.min(20, Math.max(1, Number(process.env.MAX_SEATS || 20)));
const STAFF_API_KEY = process.env.STAFF_API_KEY || "dev-staff-key-change-me";
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/** @typedef {{ id: string, organization_name: string, website: string, contact_name: string, contact_email: string, country: string, industry: string, team_size: string, use_case: string, hear_about: string, status: 'pending'|'approved'|'rejected'|'waitlist', staff_notes: string, created_at: string, updated_at: string }} Application */

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(STORE_PATH, JSON.stringify({ applications: [] }, null, 2), "utf8");
  }
}

function readStore() {
  ensureStore();
  try {
    const raw = JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
    return { applications: Array.isArray(raw.applications) ? raw.applications : [] };
  } catch {
    return { applications: [] };
  }
}

function writeStore(store) {
  ensureStore();
  const tmp = `${STORE_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
  fs.renameSync(tmp, STORE_PATH);
}

/** Seats held by pending + approved (rejected / waitlist do not consume). */
function seatStats(apps) {
  const pending = apps.filter((a) => a.status === "pending").length;
  const approved = apps.filter((a) => a.status === "approved").length;
  const waitlist = apps.filter((a) => a.status === "waitlist").length;
  const rejected = apps.filter((a) => a.status === "rejected").length;
  const seatsUsed = pending + approved;
  const open = seatsUsed < MAX_SEATS;
  return {
    max: MAX_SEATS,
    seatsUsed,
    seatsRemaining: Math.max(0, MAX_SEATS - seatsUsed),
    open,
    pending,
    approved,
    enrolled: approved,
    waitlist,
    rejected,
    totalApplications: apps.length,
  };
}

function requireStaff(req, res, next) {
  const key = req.get("X-Sandbox-Staff-Key") || req.get("x-sandbox-staff-key") || "";
  if (!key || key !== STAFF_API_KEY) {
    return res.status(401).json({ detail: "Invalid or missing X-Sandbox-Staff-Key" });
  }
  return next();
}

function normalizeEmail(e) {
  return String(e || "")
    .trim()
    .toLowerCase();
}

function publicStatus() {
  const { applications } = readStore();
  const s = seatStats(applications);
  return {
    max: s.max,
    seatsUsed: s.seatsUsed,
    seatsRemaining: s.seatsRemaining,
    open: s.open,
    enrolled: s.enrolled,
    pending: s.pending,
    label: `${s.enrolled} enrolled · ${s.seatsUsed}/${s.max} seats held`,
  };
}

const app = express();
app.use(
  cors({
    origin: CORS_ORIGINS.length ? CORS_ORIGINS : true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Sandbox-Staff-Key"],
  }),
);
app.use(express.json({ limit: "64kb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "sandbox-apply-api", maxSeats: MAX_SEATS });
});

/** Public seat counter for landing. */
app.get("/api/sandbox/status", (_req, res) => {
  res.json(publicStatus());
});

/** Public apply form. */
app.post("/api/sandbox/apply", (req, res) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const organization_name = String(body.organization_name || body.organizationName || "").trim();
  const contact_email = normalizeEmail(body.contact_email || body.contactEmail);
  const contact_name = String(body.contact_name || body.contactName || "").trim();
  const website = String(body.website || "").trim();
  const country = String(body.country || "").trim();
  const industry = String(body.industry || "").trim();
  const team_size = String(body.team_size || body.teamSize || "").trim();
  const use_case = String(body.use_case || body.useCase || "").trim();
  const hear_about = String(body.hear_about || body.hearAbout || "").trim();

  if (!organization_name || organization_name.length < 2) {
    return res.status(400).json({ detail: "Organization name is required" });
  }
  if (!contact_name) {
    return res.status(400).json({ detail: "Contact name is required" });
  }
  if (!contact_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact_email)) {
    return res.status(400).json({ detail: "Valid contact email is required" });
  }
  if (!use_case || use_case.length < 10) {
    return res.status(400).json({ detail: "Please describe your use case (at least 10 characters)" });
  }

  const store = readStore();
  const stats = seatStats(store.applications);
  if (!stats.open) {
    return res.status(409).json({
      detail: "Sandbox cohort is full (20 organizations). Applications are closed.",
      status: publicStatus(),
    });
  }

  const dup = store.applications.find(
    (a) =>
      normalizeEmail(a.contact_email) === contact_email &&
      (a.status === "pending" || a.status === "approved"),
  );
  if (dup) {
    return res.status(409).json({
      detail: "An application with this email is already pending or approved.",
      application_id: dup.id,
    });
  }

  const now = new Date().toISOString();
  /** @type {Application} */
  const row = {
    id: crypto.randomUUID(),
    organization_name,
    website,
    contact_name,
    contact_email,
    country,
    industry,
    team_size,
    use_case,
    hear_about,
    status: "pending",
    staff_notes: "",
    created_at: now,
    updated_at: now,
  };
  store.applications.unshift(row);
  writeStore(store);

  return res.status(201).json({
    ok: true,
    application_id: row.id,
    message: "Application received. Phantix staff will review and enroll you.",
    status: publicStatus(),
  });
});

/** Staff: list applications. */
app.get("/api/sandbox/applications", requireStaff, (req, res) => {
  const status = String(req.query.status || "").toLowerCase();
  const store = readStore();
  let items = store.applications;
  if (status) items = items.filter((a) => a.status === status);
  res.json({
    items,
    total: items.length,
    stats: seatStats(store.applications),
  });
});

/** Staff: patch application status / notes. */
app.patch("/api/sandbox/applications/:id", requireStaff, (req, res) => {
  const id = String(req.params.id || "");
  const store = readStore();
  const idx = store.applications.findIndex((a) => a.id === id);
  if (idx < 0) return res.status(404).json({ detail: "Application not found" });

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const nextStatus = body.status != null ? String(body.status).toLowerCase() : null;
  const allowed = ["pending", "approved", "rejected", "waitlist"];
  if (nextStatus && !allowed.includes(nextStatus)) {
    return res.status(400).json({ detail: `status must be one of: ${allowed.join(", ")}` });
  }

  const current = store.applications[idx];
  const wouldApprove =
    nextStatus === "approved" && current.status !== "approved" && current.status !== "pending"
      ? true
      : nextStatus === "approved" && current.status === "rejected";

  // If moving into a seat-holding status from non-holding, check capacity
  const holdsSeat = (s) => s === "pending" || s === "approved";
  if (nextStatus && holdsSeat(nextStatus) && !holdsSeat(current.status)) {
    const stats = seatStats(store.applications);
    if (stats.seatsUsed >= MAX_SEATS) {
      return res.status(409).json({ detail: "No seats remaining. Reject or waitlist another org first." });
    }
  }
  void wouldApprove;

  if (nextStatus) current.status = nextStatus;
  if (body.staff_notes != null || body.staffNotes != null) {
    current.staff_notes = String(body.staff_notes ?? body.staffNotes ?? "");
  }
  current.updated_at = new Date().toISOString();
  store.applications[idx] = current;
  writeStore(store);

  res.json({ ok: true, application: current, stats: seatStats(store.applications) });
});

/** Staff: delete application. */
app.delete("/api/sandbox/applications/:id", requireStaff, (req, res) => {
  const id = String(req.params.id || "");
  const store = readStore();
  const before = store.applications.length;
  store.applications = store.applications.filter((a) => a.id !== id);
  if (store.applications.length === before) {
    return res.status(404).json({ detail: "Application not found" });
  }
  writeStore(store);
  res.json({ ok: true, stats: seatStats(store.applications) });
});

ensureStore();
app.listen(PORT, () => {
  console.log(`sandbox-apply-api listening on :${PORT} (max seats ${MAX_SEATS})`);
});
