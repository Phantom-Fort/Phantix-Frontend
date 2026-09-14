// In-app user manuals — Platform + Command Centre only.
import platformManual from "@docs/docs/USER_MANUALS/02-platform.md?raw";
import appManual from "@docs/docs/USER_MANUALS/04-command-centre.md?raw";

function toWebContent(markdown: string): string {
  return markdown.replace(/\.\.\/screenshots\//g, "/screenshots/");
}

export const manualDocs = [
  {
    id: "manual-platform",
    title: "How to — Platform",
    description: "Org admin: sign-in, identity, people, security DB, billing, sandbox.",
    category: "manuals",
    content: toWebContent(platformManual),
  },
  {
    id: "manual-command-centre",
    title: "How to — Command Centre",
    description: "Operators: assets, SOC, scans, VAPT, risks, reports, tracker, agent.",
    category: "manuals",
    content: toWebContent(appManual),
  },
];
