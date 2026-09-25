import { useEffect, useRef, useState, type RefObject } from "react";

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

/** True once the element has entered the viewport (then stays true). */
export function useInView<T extends Element>(threshold = 0.35): [RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return [ref, inView];
}

/**
 * Parallax the gutter fold shadow (±7px) against scroll through the --gx
 * custom property, using a dirty-gated requestAnimationFrame write.
 */
export function useGutterParallax<T extends HTMLElement>(enabled: boolean): RefObject<T> {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!enabled) return;
    const sheet = ref.current;
    if (!sheet) return;

    let ticking = false;
    const update = () => {
      ticking = false;
      const rect = sheet.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const span = Math.max(1, rect.height - vh);
      let progress = -rect.top / span;
      progress = Math.max(0, Math.min(1, progress));
      const gx = (progress - 0.5) * 14; // ±7px
      document.documentElement.style.setProperty("--gx", gx.toFixed(2) + "px");
    };
    const requestTick = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };

    window.addEventListener("scroll", requestTick, { passive: true });
    window.addEventListener("resize", requestTick, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", requestTick);
      window.removeEventListener("resize", requestTick);
    };
  }, [enabled]);

  return ref;
}
