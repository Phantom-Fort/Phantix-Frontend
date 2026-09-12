// Support — org-scoped tickets an operator can raise from the app.
//
// Mirrors app/engines/control_plane/api/support.py. A ticket belongs to the
// *organization* (so it can be worked by any operator, and support answers the
// account), while the operator who raised it is recorded as the submitter.
import { api, delay, isDemoMode } from "./api";

export type TicketStatus = "open" | "in_progress" | "waiting_on_customer" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "critical";
export type TicketCategory =
  | "general"
  | "technical"
  | "billing"
  | "security_incident"
  | "onboarding"
  | "other";

export interface SupportMessage {
  id?: number;
  author_type: string;
  author_name?: string | null;
  body: string;
  is_internal?: boolean;
  created_at: string;
}

export interface SupportTicket {
  id: number;
  organization_id?: number;
  reference?: string;
  subject: string;
  category?: string;
  priority: string;
  status: string;
  body?: string;
  submitter_name?: string | null;
  submitter_email?: string | null;
  assigned_to?: string | null;
  last_activity_at?: string;
  created_at: string;
  updated_at?: string;
  message_count?: number;
  messages?: SupportMessage[];
}

export interface CreateTicketInput {
  subject: string;
  body: string;
  category: TicketCategory;
  priority: TicketPriority;
  submitter_name?: string;
  submitter_email?: string;
}

export const TICKET_CATEGORIES: { id: TicketCategory; label: string }[] = [
  { id: "general", label: "General question" },
  { id: "technical", label: "Technical issue" },
  { id: "billing", label: "Billing & plan" },
  { id: "security_incident", label: "Security incident" },
  { id: "onboarding", label: "Onboarding & setup" },
  { id: "other", label: "Other" },
];

export const TICKET_PRIORITIES: { id: TicketPriority; label: string; hint: string }[] = [
  { id: "low", label: "Low", hint: "Question or cosmetic issue" },
  { id: "medium", label: "Medium", hint: "Something is degraded" },
  { id: "high", label: "High", hint: "Blocking a task today" },
  { id: "critical", label: "Critical", hint: "Live security incident or outage" },
];

/** First-response targets, shown next to the priority picker so the ask is honest. */
export const RESPONSE_TARGETS: Record<TicketPriority, string> = {
  critical: "within 1 hour",
  high: "within 4 hours",
  medium: "within 1 business day",
  low: "within 2 business days",
};

const BASE = "/support/tickets";

const demo: SupportTicket[] = [
  {
    id: 1,
    reference: "PHX-1001",
    subject: "Scan stuck in queued",
    category: "technical",
    priority: "high",
    status: "in_progress",
    body: "The scan I started this morning has not moved past queued.",
    submitter_name: "Ada Okonkwo",
    created_at: new Date(Date.now() - 3 * 3600_000).toISOString(),
    last_activity_at: new Date(Date.now() - 20 * 60_000).toISOString(),
    message_count: 2,
    messages: [
      {
        id: 1,
        author_type: "customer",
        author_name: "Ada Okonkwo",
        body: "The scan I started this morning has not moved past queued.",
        created_at: new Date(Date.now() - 3 * 3600_000).toISOString(),
      },
      {
        id: 2,
        author_type: "admin",
        author_name: "SecureGraph Support",
        body: "Thanks — a worker had dropped. I've requeued the job; it should start within a few minutes.",
        created_at: new Date(Date.now() - 20 * 60_000).toISOString(),
      },
    ],
  },
];

export async function loadSupportTickets(status?: string): Promise<SupportTicket[]> {
  if (isDemoMode()) {
    await delay(180);
    return status ? demo.filter((t) => t.status === status) : demo;
  }
  const q = status ? `?status=${encodeURIComponent(status)}` : "";
  const res = await api.get<SupportTicket[] | { items?: SupportTicket[] }>(`${BASE}${q}`);
  return Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : [];
}

export async function getSupportTicket(ticketId: number): Promise<SupportTicket> {
  if (isDemoMode()) {
    await delay(160);
    return demo[0];
  }
  return api.get<SupportTicket>(`${BASE}/${ticketId}`);
}

export async function createSupportTicket(input: CreateTicketInput): Promise<SupportTicket> {
  if (isDemoMode()) {
    await delay(400);
    return { ...demo[0], id: Date.now(), reference: "PHX-DEMO", status: "open", messages: [] };
  }
  return api.post<SupportTicket>(BASE, {
    subject: input.subject,
    body: input.body,
    category: input.category,
    priority: input.priority,
    ...(input.submitter_name ? { submitter_name: input.submitter_name } : {}),
    ...(input.submitter_email ? { submitter_email: input.submitter_email } : {}),
  });
}

export async function replySupportTicket(ticketId: number, body: string): Promise<SupportTicket> {
  if (isDemoMode()) {
    await delay(300);
    return demo[0];
  }
  return api.post<SupportTicket>(`${BASE}/${ticketId}/messages`, { body });
}

export function ticketAge(ticket: SupportTicket): string {
  return ticket.last_activity_at || ticket.updated_at || ticket.created_at;
}
