// ── In-app user manuals (rendered in the Command Centre help centre) ──────────
// The manuals live under docs/USER_MANUALS/ as filesystem docs (screenshots via
// ../screenshots/). For the web help centre, image paths are rewritten to
// /screenshots/ (served from public/screenshots/), which is what the browser
// resolves.

import landingManual from "@docs/docs/USER_MANUALS/01-landing.md?raw";
import platformManual from "@docs/docs/USER_MANUALS/02-platform.md?raw";
import staffManual from "@docs/docs/USER_MANUALS/03-staff-portal.md?raw";

/** Rewrite filesystem screenshot refs (../screenshots/...) to web paths (/screenshots/...). */
function toWebContent(markdown: string): string {
  return markdown.replace(/\.\.\/screenshots\//g, "/screenshots/");
}

export const manualDocs = [
  {
    id: "manual-landing",
    title: "User manual — Landing site",
    description: "The public phantix.site marketing site: sections, pricing, and CTAs.",
    category: "manuals",
    content: toWebContent(landingManual),
  },
  {
    id: "manual-platform",
    title: "User manual — Platform",
    description: "Organization admin guide: identity, users, connections, billing, AI, audit and more.",
    category: "manuals",
    content: toWebContent(platformManual),
  },
  {
    id: "manual-staff",
    title: "User manual — Staff portal",
    description: "Phantix staff guide: clients, billing, AI/VAPT admin, server, logs, support.",
    category: "manuals",
    content: toWebContent(staffManual),
  },
];
