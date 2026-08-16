/**
 * Human-readable explanations for Phantix audit endpoints.
 * The audit trail stores raw API paths; this maps them to a short label and a
 * ≤2-sentence description so operators can understand what an action did.
 */

export interface EndpointDesc {
  /** Short human name, e.g. "Check GitHub connection". */
  label: string;
  /** One-to-two sentence explanation shown instead of the raw path. */
  detail: string;
}

/** Normalize a raw path/method into a match key: "GET /v1/github/installation". */
function norm(method: string, path: string): string {
  let p = (path || "").split("?")[0].split("#")[0].trim();
  if (!p) return "";
  p = p.replace(/^\/api\/v1/, "").replace(/^\/+/, "").replace(/\/+$/, "");
  const segs = p
    .split("/")
    .filter(Boolean)
    .map((s) => (/^\d+$/.test(s) ? "{id}" : s.toLowerCase()));
  return `${(method || "GET").toUpperCase()} /${segs.join("/")}`;
}

const EXACT: Record<string, EndpointDesc> = {
  // ── GitHub App ──────────────────────────────────────────────────────
  "GET /github/installation": {
    label: "Check GitHub connection",
    detail: "Checks whether the GitHub App is installed and connected for the organization, and returns its status (connected, awaiting approval, suspended, or not connected).",
  },
  "GET /github/install-url": {
    label: "Get GitHub install link",
    detail: "Builds a signed URL that installs the Phantix GitHub App on the organization's GitHub account.",
  },
  "POST /github/callback": {
    label: "Record GitHub install result",
    detail: "Records the result of a GitHub App installation (or install request) completed by the user on GitHub.",
  },
  "GET /github/repositories": {
    label: "List GitHub repositories",
    detail: "Lists the repositories the connected GitHub installation can access for analysis.",
  },
  "POST /github/repositories/sync": {
    label: "Sync GitHub repositories",
    detail: "Refreshes the cached list of repositories from the connected GitHub installation.",
  },
  "POST /github/repositories/analyze": {
    label: "Analyze a GitHub repository",
    detail: "Queues a security analysis of a repository, subject to the organization's plan (private repos require Premium).",
  },
  "DELETE /github/installation": {
    label: "Disconnect GitHub",
    detail: "Disconnects the GitHub App installation and clears its repositories from the organization.",
  },
  "POST /github/webhook": {
    label: "GitHub webhook event",
    detail: "Receives real-time GitHub events (install, suspend, delete) that keep the connection status up to date.",
  },

  // ── Org-user auth / dual control ────────────────────────────────────
  "POST /org-users/auth/login": {
    label: "Start org-user sign-in",
    detail: "Sends a one-time email code to sign in an organization user (for access or dual-control operate).",
  },
  "POST /org-users/auth/login/mfa": {
    label: "Verify org-user code",
    detail: "Verifies the emailed one-time code and issues the org-user identity token, or starts new-device confirmation.",
  },
  "POST /org-users/auth/login/device": {
    label: "Confirm new device",
    detail: "Confirms sign-in from a new browser/device so the org-user session token can be issued.",
  },
  "POST /org-users/auth/device-confirm": {
    label: "Confirm new device via link",
    detail: "Validates the emailed device-confirmation link and marks the new device as confirmed.",
  },
  "POST /org-users/auth/device-status": {
    label: "Poll device confirmation",
    detail: "Checks whether the new-device confirmation link was opened and completes sign-in when it was.",
  },
  "POST /org-users/auth/logout": {
    label: "End operate session",
    detail: "Ends the organization user's dual-control operate session.",
  },
  "GET /org-users/auth/me": {
    label: "Read current org user",
    detail: "Returns the signed-in organization user's identity, role, and permissions.",
  },

  // ── App (Command Centre) auth ───────────────────────────────────────
  "POST /app/auth/login": {
    label: "Start app sign-in",
    detail: "Starts Command Centre sign-in with email and password, and emails a one-time verification code.",
  },
  "POST /app/auth/mfa": {
    label: "Verify app code",
    detail: "Verifies the emailed code and issues the app session and device tokens.",
  },
  "POST /app/auth/challenge": {
    label: "Validate sign-in link",
    detail: "Validates an app invite/sign-in link and returns what the user must do next (set password or sign in).",
  },
  "POST /app/auth/password": {
    label: "Verify invite password",
    detail: "Verifies the password for a sign-in-link user and emails a one-time code.",
  },
  "POST /app/auth/set-password": {
    label: "Set first password",
    detail: "Sets the first password from an app invite link before completing sign-in.",
  },
  "POST /app/auth/otp": {
    label: "Resend app code",
    detail: "Resends the application sign-in verification code.",
  },
  "POST /app/auth/device-confirm": {
    label: "Confirm app device via link",
    detail: "Validates the emailed app device-confirmation link and marks the new browser as primary.",
  },
  "POST /app/auth/device-status": {
    label: "Poll app device confirmation",
    detail: "Checks whether the app's device-confirmation link was opened and issues tokens when it was.",
  },
  "GET /app/auth/me": {
    label: "Read app session",
    detail: "Returns the signed-in application session identity and capabilities.",
  },

  // ── Organization profile / setup ────────────────────────────────────
  "GET /organizations/me": {
    label: "Read organization",
    detail: "Reads the organization's profile and details.",
  },
  "PUT /organizations/me": {
    label: "Update organization",
    detail: "Updates the organization's profile and contact details.",
  },
  "POST /organizations/me/setup/otp/send": {
    label: "Send setup code",
    detail: "Emails a verification code to confirm the organization's primary email during setup.",
  },
  "POST /organizations/me/setup/otp/verify": {
    label: "Verify setup code",
    detail: "Verifies the emailed code to confirm the organization's email.",
  },
  "POST /organizations/login": {
    label: "Start platform sign-in",
    detail: "Starts platform sign-in with the company email and password.",
  },
  "POST /organizations/login/mfa": {
    label: "Verify platform code",
    detail: "Verifies the platform sign-in code and issues the company access token.",
  },
  "POST /organizations/register": {
    label: "Register organization",
    detail: "Registers a new organization on the platform.",
  },

  // ── Org users / people / dual control ───────────────────────────────
  "GET /org-users": {
    label: "List org users",
    detail: "Lists the organization's users and their roles.",
  },
  "POST /org-users": {
    label: "Create org user",
    detail: "Creates a new organization user (goes through dual-control approval when configured).",
  },
  "PUT /org-users/{id}": {
    label: "Update org user",
    detail: "Updates an organization user's details or role.",
  },
  "DELETE /org-users/{id}": {
    label: "Remove org user",
    detail: "Removes or deactivates an organization user.",
  },
  "GET /org-users/dual-control": {
    label: "Read dual control",
    detail: "Reads the organization's dual-control assignment (initiator and authorizer).",
  },
  "PUT /org-users/dual-control": {
    label: "Assign dual control",
    detail: "Assigns the dual-control initiator and authorizer roles.",
  },
  "POST /org-users/{id}/login-link": {
    label: "Issue login link",
    detail: "Generates and emails a one-time app sign-in link for an organization user.",
  },
  "DELETE /org-users/{id}/device": {
    label: "Clear device bind",
    detail: "Clears a user's bound primary device so they can sign in from a new browser.",
  },

  // ── VAPT ────────────────────────────────────────────────────────────
  "GET /vapt/campaigns": {
    label: "List VAPT campaigns",
    detail: "Lists the organization's VAPT campaigns and their progress.",
  },
  "POST /vapt/campaigns": {
    label: "Create VAPT campaign",
    detail: "Creates a new VAPT campaign as a draft to run an assessment.",
  },
  "POST /vapt/campaigns/{id}/start": {
    label: "Start VAPT campaign",
    detail: "Starts a VAPT campaign so its assessment pipeline begins running.",
  },
  "POST /vapt/campaigns/{id}/pause": {
    label: "Pause VAPT campaign",
    detail: "Pauses a running VAPT campaign.",
  },
  "POST /vapt/campaigns/{id}/resume": {
    label: "Resume VAPT campaign",
    detail: "Resumes a paused VAPT campaign.",
  },
  "POST /vapt/campaigns/{id}/cancel": {
    label: "Cancel VAPT campaign",
    detail: "Cancels a VAPT campaign and stops its pipeline.",
  },
  "POST /vapt/plan": {
    label: "Generate intelligent plan",
    detail: "Generates an intelligent VAPT assessment plan for the organization.",
  },
  "POST /vapt/plan/execute": {
    label: "Apply assessment plan",
    detail: "Turns a generated assessment plan into a VAPT campaign draft.",
  },
  "GET /vapt/findings": {
    label: "List VAPT findings",
    detail: "Lists correlated findings from VAPT campaigns.",
  },
  "POST /vapt/approvals/{id}/decide": {
    label: "Decide VAPT approval",
    detail: "Approves or rejects a VAPT approval request (e.g. authorizer sign-off on a campaign).",
  },

  // ── Scans ───────────────────────────────────────────────────────────
  "GET /scans/jobs": {
    label: "List scan jobs",
    detail: "Lists on-demand Nmap/Nuclei scan jobs and their progress.",
  },
  "POST /scans/jobs": {
    label: "Create scan job",
    detail: "Starts a new on-demand scan job (one active job per organization).",
  },
  "POST /scans/jobs/{id}/cancel": {
    label: "Cancel scan job",
    detail: "Requests cancellation of an active scan job.",
  },
  "GET /scans/results": {
    label: "List scan results",
    detail: "Lists raw scan results and findings from scan jobs.",
  },

  // ── Assets / intelligence ───────────────────────────────────────────
  "GET /assets": {
    label: "List assets",
    detail: "Lists the organization's discovered assets (domains, IPs, APIs, mobile).",
  },
  "POST /assets": {
    label: "Add asset",
    detail: "Adds a new asset to the organization's inventory.",
  },
  "GET /assets/intelligence/dashboard": {
    label: "Read asset intelligence",
    detail: "Reads the asset posture score and intelligence dashboard.",
  },
  "POST /assets/intelligence/refresh": {
    label: "Refresh asset intelligence",
    detail: "Recomputes intelligence (risk scores) for the organization's assets.",
  },
  "GET /assets/discovery/jobs": {
    label: "List discovery jobs",
    detail: "Lists asset discovery jobs that continuously find new assets.",
  },
  "POST /assets/verify/{id}": {
    label: "Verify asset",
    detail: "Marks an asset's verification status after ownership confirmation.",
  },

  // ── AGI / Pentest Agent / Phantix Agent ─────────────────────────────
  "GET /agi/access": {
    label: "Read AGI access",
    detail: "Reads the organization's Autonomous Pentest Agent access and entitlements.",
  },
  "POST /agi/agreement/accept": {
    label: "Accept AGI agreement",
    detail: "Accepts the Autonomous Pentest Agent usage agreement.",
  },
  "POST /agi/engagements": {
    label: "Create AGI engagement",
    detail: "Creates an Autonomous Pentest Agent engagement scoped to the organization's targets.",
  },
  "GET /agi/engagements": {
    label: "List AGI engagements",
    detail: "Lists the organization's Autonomous Pentest Agent engagements.",
  },
  "POST /agi/engagements/{id}/sessions": {
    label: "Start AGI session",
    detail: "Starts an Autonomous Pentest Agent session inside an approved engagement.",
  },
  "POST /agi/sessions/{id}/chat": {
    label: "Send AGI instruction",
    detail: "Sends a further instruction to a running Autonomous Pentest Agent session.",
  },
  "POST /agi/sessions/{id}/stop": {
    label: "Stop AGI session",
    detail: "Stops an Autonomous Pentest Agent session and tears down its container.",
  },
  "GET /agi/sessions/{id}/transcript": {
    label: "Read AGI transcript",
    detail: "Reads the live transcript of an Autonomous Pentest Agent session.",
  },
  "GET /agi/sessions/{id}/actions/pending": {
    label: "List pending AGI actions",
    detail: "Lists state-changing steps the agent is waiting for approval on.",
  },
  "POST /agi/actions/{id}/decide": {
    label: "Decide AGI action",
    detail: "Approves or rejects a state-changing step proposed by the autonomous agent.",
  },
  "POST /ai/agent/chat/stream": {
    label: "Chat with Phantix Agent",
    detail: "Streams a reply from the Phantix Agent security assistant against the organization's data.",
  },
  "POST /ai/agent/runs/stream": {
    label: "Run agent investigation",
    detail: "Starts a specialist agent investigation and streams its findings and tools.",
  },
  "GET /ai/settings": {
    label: "Read AI settings",
    detail: "Reads the Phantix Agent settings for the organization.",
  },
  "PUT /ai/settings": {
    label: "Update AI settings",
    detail: "Updates Phantix Agent settings such as enabled state and mode.",
  },
  "GET /agi/org/settings/bootstrap": {
    label: "Load AGI settings",
    detail: "Loads the Autonomous Pentest Agent settings and test accounts for the organization.",
  },
  "PATCH /agi/org/settings": {
    label: "Update AGI settings",
    detail: "Updates Autonomous Pentest Agent settings (limits, environments, credentials).",
  },
  "POST /agi/org/test-accounts": {
    label: "Add AGI test account",
    detail: "Adds a reusable test login/registration credential for the agent.",
  },
  "DELETE /agi/org/test-accounts/{id}": {
    label: "Delete AGI test account",
    detail: "Removes a stored test credential from the organization.",
  },

  // ── Alerts / audit / compliance ─────────────────────────────────────
  "GET /alerts/events": {
    label: "List alert events",
    detail: "Lists alert events delivered to the organization's channels.",
  },
  "GET /alerts/settings": {
    label: "Read alert settings",
    detail: "Reads the organization's alert channel and SMTP settings.",
  },
  "PUT /alerts/settings": {
    label: "Update alert settings",
    detail: "Updates alert channels, SMTP, and notification preferences.",
  },
  "POST /alerts/test": {
    label: "Send test alert",
    detail: "Sends a test alert to verify the configured alert channels.",
  },
  "GET /audit/events": {
    label: "Read audit trail",
    detail: "Reads the organization's immutable audit trail of user activities.",
  },
  "GET /audit/pending": {
    label: "List pending approvals",
    detail: "Lists actions awaiting dual-control authorization.",
  },
  "POST /audit/pending/{id}/authorize": {
    label: "Authorize pending action",
    detail: "Approves a pending action as the dual-control authorizer.",
  },
  "POST /audit/pending/{id}/reject": {
    label: "Reject pending action",
    detail: "Rejects a pending action as the dual-control authorizer.",
  },
  "GET /audit/export": {
    label: "Export audit trail",
    detail: "Exports the audit trail as a CSV for compliance.",
  },
  "POST /compliance/assessments": {
    label: "Run compliance assessment",
    detail: "Runs a compliance assessment against the organization's controls.",
  },

  // ── DB connections / billing / tools / support ──────────────────────
  "GET /db-connections": {
    label: "List DB connections",
    detail: "Lists the organization's security database connections.",
  },
  "POST /db-connections": {
    label: "Add DB connection",
    detail: "Adds a security database connection (config inspection or data storage).",
  },
  "DELETE /db-connections/{id}": {
    label: "Remove DB connection",
    detail: "Removes a security database connection.",
  },
  "GET /billing/payments": {
    label: "List payments",
    detail: "Lists the organization's payments and subscription invoices.",
  },
  "POST /billing/payments/{id}/pay": {
    label: "Start payment",
    detail: "Initializes checkout for a pending payment invoice.",
  },
  "POST /billing/payments/{id}/verify": {
    label: "Verify payment",
    detail: "Verifies a payment after checkout completes and activates access.",
  },
  "GET /billing/entitlements": {
    label: "Read entitlements",
    detail: "Reads the organization's plan entitlements and limits.",
  },
  "GET /tools/catalog": {
    label: "List tools",
    detail: "Lists the tool catalog the organization can subscribe to.",
  },
  "POST /tools/subscribe": {
    label: "Subscribe to tool",
    detail: "Subscribes the organization to a tool.",
  },
  "POST /support/tickets": {
    label: "Create support ticket",
    detail: "Submits a support ticket to Phantix.",
  },

  // ── Identity / service keys / security db ───────────────────────────
  "GET /organizations/me/identity": {
    label: "Read identity settings",
    detail: "Reads the organization's identity and key settings.",
  },
  "POST /organizations/me/service-key": {
    label: "Create service key",
    detail: "Creates the organization's application service key (pk_live_*).",
  },
  "DELETE /organizations/me/service-key/{id}": {
    label: "Revoke service key",
    detail: "Revokes an application service key.",
  },
  "POST /organizations/me/logo": {
    label: "Upload logo",
    detail: "Uploads the organization's brand logo.",
  },
  "DELETE /organizations/me/logo": {
    label: "Remove logo",
    detail: "Removes the organization's brand logo.",
  },
};

/** Module-level fallback when an exact endpoint isn't known. */
const MODULE_FALLBACK: Record<string, EndpointDesc> = {
  github: {
    label: "GitHub integration action",
    detail: "An action performed on the organization's GitHub App integration.",
  },
  "org-users": {
    label: "Organization user action",
    detail: "An action on organization users, roles, or dual-control assignment.",
  },
  organizations: {
    label: "Organization action",
    detail: "An action on the organization's profile or settings.",
  },
  vapt: {
    label: "VAPT action",
    detail: "An action on a VAPT campaign, plan, or correlated finding.",
  },
  scans: {
    label: "Scan action",
    detail: "An action on an on-demand scan job or its results.",
  },
  assets: {
    label: "Asset action",
    detail: "An action on the organization's asset inventory or intelligence.",
  },
  agi: {
    label: "Autonomous Pentest Agent action",
    detail: "An action on an Autonomous Pentest Agent engagement or session.",
  },
  ai: {
    label: "AI action",
    detail: "An action on the Phantix Agent or an AI-powered capability.",
  },
  alerts: {
    label: "Alert action",
    detail: "An action on alert channels, settings, or delivered alerts.",
  },
  audit: {
    label: "Audit action",
    detail: "An action reading or exporting the audit trail or pending approvals.",
  },
  compliance: {
    label: "Compliance action",
    detail: "An action on a compliance assessment or questionnaire.",
  },
  "db-connections": {
    label: "Database connection action",
    detail: "An action on a security database connection.",
  },
  billing: {
    label: "Billing action",
    detail: "An action on payments, subscriptions, or entitlements.",
  },
  tools: {
    label: "Tooling action",
    detail: "An action on the organization's tool subscriptions.",
  },
  support: {
    label: "Support action",
    detail: "An action on a support ticket.",
  },
  app: {
    label: "Application sign-in action",
    detail: "An action in the Command Centre sign-in or session flow.",
  },
  auth: {
    label: "Authentication action",
    detail: "An authentication or sign-in related action.",
  },
};

export function describeEndpoint(method: string, path: string): EndpointDesc | null {
  const key = norm(method, path);
  if (!key) return null;
  if (EXACT[key]) return EXACT[key];
  const module = key.split("/")[1]; // "GET /github/..." -> "github"
  if (module && MODULE_FALLBACK[module]) return MODULE_FALLBACK[module];
  return {
    label: "Platform action",
    detail: `An API action was performed (${method || "GET"} on ${path || "an endpoint"}).`,
  };
}
