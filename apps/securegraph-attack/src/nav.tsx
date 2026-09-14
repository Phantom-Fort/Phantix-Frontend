import React from "react";
import {
  BookOpen,
  Bot,
  CalendarClock,
  Crosshair,
  FileSignature,
  LayoutDashboard,
  Radar,
  SlidersHorizontal,
  Target,
} from "lucide-react";
import type { NavSection } from "@sg/shell/types";

/** Attack — offensive workflows. */
export const NAV: NavSection[] = [
  {
    label: "Scope",
    items: [
      { to: "/", label: "Overview", icon: <LayoutDashboard size={17} /> },
      { to: "/targets", label: "Targets", icon: <Target size={17} /> },
      { to: "/pentest-scope", label: "Pentest scope", icon: <FileSignature size={17} /> },
      { to: "/pentest-agent", label: "Pentest agent", icon: <Bot size={17} /> },
    ],
  },
  {
    label: "Test",
    items: [{ to: "/scans", label: "Web & API", icon: <Radar size={17} /> }],
  },
  {
    label: "VAPT",
    items: [
      { to: "/vapt", label: "Campaigns", icon: <Crosshair size={17} /> },
      { to: "/vapt/schedules", label: "Schedules", icon: <CalendarClock size={17} /> },
      { to: "/vapt/procedures", label: "Procedures & rules", icon: <BookOpen size={17} /> },
      { to: "/vapt/settings", label: "Engine settings", icon: <SlidersHorizontal size={17} /> },
    ],
  },
  {
    label: "Help",
    items: [
      { to: "/assistant", label: "Assistant", icon: <Bot size={17} /> },
      { to: "/docs", label: "Documentation", icon: <BookOpen size={17} /> },
    ],
  },
];
