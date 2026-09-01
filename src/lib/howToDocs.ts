// Task-level how-tos (docs/how-to/*) for the Command Centre help centre.
// Platform + Command Centre only (no landing / staff how-tos).
import howToIndex from "@docs/docs/how-to/README.md?raw";

import platIndex from "@docs/docs/how-to/platform/README.md?raw";
import plat01 from "@docs/docs/how-to/platform/01-register-and-sign-in.md?raw";
import plat02 from "@docs/docs/how-to/platform/02-complete-setup-wizard.md?raw";
import plat03 from "@docs/docs/how-to/platform/03-add-a-user.md?raw";
import plat04 from "@docs/docs/how-to/platform/04-assign-dual-control.md?raw";
import plat05 from "@docs/docs/how-to/platform/05-issue-app-login-link.md?raw";
import plat06 from "@docs/docs/how-to/platform/06-connect-security-database.md?raw";
import plat07 from "@docs/docs/how-to/platform/07-connect-config-database.md?raw";
import plat08 from "@docs/docs/how-to/platform/08-identity-keys-branding.md?raw";
import plat09 from "@docs/docs/how-to/platform/09-unlock-operate.md?raw";
import plat10 from "@docs/docs/how-to/platform/10-connect-github.md?raw";
import plat11 from "@docs/docs/how-to/platform/11-billing-and-subscribe.md?raw";
import plat12 from "@docs/docs/how-to/platform/12-configure-alerts.md?raw";
import plat13 from "@docs/docs/how-to/platform/13-sandbox-feedback.md?raw";

import appIndex from "@docs/docs/how-to/command-centre/README.md?raw";
import app01 from "@docs/docs/how-to/command-centre/01-sign-in.md?raw";
import app02 from "@docs/docs/how-to/command-centre/02-unlock-operate.md?raw";
import app03 from "@docs/docs/how-to/command-centre/03-add-and-verify-assets.md?raw";
import app04 from "@docs/docs/how-to/command-centre/04-run-discovery.md?raw";
import app05 from "@docs/docs/how-to/command-centre/05-launch-a-scan.md?raw";
import app06 from "@docs/docs/how-to/command-centre/06-run-vapt-campaign.md?raw";
import app07 from "@docs/docs/how-to/command-centre/07-triage-soc.md?raw";
import app08 from "@docs/docs/how-to/command-centre/08-availability-monitoring.md?raw";
import app09 from "@docs/docs/how-to/command-centre/09-manage-risks.md?raw";
import app10 from "@docs/docs/how-to/command-centre/10-compliance-assessment.md?raw";
import app11 from "@docs/docs/how-to/command-centre/11-generate-reports.md?raw";
import app12 from "@docs/docs/how-to/command-centre/12-findings-tracker.md?raw";
import app13 from "@docs/docs/how-to/command-centre/13-use-phantix-agent.md?raw";
import app14 from "@docs/docs/how-to/command-centre/14-authorizer-approvals.md?raw";
import app15 from "@docs/docs/how-to/command-centre/15-support-ticket.md?raw";

function toWeb(md: string): string {
  return md.replace(/\.\.\/\.\.\/screenshots\//g, "/screenshots/").replace(/\.\.\/screenshots\//g, "/screenshots/");
}

type Entry = { id: string; title: string; description: string; category: string; content: string };

function e(id: string, title: string, description: string, category: string, raw: string): Entry {
  return { id, title, description, category, content: toWeb(raw) };
}

export const howToDocs: Entry[] = [
  e("howto-index", "How-to index", "Task guides for Platform and Command Centre.", "how-to", howToIndex),

  e("howto-platform-index", "Platform â€” how-to index", "Org admin tasks on platform.phantixlabs.com.", "how-to-platform", platIndex),
  e("howto-platform-01", "Platform: Register & sign in", "Create org and MFA login.", "how-to-platform", plat01),
  e("howto-platform-02", "Platform: Setup wizard", "Privacy, email OTP, verification.", "how-to-platform", plat02),
  e("howto-platform-03", "Platform: Add a user", "Create org users for dual control and app access.", "how-to-platform", plat03),
  e("howto-platform-04", "Platform: Assign dual control", "Initiator and authorizer slots.", "how-to-platform", plat04),
  e("howto-platform-05", "Platform: Issue app login link", "Invite operators to Command Centre.", "how-to-platform", plat05),
  e("howto-platform-06", "Platform: Security database", "Connect and bootstrap security_data_storage.", "how-to-platform", plat06),
  e("howto-platform-07", "Platform: Config database", "Optional config_inspection connection.", "how-to-platform", plat07),
  e("howto-platform-08", "Platform: Identity & keys", "Profile, pk_live keys, branding.", "how-to-platform", plat08),
  e("howto-platform-09", "Platform: Unlock operate", "Dual-control session for mutations.", "how-to-platform", plat09),
  e("howto-platform-10", "Platform: Connect GitHub", "GitHub App and repo import.", "how-to-platform", plat10),
  e("howto-platform-11", "Platform: Billing", "Subscribe, pay, redeem coupons.", "how-to-platform", plat11),
  e("howto-platform-12", "Platform: Alerts", "SMTP, WhatsApp, Telegram.", "how-to-platform", plat12),
  e("howto-platform-13", "Platform: Sandbox feedback", "Updates and ratings when enrolled.", "how-to-platform", plat13),

  e("howto-app-index", "Command Centre â€” how-to index", "Operator tasks on app.phantixlabs.com.", "how-to-app", appIndex),
  e("howto-app-01", "App: Sign in", "Password, invite link, or demo.", "how-to-app", app01),
  e("howto-app-02", "App: Unlock operate", "Dual-control for scans and writes.", "how-to-app", app02),
  e("howto-app-03", "App: Add & verify assets", "Inventory and verification.", "how-to-app", app03),
  e("howto-app-04", "App: Run discovery", "Discover hosts and imports.", "how-to-app", app04),
  e("howto-app-05", "App: Launch a scan", "One active job per org.", "how-to-app", app05),
  e("howto-app-06", "App: VAPT campaign", "Create, approve, run, findings.", "how-to-app", app06),
  e("howto-app-07", "App: Triage SOC", "Detections, cases, escalation.", "how-to-app", app07),
  e("howto-app-08", "App: Availability & agent", "Checks and heartbeat installs.", "how-to-app", app08),
  e("howto-app-09", "App: Manage risks", "Priority queue and treatments.", "how-to-app", app09),
  e("howto-app-10", "App: Compliance assessment", "Frameworks and evidence.", "how-to-app", app10),
  e("howto-app-11", "App: Generate reports", "Library formats including pptx/html.", "how-to-app", app11),
  e("howto-app-12", "App: Findings tracker", "Living remediation board.", "how-to-app", app12),
  e("howto-app-13", "App: Phantix Agent", "Chat and skills.", "how-to-app", app13),
  e("howto-app-14", "App: Authorizer approvals", "Approve protected actions.", "how-to-app", app14),
  e("howto-app-15", "App: Support ticket", "Contact Phantix support.", "how-to-app", app15),
];
