import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Maximize2, Minimize2, Radar, X } from "lucide-react";
import AgiWorkspace from "@/components/AgiWorkspace";

/** Floating right-edge launcher + slide-in drawer for the Autonomous Pentest Agent. */
export default function AgiDrawer() {
  const [open, setOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  // Close on Escape (drawer not full-screen).
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); setFullscreen(false); }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  return (
    <>
      {/* Launcher tab — fixed on the right edge */}
      <button
        onClick={() => { setOpen(true); setFullscreen(false); }}
        className="fixed right-0 top-1/2 z-[70] -translate-y-1/2 flex items-center gap-2 rounded-l-xl border border-r-0 border-phantix-700/50 bg-phantix-900/90 px-2.5 py-3 text-gold-300 shadow-card backdrop-blur-xl transition-colors hover:border-gold-400/40 hover:bg-phantix-800/90"
        title="Autonomous Pentest Agent"
      >
        <Radar size={16} />
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
            onClick={() => { setOpen(false); setFullscreen(false); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.aside
            key="agi-panel"
            initial={{ x: fullscreen ? 0 : "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className={cxPanel(fullscreen)}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer header */}
            <div className="flex items-center gap-2 border-b border-phantix-700/40 bg-phantix-950/90 px-4 py-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-gold-400 to-gold-600 text-phantix-950"><Radar size={15} /></span>
              <div className="min-w-0">
                <p className="font-display text-sm font-semibold text-white">Autonomous Pentest Agent</p>
                <p className="text-[10px] text-slate-500">human-gated · scoped · terminal-access</p>
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
                  onClick={() => { setOpen(false); setFullscreen(false); }}
                  className="rounded-lg border border-phantix-700/40 p-2 text-slate-400 transition-colors hover:border-severity-critical/40 hover:text-severity-critical"
                  title="Close"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
            {/* Workspace body — fills remaining height */}
            <div className="min-h-0 flex-1 bg-phantix-950/95">
              <AgiWorkspace variant={fullscreen ? "page" : "drawer"} />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

function cxPanel(fullscreen: boolean): string {
  const base = "fixed z-[85] flex flex-col overflow-hidden bg-phantix-950/95 shadow-card border-l border-phantix-700/40";
  if (fullscreen) return `${base} inset-0 !border-l-0`;
  return `${base} right-0 top-0 bottom-0 w-[420px] max-w-[92vw]`;
}
