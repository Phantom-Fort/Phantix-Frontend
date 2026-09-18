import React from "react";
import * as LucideIcons from "lucide-react";
import { Plug } from "lucide-react";
import { BRAND_ICONS } from "../brandIcons";

/** kebab-case ("clipboard-check") -> PascalCase ("ClipboardCheck") lucide export name. */
function toPascalCase(kebab: string): string {
  return kebab
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

export interface BrandIconProps {
  /** Connector catalog key, e.g. "slack", "crowdstrike" — looked up in BRAND_ICONS. */
  connectorId?: string | null;
  /** Backend's generic icon hint (kebab-case lucide name, e.g. "clipboard-check"). */
  iconHint?: string | null;
  size?: number;
  className?: string;
}

/**
 * Renders the connector's real brand mark when one exists (simple-icons match
 * against the backend catalog — see brandIcons.ts), falls back to the generic
 * lucide icon the backend already hints at per-connector, and falls back
 * again to a plain plug glyph if neither resolves. Brand marks render at
 * `currentColor` so they inherit whatever the caller's text color is, same as
 * any other inline icon in this codebase.
 */
export function BrandIcon({ connectorId, iconHint, size = 16, className }: BrandIconProps) {
  const brand = connectorId ? BRAND_ICONS[connectorId] : undefined;
  if (brand?.path) {
    return (
      <svg
        role="img"
        aria-label={brand.name}
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="currentColor"
        className={className}
      >
        <path d={brand.path} />
      </svg>
    );
  }

  if (iconHint) {
    const Lucide = (LucideIcons as unknown as Record<string, React.ComponentType<{ size?: number; className?: string }>>)[
      toPascalCase(iconHint)
    ];
    if (Lucide) return <Lucide size={size} className={className} />;
  }

  return <Plug size={size} className={className} />;
}

export default BrandIcon;
