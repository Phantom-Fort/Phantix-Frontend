import React, { useEffect, useRef, useState } from "react";
import { animate, createTimeline, stagger } from "animejs";
import {
  Radar,
  FlaskConical,
  ShieldCheck,
  BellRing,
  Search,
  Activity,
  Siren,
  TerminalSquare,
  Cpu,
  Mail,
  MessageCircle,
  Send,
  Crosshair,
  ScanSearch,
  Workflow,
  BadgeCheck,
  Eye,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import LottiePlayer from "@/components/LottiePlayer";
import { cx } from "@/lib/utils";

const GOLD = "#e8b54d";
const BLUE = "#71717a";
const BLUE_LIGHT = "#a1a1aa";
const WHITE = "#e4e4e7";

interface Insight {
  id: string;
  icon: React.ReactNode;
  kicker: string;
  title: string;
  body: string;
  stat: { label: string; value: number };
  scene: React.ReactNode;
}

/* ── Scenes ─────────────────────────────────────────────────────────────── */

function GlobeScene() {
  return (
    <div className="relative h-80 w-80 select-none">
      <div data-anim="orbit" className="absolute -inset-8 rounded-full border border-white/10">
        <div className="absolute -inset-3 rounded-full border border-dashed border-[rgba(161,161,170,0.25)]" />
        <div
          data-anim="magnifier"
          className="absolute -top-3.5 left-1/2 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full border border-[rgba(232,181,77,0.6)] bg-[#0a0a0a] shadow-[0_0_22px_rgba(232,181,77,0.35)]"
        >
          <Search size={17} style={{ color: GOLD }} />
        </div>
      </div>

      <div className="absolute inset-0 overflow-hidden rounded-full bg-[radial-gradient(circle_at_35%_30%,#18181b_0%,#0a0a0a_55%,#000000_100%)] shadow-[0_0_50px_-12px_rgba(232,181,77,0.15)]">
        <div
          className="absolute inset-0 opacity-60"
          style={{
            background:
              "repeating-linear-gradient(90deg, transparent 0 34px, rgba(113,113,122,0.25) 34px 35px), repeating-linear-gradient(0deg, transparent 0 34px, rgba(113,113,122,0.25) 34px 35px)",
            maskImage: "radial-gradient(circle at 50% 50%, black 54%, transparent 74%)",
            WebkitMaskImage: "radial-gradient(circle at 50% 50%, black 54%, transparent 74%)",
          }}
        />
        <div className="absolute left-1/2 top-1/2 h-full w-[calc(100%*16/9)] -translate-x-1/2 -translate-y-1/2">
          <LottiePlayer src="/animations/globe.json" className="h-full w-full" loop />
        </div>
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_22%,rgba(255,255,255,0.22),transparent_42%)]" />
      </div>
    </div>
  );
}

function SonarScene() {
  return (
    <div className="relative flex h-80 w-full max-w-xl select-none items-center justify-center">
      <div data-anim="ring" className="absolute h-72 w-72 rounded-full border border-[rgba(161,161,170,0.28)]" />
      <div data-anim="ring" className="absolute h-52 w-52 rounded-full border border-[rgba(161,161,170,0.4)]" />
      <div data-anim="ring" className="absolute h-36 w-36 rounded-full border border-[rgba(232,181,77,0.45)]" />
      <div
        data-anim="radar"
        className="absolute h-72 w-72 rounded-full"
        style={{ background: "conic-gradient(from 0deg at 50% 50%, rgba(232,181,77,0.32), transparent 70deg)" }}
      />
      <div data-anim="core" className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: GOLD, boxShadow: `0 0 18px 4px ${GOLD}` }} />
      {[
        { top: "18%", left: "70%", c: BLUE_LIGHT },
        { top: "58%", left: "26%", c: WHITE },
        { top: "70%", left: "68%", c: BLUE },
        { top: "30%", left: "38%", c: GOLD },
      ].map((p, i) => (
        <div key={i} data-anim="contact" className="absolute h-1.5 w-1.5 rounded-full" style={{ top: p.top, left: p.left, background: p.c, boxShadow: `0 0 10px 2px ${p.c}` }} />
      ))}

      <div className="absolute inset-x-0 bottom-0 grid grid-cols-3 gap-3">
        {["API", "WEB", "DB"].map((label) => (
          <div key={label} className="rounded-md border border-white/10 bg-black/40 px-3 py-2.5">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-300">{label}</span>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: GOLD }} />
            </div>
            <svg viewBox="0 0 120 26" className="h-7 w-full" preserveAspectRatio="none">
              <path
                data-anim="wave"
                d="M0 13 H 10 l4 -7 8 14 8 -18 8 22 8 -16 8 10 8 -6 6 4 12 -14 8 20 8 -14 8 8 8 -4"
                fill="none"
                stroke={BLUE_LIGHT}
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="120"
                strokeDashoffset="120"
              />
            </svg>
          </div>
        ))}
      </div>
    </div>
  );
}

function IncidentScene() {
  const STAGES = [
    { icon: <Eye size={15} />, label: "Detect" },
    { icon: <Crosshair size={15} />, label: "Triage" },
    { icon: <Siren size={15} />, label: "Contain" },
    { icon: <ShieldCheck size={15} />, label: "Recover" },
  ];
  return (
    <div className="w-full max-w-xl select-none">
      <div className="relative flex items-center justify-between px-1">
        {STAGES.map((s, i) => (
          <div key={s.label} className="flex flex-col items-center gap-2">
            <div
              data-anim="node"
              className={cx(
                "flex h-12 w-12 items-center justify-center rounded-md border",
                i === 0 ? "border-[rgba(232,181,77,0.6)] bg-[rgba(232,181,77,0.1)]" : "border-white/15 bg-black/40"
              )}
            >
              <span style={{ color: i === 0 ? GOLD : BLUE_LIGHT }}>{s.icon}</span>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-300">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="relative mt-4 h-2 rounded-full bg-white/10">
        <div
          data-anim="track"
          className="absolute -top-1 h-4 w-4 rounded-full"
          style={{ background: GOLD, boxShadow: `0 0 14px 3px ${GOLD}` }}
        />
      </div>

      <div className="mt-6 rounded-md border border-white/10 bg-black/40 p-4">
        <div className="flex items-center gap-2 text-xs">
          <span className="chip !py-0.5 !text-[10px] border-[rgba(232,181,77,0.5)] bg-[rgba(232,181,77,0.1)]" style={{ color: GOLD }}>
            ACTIVE
          </span>
          <span className="font-mono text-slate-300">INC-2026-08-0411</span>
          <span className="ml-auto font-mono text-[10px] text-slate-500">8.4K events / 6m</span>
        </div>
        <p className="mt-2.5 text-sm leading-6 text-slate-200">
          <span className="font-semibold text-white">Lateral movement</span> detected on api.acme.ng — playbook
          <span className="text-gold-400"> IR-03</span> invoked, scope auto-contained.
        </p>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {["8.4K", "23", "4", "0"].map((v, i) => (
            <div key={i} className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-center">
              <p className="font-mono text-sm" style={{ color: GOLD }}>{v}</p>
              <p className="text-[9px] uppercase tracking-wider text-slate-500">phase {i + 1}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AlertsScene() {
  const CHANNELS = [
    { icon: <Mail size={16} />, label: "Email", pos: "left-[8%] top-[30%]" },
    { icon: <MessageCircle size={16} />, label: "WhatsApp", pos: "right-[8%] top-[30%]" },
    { icon: <Send size={16} />, label: "Telegram", pos: "left-1/2 -translate-x-1/2 bottom-[4%]" },
  ];
  return (
    <div className="relative flex h-80 w-full max-w-xl select-none items-center justify-center">
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div data-anim="pulse" className="absolute -inset-2 rounded-full border border-[rgba(232,181,77,0.5)]" />
        <div data-anim="pulse" className="absolute -inset-4 rounded-full border border-[rgba(232,181,77,0.35)]" />
        <div data-anim="pulse" className="absolute -inset-6 rounded-full border border-[rgba(232,181,77,0.2)]" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-lg border border-[rgba(232,181,77,0.5)] bg-[rgba(232,181,77,0.1)] shadow-[0_0_30px_rgba(232,181,77,0.35)]">
          <BellRing size={26} style={{ color: GOLD }} />
        </div>
      </div>

      {CHANNELS.map((c) => (
        <div key={c.label} className={cx("absolute flex flex-col items-center gap-1.5", c.pos)}>
          <div data-anim="chan" className="flex h-11 w-11 items-center justify-center rounded-md border border-white/15 bg-black/50" style={{ color: BLUE_LIGHT }}>
            {c.icon}
          </div>
          <span className="text-[10px] font-medium text-slate-300">{c.label}</span>
        </div>
      ))}
    </div>
  );
}

function AgentScene() {
  return (
    <div className="w-full max-w-xl select-none">
      <div className="relative overflow-hidden rounded-lg border border-white/10 bg-black/60 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]">
        <div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: GOLD }} />
          <span className="ml-2 font-mono text-[11px] text-slate-400">phantix-agent · session 8812</span>
          <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px]" style={{ color: GOLD }}>
            <span className="h-1.5 w-1.5 rounded-full animate-pulse-soft" style={{ background: GOLD }} /> approved
          </span>
        </div>

        <div className="space-y-1.5 px-4 py-4 font-mono text-xs">
          <p className="text-slate-500">$ scope --add api.acme.ng --auth org_8812</p>
          <p className="text-slate-300">{">"} engine  <span className="text-slate-100">web_recon</span> · skill minted · human approved</p>
          <p className="text-slate-300">{">"} plan    <span className="text-slate-100">nuclei · katana · sqlmap</span></p>
          <p className="flex items-center gap-2">
            <span data-anim="cursor" className="inline-block h-3.5 w-1.5" style={{ background: GOLD }} />
            <span data-anim="status" className="text-slate-200">correlating findings with asset graph…</span>
          </p>
        </div>

        <div className="relative h-1.5 bg-white/10">
          <div data-anim="beam" className="absolute inset-y-0 w-1/3" style={{ background: "linear-gradient(90deg, transparent, rgba(232,181,77,0.8), transparent)" }} />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div data-anim="orb" className="flex h-9 w-9 items-center justify-center rounded-md border border-white/15 bg-black/50" style={{ color: GOLD }}>
            <Cpu size={16} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-200">Autonomous investigation</p>
            <p className="text-[10px] text-slate-500">anonymized · governed · audited</p>
          </div>
        </div>
        <div className="flex gap-1.5">
          {["DeepSeek", "GPT", "Claude"].map((m) => (
            <span key={m} data-anim="consensus" className="rounded-full border border-white/15 bg-white/8 px-2 py-0.5 font-mono text-[10px] text-slate-300">{m}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function PipelineScene() {
  const STEPS = [
    { icon: <Crosshair size={14} />, label: "Recon", pos: "left-1/2 top-[3%] -translate-x-1/2" },
    { icon: <ScanSearch size={14} />, label: "Scan", pos: "right-[3%] top-1/2 -translate-y-1/2" },
    { icon: <Workflow size={14} />, label: "Correlate", pos: "left-1/2 bottom-[3%] -translate-x-1/2" },
    { icon: <BadgeCheck size={14} />, label: "Verify", pos: "left-[3%] top-1/2 -translate-y-1/2" },
  ];
  return (
    <div className="relative flex h-80 w-full max-w-xl select-none items-center justify-center">
      <div data-anim="ring" className="absolute h-72 w-72 rounded-full border border-[rgba(113,113,122,0.3)]" />
      <div data-anim="ring" className="absolute h-60 w-60 rounded-full border border-dashed border-[rgba(232,181,77,0.35)]" />
      <div
        data-anim="radar"
        className="absolute h-72 w-72 rounded-full"
        style={{ background: "conic-gradient(from 0deg at 50% 50%, rgba(113,113,122,0.28), transparent 75deg)" }}
      />
      <div className="relative flex h-36 w-36 items-center justify-center rounded-full bg-[#0a0a0a]/70 shadow-[0_0_45px_-10px_rgba(232,181,77,0.15)] ring-1 ring-[rgba(113,113,122,0.35)]">
        <BrandLogo
          lightSrc="/logo-white.png"
          darkSrc="/logo-white.png"
          className="h-24 w-24 object-contain"
        />
      </div>
      {STEPS.map((s) => (
        <div key={s.label} data-anim="node" className={cx("absolute flex items-center gap-2", s.pos)}>
          <span
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(232,181,77,0.5)] bg-[#0a0a0a] shadow-[0_0_18px_rgba(232,181,77,0.28)]"
            style={{ color: GOLD }}
          >
            {s.icon}
          </span>
          <span className="rounded-full border border-white/10 bg-black/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-200">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

function AgentBotScene() {
  return (
    <div className="relative flex h-80 w-full max-w-xl select-none items-center justify-center">
      <div data-anim="ring" className="absolute h-72 w-72 rounded-full border border-[rgba(113,113,122,0.3)]" />
      <div data-anim="pulse" className="absolute h-60 w-60 rounded-full border border-[rgba(232,181,77,0.2)]" />
      <div data-anim="pulse" className="absolute h-48 w-48 rounded-full border border-[rgba(232,181,77,0.4)]" />
      <LottiePlayer src="/animations/agent.json" className="relative h-56 w-72" loop speed={1.1} />
    </div>
  );
}

/* ── Slides ─────────────────────────────────────────────────────────────── */

const INSIGHTS: Insight[] = [
  {
    id: "discovery",
    icon: <Radar size={20} />,
    kicker: "Continuous asset discovery",
    title: "A security layer that watches and never sleeps.",
    body: "Every domain, API, repo and port you own is watched around the clock. Anything new or drifting gets scanned the moment it appears.",
    stat: { label: "assets tracked", value: 1284 },
    scene: <GlobeScene />,
  },
  {
    id: "soc",
    icon: <Activity size={20} />,
    kicker: "Security operations monitoring",
    title: "Your SOC, watching everything at once.",
    body: "Live sonar across APIs, web apps and databases. Every contact is a monitored service; anomalies surface instantly instead of weeks later.",
    stat: { label: "monitored endpoints", value: 926 },
    scene: <SonarScene />,
  },
  {
    id: "incident",
    icon: <Siren size={20} />,
    kicker: "Incident response",
    title: "Detect → triage → contain → recover.",
    body: "Playbooks move incidents along a governed timeline with ownership, scope and evidence at every phase — so a breach becomes a documented recovery.",
    stat: { label: "mean time to contain", value: 23 },
    scene: <IncidentScene />,
  },
  {
    id: "alerts",
    icon: <BellRing size={20} />,
    kicker: "Real-time alerting",
    title: "Critical findings, delivered in seconds.",
    body: "Verified alerts pulse to Email, WhatsApp and Telegram the instant they're confirmed — with dual-control for sensitive actions.",
    stat: { label: "median alert time", value: 9 },
    scene: <AlertsScene />,
  },
  {
    id: "agent",
    icon: <TerminalSquare size={20} />,
    kicker: "AI pentest agent",
    title: "An autonomous agent that earns its skills.",
    body: "The agent plans, scans and correlates with approved, anonymized skills — and a human reviews every step before anything is minted.",
    stat: { label: "remediation coverage", value: 85 },
    scene: <AgentScene />,
  },
  {
    id: "ai",
    icon: <Cpu size={20} />,
    kicker: "Phantix AI agent",
    title: "Phantix Agent — AI that never clocks out.",
    body: "Phantix Agent plans, scans and correlates across your assets around the clock — every action governed, audited and human-approved.",
    stat: { label: "coverage", value: 24 },
    scene: <AgentBotScene />,
  },
  {
    id: "vapt",
    icon: <FlaskConical size={20} />,
    kicker: "Full VAPT campaigns",
    title: "Recon → scan → correlate → verify.",
    body: "Approval-gated campaigns run the full pipeline across every engine, ending in staff-verified, board-ready findings.",
    stat: { label: "parallel jobs", value: 12 },
    scene: <PipelineScene />,
  },
];

type AnimHandle = { cancel: () => void };

function playScene(el: HTMLElement, scope: HTMLElement, id: string): AnimHandle[] {
  const handles: AnimHandle[] = [];

  const tl = createTimeline({ defaults: { ease: "outExpo" } });
  tl.add(el.querySelectorAll("[data-anim=text]"), { opacity: [0, 1], translateY: [18, 0], duration: 620 })
    .add(el.querySelectorAll("[data-anim=chip], [data-anim=row], [data-anim=node], [data-anim=chan]"), { opacity: [0, 1], translateY: [12, 0], duration: 460, delay: stagger(90) }, "-=400");
  handles.push(tl);

  const blips = Array.from(el.querySelectorAll<HTMLElement>("[data-anim=blip]"));
  if (blips.length) {
    blips.forEach((b, i) => {
      handles.push(animate(b, { scale: [0.7, 1.5], opacity: [1, 0.35], duration: 1300, delay: i * 380, loop: true, direction: "alternate", ease: "inOutQuad" }));
    });
  }

  const rings = Array.from(el.querySelectorAll<HTMLElement>("[data-anim=ring]"));
  if (rings.length) {
    rings.forEach((r, i) => {
      handles.push(animate(r, { scale: [0.9, 1.06], opacity: [0.6, 1], duration: 2000, delay: i * 250, loop: true, direction: "alternate", ease: "inOutSine" }));
    });
  }

  const pulses = Array.from(el.querySelectorAll<HTMLElement>("[data-anim=pulse]"));
  if (pulses.length) {
    pulses.forEach((p, i) => {
      handles.push(animate(p, { scale: [0.7, 1.5], opacity: [0.9, 0], duration: 1800, delay: i * 350, loop: true, ease: "outQuad" }));
    });
  }

  const waves = Array.from(el.querySelectorAll<SVGPathElement>("[data-anim=wave]"));
  if (waves.length) {
    waves.forEach((w, i) => {
      handles.push(animate(w, { strokeDashoffset: [120, 0], duration: 2200, delay: i * 260, loop: true, direction: "alternate", ease: "linear" }));
    });
  }

  const bars = Array.from(el.querySelectorAll<HTMLElement>("[data-anim=bar]"));
  if (bars.length) {
    bars.forEach((bar, i) => {
      handles.push(animate(bar, { width: `${bar.dataset.pct ?? 0}%`, duration: 900, delay: i * 120, ease: "outExpo" }));
    });
  }

  const contacts = el.querySelectorAll("[data-anim=contact]");
  if (contacts.length) {
    handles.push(animate(contacts, { scale: [0, 1], opacity: [0, 1], duration: 500, delay: stagger(160), ease: "outBack" }));
  }

  const consensus = el.querySelectorAll("[data-anim=consensus]");
  if (consensus.length) {
    handles.push(animate(consensus, { scale: [0.7, 1], opacity: [0, 1], duration: 500, delay: stagger(180), ease: "outBack" }));
  }

  if (id === "discovery") {
    const orbit = el.querySelector<HTMLElement>("[data-anim=orbit]");
    if (orbit) handles.push(animate(orbit, { rotate: [0, 360], duration: 14000, loop: true, ease: "linear" }));
    const magnifier = el.querySelector<HTMLElement>("[data-anim=magnifier]");
    if (magnifier) handles.push(animate(magnifier, { rotate: [0, -360], duration: 14000, loop: true, ease: "linear" }));
    const drift = el.querySelector<HTMLElement>("[data-anim=drift]");
    if (drift) handles.push(animate(drift, { backgroundPosition: ["0px 0px", "-26px 0px"], duration: 22000, loop: true, ease: "linear" }));
    const ma = el.querySelector<HTMLElement>("[data-anim=meridian-a]");
    if (ma) handles.push(animate(ma, { rotate: [0, 360], duration: 24000, loop: true, ease: "linear" }));
    const mb = el.querySelector<HTMLElement>("[data-anim=meridian-b]");
    if (mb) handles.push(animate(mb, { rotate: [360, 0], duration: 24000, loop: true, ease: "linear" }));
    const sweep = el.querySelector<HTMLElement>("[data-anim=sweep]");
    if (sweep) handles.push(animate(sweep, { rotate: [0, 360], duration: 5000, loop: true, ease: "linear" }));
  }

  if (id === "soc") {
    const radar = el.querySelector<HTMLElement>("[data-anim=radar]");
    if (radar) handles.push(animate(radar, { rotate: [0, 360], duration: 6000, loop: true, ease: "linear" }));
    const core = el.querySelector<HTMLElement>("[data-anim=core]");
    if (core) handles.push(animate(core, { scale: [1, 1.25], opacity: [1, 0.6], duration: 1500, loop: true, direction: "alternate", ease: "inOutSine" }));
  }

  if (id === "incident") {
    const track = el.querySelector<HTMLElement>("[data-anim=track]");
    if (track) {
      handles.push(
        animate(track, {
          left: ["0%", "88%"],
          duration: 7200,
          loop: true,
          direction: "alternate",
          ease: "inOutSine",
        }),
        animate(track, { backgroundColor: ["#e8b54d", "#71717a"], duration: 7200, loop: true, direction: "alternate", ease: "inOutSine" })
      );
    }
  }

  if (id === "agent") {
    const beam = el.querySelector<HTMLElement>("[data-anim=beam]");
    if (beam) handles.push(animate(beam, { left: ["-33%", "100%"], duration: 2600, loop: true, direction: "alternate", ease: "inOutSine" }));
    const orb = el.querySelector<HTMLElement>("[data-anim=orb]");
    if (orb) handles.push(animate(orb, { scale: [1, 1.12, 1], duration: 1600, loop: true, ease: "inOutSine" }));
    const cursor = el.querySelector<HTMLElement>("[data-anim=cursor]");
    if (cursor) handles.push(animate(cursor, { opacity: [1, 0, 1], duration: 900, loop: true, ease: "linear" }));
  }

  if (id === "vapt") {
    const radar = el.querySelector<HTMLElement>("[data-anim=radar]");
    if (radar) handles.push(animate(radar, { rotate: [0, 360], duration: 6000, loop: true, ease: "linear" }));
  }

  const stat = scope.querySelector<HTMLElement>("[data-anim=stat]");
  if (stat) {
    const target = Number(stat.dataset.count ?? 0);
    const o = { v: 0 };
    handles.push(
      animate(o, {
        v: target,
        duration: 1700,
        ease: "outExpo",
        onUpdate: () => { stat.textContent = o.v.toLocaleString(); },
      })
    );
  }
  return handles;
}

export default function AuthShowcase() {
  const [index, setIndex] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [paused, setPaused] = useState(false);
  const slide = INSIGHTS[index];

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const active = wrap.querySelector<HTMLElement>("[data-slide]");
    if (!active) return;
    const handles = playScene(active, wrap, slide.id);
    return () => handles.forEach((h) => h.cancel());
  }, [index, slide.id]);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % INSIGHTS.length), 9000);
    return () => clearInterval(t);
  }, [paused]);

  return (
    <div
      ref={wrapRef}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="relative hidden overflow-hidden bg-[linear-gradient(160deg,#18181b_0%,#0a0a0a_48%,#000000_100%)] text-slate-200 lg:flex lg:min-h-screen lg:flex-col"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-grid-faint bg-grid opacity-30 [mask-image:radial-gradient(ellipse_90%_80%_at_20%_10%,black,transparent)]" />
        <div className="absolute -left-32 top-1/4 h-[420px] w-[420px] rounded-full bg-[#3f3f46]/30 blur-[130px]" />
        <div className="absolute -bottom-24 right-0 h-[340px] w-[340px] rounded-full bg-[#e8b54d]/10 blur-[120px]" />
      </div>

      <header className="relative z-10 flex items-center gap-3 p-10 pb-6">
        <BrandLogo className="h-9 w-9 object-contain [filter:brightness(0)_invert(1)]" />
        <span className="font-display text-lg font-semibold text-white">Phantix Security</span>
      </header>

      <main className="relative z-10 grid flex-1 grid-cols-1 items-center gap-10 px-10 py-6 xl:grid-cols-[1.05fr_0.95fr] xl:gap-14">
        <div key={slide.id} data-slide className="flex min-h-[360px] items-center justify-center">
          {slide.scene}
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: GOLD }}>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e8b54d]/15" style={{ color: GOLD }}>{slide.icon}</span>
            {slide.kicker}
          </div>
          <h2 data-anim="text" className="max-w-xl font-display text-4xl font-bold leading-[1.1] text-white">{slide.title}</h2>
          <p data-anim="text" className="max-w-md text-[15px] leading-7 text-slate-300">{slide.body}</p>
        </div>
      </main>

      <footer className="relative z-10 flex items-center justify-between p-10 pt-6">
        <div className="flex items-center gap-2">
          {INSIGHTS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setIndex(i)}
              aria-label={s.kicker}
              className={cx(
                "h-1.5 rounded-full transition-all duration-300",
                i === index ? "w-8" : "w-1.5 bg-white/25 hover:bg-white/50"
              )}
              style={i === index ? { background: GOLD } : undefined}
            />
          ))}
        </div>
        <div className="flex items-center gap-2.5 font-mono text-[11px] text-slate-400">
          <span className="text-lg font-semibold" style={{ color: GOLD }}>
            <span data-anim="stat" data-count={slide.stat.value}>0</span>
          </span>
          <span className="uppercase tracking-wider">{slide.stat.label}</span>
        </div>
      </footer>
    </div>
  );
}
