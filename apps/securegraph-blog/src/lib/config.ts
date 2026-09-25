import type { IssueMeta } from "./types";

/**
 * Issue-level copy and the newsletter target. These are the defaults; in live
 * mode the Staff Portal's issue settings override `issue.*` through the
 * GET /posts response.
 */
const newsletterUrl =
  (import.meta.env.VITE_NEWSLETTER_URL as string | undefined)?.trim() ||
  "//securegraph.substack.com/subscribe";

export const PUBLICATION = "The SecureGraph Weekly";

export const ISSUE: IssueMeta = {
  name: PUBLICATION,
  number: "Issue 01",
  date: "September 2026",
  folio: "01–02",
  kicker: "The SecureGraph Weekly · Field notes from the security graph",
  deck: "One week of evidence, not noise: what changed across the attack surface, what we proved, and what deserves a decision before Monday.",
  byline: "Written by the SecureGraph editorial team",
  pullQuote: "A finding nobody verified is a rumour. We only print what we can prove.",
  pullCite: "The SecureGraph Weekly, Issue 01",
  newsletterLabel: "Get the Weekly",
  newsletterBlurb: "One short issue every week: verified findings, fixes that held, and the questions worth asking your team. Nothing else.",
  newsletterUrl,
};
