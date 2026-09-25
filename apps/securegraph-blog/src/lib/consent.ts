// ── Analytics consent (shared across the Phantix surface family) ────────────
// Reuses the same cookie key as the landing page, so a reader who accepted
// there is not asked again on the blog (and vice-versa). The choice is stored
// on the broadest parent domain the browser accepts and never leaves it.

export type ConsentChoice = "accepted" | "declined";

const KEY = "phantix_cookie_consent";
const ONE_YEAR = 60 * 60 * 24 * 365;

function readCookie(): string | null {
  try {
    const hit = document.cookie.split("; ").find((c) => c.startsWith(`${KEY}=`));
    return hit ? decodeURIComponent(hit.slice(KEY.length + 1)) : null;
  } catch {
    return null;
  }
}

function parentDomains(): string[] {
  const host = window.location.hostname;
  if (!host.includes(".") || /^[\d.]+$/.test(host) || host.includes(":")) return [];
  const labels = host.split(".");
  const out: string[] = [];
  for (let i = labels.length - 2; i >= 0; i--) out.push(`.${labels.slice(i).join(".")}`);
  return out;
}

function writeCookie(value: string, maxAge: number): void {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const base = `${KEY}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
  for (const domain of parentDomains()) {
    document.cookie = `${base}; Domain=${domain}`;
    if (maxAge > 0 ? readCookie() === value : readCookie() === null) return;
  }
  document.cookie = base;
}

export function getConsent(): ConsentChoice | null {
  const fromCookie = readCookie();
  if (fromCookie === "accepted" || fromCookie === "declined") return fromCookie;
  try {
    const legacy = localStorage.getItem(KEY);
    if (legacy === "accepted" || legacy === "declined") {
      setConsent(legacy);
      return legacy;
    }
  } catch {
    /* storage disabled */
  }
  return null;
}

export function setConsent(choice: ConsentChoice): void {
  try {
    writeCookie(choice, ONE_YEAR);
    localStorage.removeItem(KEY);
  } catch {
    /* cookies disabled — the banner will simply reappear */
  }
}
