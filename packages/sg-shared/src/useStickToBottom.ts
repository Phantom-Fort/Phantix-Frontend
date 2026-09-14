import { useEffect, useRef, useState } from "react";

export function useStickToBottom(deps: unknown[]) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const [unseen, setUnseen] = useState(0);

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 72;
    pinned.current = atBottom;
    setShowJump(!atBottom);
    if (atBottom) setUnseen(0);
  };

  useEffect(() => {
    if (!pinned.current) return;
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    else endRef.current?.scrollIntoView({ block: "end" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // Count new stream items that arrive while the user is scrolled up so the
  // "jump to latest" pill can show how much they are missing.
  const firstDep = deps[0];
  useEffect(() => {
    if (pinned.current) return;
    setUnseen((u) => u + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstDep]);

  const jump = () => {
    pinned.current = true;
    setShowJump(false);
    setUnseen(0);
    const el = scrollerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    else endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  };

  return { scrollerRef, endRef, showJump, onScroll, jump, unseen };
}
