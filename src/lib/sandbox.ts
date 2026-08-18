/**
 * Org sandbox tester client (Command Centre / app.phantix.site).
 * Auth: app dual tokens. Staff management lives in staff-portal only.
 */
import { api, ApiError, delay, isDemoMode } from "./api";

export type SandboxProgramBrief = {
  id?: number;
  name?: string;
  slug?: string;
  maxMembers?: number;
  status?: string;
};

export type SandboxUpdate = {
  id: number;
  title: string;
  body_md?: string;
  bodyMd?: string;
  severity: "info" | "fix" | "breaking" | string;
  version_label?: string;
  versionLabel?: string;
  published_at?: string;
  publishedAt?: string;
  acked?: boolean;
};

export type SandboxMe = {
  enrolled: boolean;
  program?: SandboxProgramBrief | null;
  member?: { status?: string; enrolledAt?: string } | null;
  unreadUpdates?: number;
  latestUpdate?: SandboxUpdate | null;
};

export type SandboxRating = {
  id?: number;
  score: number;
  nps?: number | null;
  area?: string;
  comment?: string;
  what_broke?: string;
  created_at?: string;
  createdAt?: string;
};

/** Areas spanning Platform + Command Centre product surfaces. */
export const SANDBOX_AREAS = [
  "overall",
  "platform",
  "assets",
  "soc",
  "reports",
  "agi",
  "auth",
  "billing",
  "other",
] as const;

function asList<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    for (const k of ["items", "updates", "ratings", "data", "value"]) {
      if (Array.isArray(o[k])) return o[k] as T[];
    }
  }
  return [];
}

function normalizeUpdate(u: any): SandboxUpdate {
  return {
    id: Number(u?.id ?? 0),
    title: String(u?.title ?? "Update"),
    body_md: u?.body_md ?? u?.bodyMd ?? u?.body,
    bodyMd: u?.bodyMd ?? u?.body_md,
    severity: String(u?.severity ?? "info"),
    version_label: u?.version_label ?? u?.versionLabel,
    versionLabel: u?.versionLabel ?? u?.version_label,
    published_at: u?.published_at ?? u?.publishedAt,
    publishedAt: u?.publishedAt ?? u?.published_at,
    acked: Boolean(u?.acked ?? u?.acknowledged),
  };
}

export function normalizeSandboxMe(raw: any): SandboxMe {
  if (!raw || typeof raw !== "object") return { enrolled: false };
  if (raw.enrolled === false) return { enrolled: false };
  const program = raw.program && typeof raw.program === "object" ? raw.program : null;
  const member = raw.member && typeof raw.member === "object" ? raw.member : null;
  const latest = raw.latestUpdate ?? raw.latest_update ?? null;
  return {
    enrolled: raw.enrolled !== false && (raw.enrolled === true || !!program || !!member),
    program: program
      ? {
          id: program.id != null ? Number(program.id) : undefined,
          name: program.name != null ? String(program.name) : undefined,
          slug: program.slug != null ? String(program.slug) : undefined,
          maxMembers: Number(program.maxMembers ?? program.max_members ?? 20),
          status: program.status != null ? String(program.status) : undefined,
        }
      : null,
    member: member
      ? {
          status: member.status != null ? String(member.status) : undefined,
          enrolledAt: member.enrolledAt ?? member.enrolled_at ?? undefined,
        }
      : null,
    unreadUpdates: Number(raw.unreadUpdates ?? raw.unread_updates ?? 0),
    latestUpdate: latest ? normalizeUpdate(latest) : null,
  };
}

const demoMe: SandboxMe = {
  enrolled: true,
  program: { id: 1, name: "Public launch 20", slug: "public-launch-20", maxMembers: 20, status: "active" },
  member: { status: "active", enrolledAt: "2026-08-10T10:00:00Z" },
  unreadUpdates: 1,
  latestUpdate: {
    id: 9,
    title: "SOC agent downloads are live",
    body_md: "Linux / macOS / Windows packages are on Command Centre → SOC → Availability.",
    severity: "fix",
    version_label: "2026-08-19",
    published_at: new Date().toISOString(),
  },
};

const demoUpdates: SandboxUpdate[] = [
  demoMe.latestUpdate!,
  {
    id: 8,
    title: "Command center + Platform sandbox",
    body_md: "Rate builds from **app** (tools) and **platform** (org admin).",
    severity: "info",
    version_label: "2026-08-18",
    published_at: "2026-08-18T12:00:00Z",
    acked: true,
  },
];

export async function loadSandboxMe(): Promise<SandboxMe | null> {
  if (isDemoMode()) {
    await delay(200);
    return demoMe;
  }
  try {
    const raw = await api.get<unknown>("/sandbox/me");
    return normalizeSandboxMe(raw);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return { enrolled: false };
    return null;
  }
}

export async function loadSandboxUpdates(): Promise<SandboxUpdate[]> {
  if (isDemoMode()) {
    await delay(200);
    return demoUpdates;
  }
  try {
    return asList<any>(await api.get<unknown>("/sandbox/updates")).map(normalizeUpdate);
  } catch {
    return [];
  }
}

export async function ackSandboxUpdate(id: number): Promise<void> {
  if (isDemoMode()) {
    await delay(150);
    return;
  }
  await api.post(`/sandbox/updates/${id}/ack`);
}

export async function submitSandboxRating(body: {
  score: number;
  nps?: number | null;
  area?: string;
  comment?: string;
  what_broke?: string;
}): Promise<SandboxRating> {
  if (isDemoMode()) {
    await delay(250);
    return { ...body, id: Date.now(), created_at: new Date().toISOString() };
  }
  return api.post<SandboxRating>("/sandbox/ratings", body);
}

export async function loadMySandboxRatings(): Promise<SandboxRating[]> {
  if (isDemoMode()) {
    await delay(200);
    return [{ id: 1, score: 4, nps: 8, area: "soc", comment: "Checks list is clear", created_at: "2026-08-16T10:00:00Z" }];
  }
  try {
    return asList<SandboxRating>(await api.get<unknown>("/sandbox/ratings/mine"));
  } catch {
    return [];
  }
}
