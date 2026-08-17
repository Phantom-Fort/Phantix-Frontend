import { useEffect, useRef, useState } from "react";

export function useStickToBottom(deps: unknown[]) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const [showJump, setShowJump] = useState(false);

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 72;
    pinned.current = atBottom;
    setShowJump(!atBottom);
  };

  useEffect(() => {
    if (!pinned.current) return;
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    else endRef.current?.scrollIntoView({ block: "end" });
  }, deps);

  const jump = () => {
    pinned.current = true;
    setShowJump(false);
    const el = scrollerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    else endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  };

  return { scrollerRef, endRef, showJump, onScroll, jump };
}
