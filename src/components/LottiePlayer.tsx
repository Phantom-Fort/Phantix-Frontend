import React, { useEffect, useRef } from "react";
import lottie, { AnimationItem } from "lottie-web/build/player/lottie_svg";

interface LottiePlayerProps {
  animationData: unknown;
  className?: string;
  loop?: boolean;
  autoplay?: boolean;
  speed?: number;
  /** Segment in frames, e.g. [0, 120] — plays just that range. */
  segment?: [number, number];
  onComplete?: () => void;
}

/**
 * Minimal lottie-web wrapper used across the Phantix apps.
 * Renders a Lottie JSON animation into a container and cleans it up on unmount.
 */
export default function LottiePlayer({
  animationData,
  className,
  loop = true,
  autoplay = true,
  speed = 1,
  segment,
  onComplete,
}: LottiePlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animRef = useRef<AnimationItem | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const anim = lottie.loadAnimation({
      container: el,
      renderer: "svg",
      loop,
      autoplay,
      animationData: animationData as any,
    });
    anim.setSpeed(speed);
    if (segment && typeof anim.playSegments === "function") {
      anim.playSegments(segment, true);
    }
    if (onComplete) {
      anim.addEventListener("complete", () => onComplete());
    }
    animRef.current = anim;
    return () => {
      anim.destroy();
      animRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className={className} aria-hidden="true" />;
}
