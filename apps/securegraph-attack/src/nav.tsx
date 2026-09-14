import React from "react";
import { Crosshair, FileSignature, LayoutDashboard, Radar, Target } from "lucide-react";
import type { NavSection } from "@sg/shell/types";

/** Attack — offensive workflows. */
export const NAV: NavSection[] = [
  {
    label: "Scope",
    items: [
      { to: "/", label: "Overview", icon: <LayoutDashboard size={17} /> },
      { to: "/targets", label: "Targets", icon: <Target size={17} /> },
      { to: "/pentest-scope", label: "Pentest scope", icon: <FileSignature size={17} /> },
    ],
  },
  {
    label: "Test",
    items: [
      { to: "/vapt", label: "VAPT campaigns", icon: <Crosshair size={17} /> },
      { to: "/scans", label: "Web & API", icon: <Radar size={17} /> },
    ],
  },
];
