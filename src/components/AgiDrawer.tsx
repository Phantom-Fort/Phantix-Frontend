import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Maximize2, Minimize2, Radar, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import AgiWorkspace from "@/components/AgiWorkspace";
import { readPersistedAgiSession } from "@/lib/agi";

export default function AgiDrawer() {
  const [open, setOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [live, setLive] = useState(() => Boolean(readPersistedAgiSession()));
  const location = useLocation();

  useEffect(() => {
    if (location.pathname.startsWith("/reports")) {
      setOpen(false);
      setFullscreen(false);
    }
  }, [location.pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open && !fullscreen) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, fullscreen]);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const full = Boolean((e as CustomEvent<{ fullscreen?: boolean }>).detail?.fullscreen);
      setOpen(true);
      setFullscreen(full);
    };
    const onClose = () => { setOpen(false); setFullscreen(false); };
    const onLive = (e: Event) => {
      setLive(Boolean((e as CustomEvent<{ running?: boolean }>).detail?.running));
    };
    window.addEventListener("phantix:agi-open", onOpen);
    window.addEventListener("phantix:agi-close", onClose);
    window.addEventListener("phantix:agi-live", onLive);
    return () => {
      window.removeEventListener("phantix:agi-open", onOpen);
      window.removeEventListener("phantix:agi-close", onClose);
      window.removeEventListener("phantix:agi-live", onLive);
    };
  }, []);

  const hide = () => { setOpen(false); setFullscreen(false); };

  return (
    <>
      <button
        onClick={() => { setOpen(true); setFullscreen(false); }}
        className="fixed right-0 top-1/2 z-[70] -translate-y-1/2 flex items-center gap-2 rounded-l-xl border border-r-0 border-phantix-700/50 bg-phantix-900/90 px-2.5 py-3 text-gold-300 shadow-card backdrop-blur-xl transition-colors hover:border-gold-400/40 hover:bg-phantix-800/90"
        title={live ? "Pentest Agent — session running" : "Autonomous Pentest Agent"}
      >
        <span className="relative">
          <Radar size={16} />
          {live && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400" />}
        </span>
        <span className="hidden -rotate-180 text-[10px] font-semibold uppercase tracking-[0.18em] [writing-mode:vertical-rl] lg:block">Pentest Agent</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="agi-drawer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-phantix-950/60 backdrop-blur-sm"
            onClick={hide}
          />
        )}
      </AnimatePresence>

      <aside
        className={cxPanel(fullscreen, open)}
        onClick={(e) => e.stopPropagation()}
        aria-hidden={!open}
      >
        <div className="flex items-center gap-2 border-b border-phantix-700/40 bg-phantix-950/90 px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-gold-400 to-gold-600 text-phantix-950"><Radar size={15} /></span>
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold text-white">Autonomous Pentest Agent</p>
            <p className="text-[10px] text-slate-500">{live ? "session running in background · close does not stop it" : fullscreen ? "operator console · attack tree · live terminal" : "human-gated · scoped · terminal-access"}</p>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setFullscreen((v) => !v)}
              className="rounded-lg border border-phantix-700/40 p-2 text-slate-400 transition-colors hover:border-gold-400/40 hover:text-gold-300"
              title={fullscreen ? "Exit full screen" : "Full screen"}
            >
              {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            <button
              onClick={hide}
              className="rounded-lg border border-phantix-700/40 p-2 text-slate-400 transition-colors hover:border-severity-critical/40 hover:text-severity-critical"
              title="Hide console — session keeps running"
            >
              <X size={14} />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 bg-phantix-950/95">
          <AgiWorkspace variant={fullscreen ? "console" : "drawer"} />
        </div>
      </aside>
    </>
  );
}

function cxPanel(fullscreen: boolean, open: boolean): string {
  const base = "fixed z-[85] flex flex-col overflow-hidden bg-phantix-950/95 shadow-card border-l border-phantix-700/40 transition-transform duration-300";
  const hidden = open ? "" : "pointer-events-none translate-x-full";
  if (fullscreen) return `${base} inset-0 !border-l-0 ${hidden}`;
  return `${base} right-0 top-0 bottom-0 w-[420px] max-w-[92vw] ${hidden}`;
}
