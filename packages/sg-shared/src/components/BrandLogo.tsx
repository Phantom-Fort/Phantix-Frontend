import React, { useState } from "react";
import { useTheme } from "../theme";
import { cx } from "../utils";

/**
 * SecureGraph Brand Pack v1.0.
 *
 * - BrandMark: the icon only, on a transparent background, for compact or
 *   square spots such as collapsed sidebars, loaders, callbacks and badges.
 * - BrandWordmark: the horizontal lockup, for places with horizontal room
 *   where a wordmark is wanted, such as expanded navs, auth screens and footers.
 *
 * Both follow the theme: light gets the navy mark or black lockup, dark gets
 * white. Each walks a source chain (SVG, then PNG, then the pre-pack asset),
 * so a missing file never renders as a broken image.
 */
type Surface = "auto" | "light" | "dark";

function useDark(surface: Surface): boolean {
  const { theme } = useTheme();
  return surface === "auto" ? theme === "dark" : surface === "dark";
}

function useSourceChain(sources: string[]) {
  const [index, setIndex] = useState(0);
  const key = sources.join("|");
  const [chainKey, setChainKey] = useState(key);
  if (chainKey !== key) {
    setChainKey(key);
    setIndex(0);
  }
  return {
    src: sources[index] as string | undefined,
    next: () => setIndex((i) => i + 1),
  };
}

export function BrandMark({
  className,
  alt = "SecureGraph",
  surface = "auto",
}: {
  className?: string;
  alt?: string;
  /** Force the background the mark sits on; defaults to the current theme. */
  surface?: Surface;
}) {
  const dark = useDark(surface);
  const tone = dark ? "white" : "navy";
  const { src, next } = useSourceChain([
    `/mark-${tone}.svg`,
    `/mark-${tone}.png`,
    dark ? "/logo-white.png" : "/logo.png",
  ]);
  if (!src) return null;
  return <img src={src} alt={alt} onError={next} className={cx("object-contain", className)} />;
}

export function BrandWordmark({
  className,
  alt = "SecureGraph",
  surface = "auto",
}: {
  /** Set the height; the width follows the lockup's aspect ratio. */
  className?: string;
  alt?: string;
  surface?: Surface;
}) {
  const dark = useDark(surface);
  const { src, next } = useSourceChain([dark ? "/logo-white.svg" : "/logo.svg"]);
  if (!src) {
    // Lockup not deployed: the mark plus live type keeps the same footprint.
    return (
      <span className={cx("inline-flex items-center gap-2", className)} role="img" aria-label={alt}>
        <BrandMark surface={surface} alt="" className="h-full w-auto" />
        <span className="font-display text-[15px] font-bold leading-none text-white">SecureGraph</span>
      </span>
    );
  }
  return <img src={src} alt={alt} onError={next} className={cx("w-auto object-contain", className)} />;
}

/** Back-compatible name: existing square call sites render the mark. */
export const BrandLogo = BrandMark;
