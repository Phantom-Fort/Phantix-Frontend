import React from "react";
import { Crosshair, FileSignature, Radar, ShieldAlert, Smartphone, Target } from "lucide-react";
import type { NavSection } from "@sg/shell/types";

/** Attack — offensive workflows. */
export const NAV: NavSection[] = [
  {
    label: "Scope",
    items: [
      { to: "/", label: "Overview", icon: <Crosshair size={17} /> },
      { to: "/targets", label: "Targets", icon: <Target size={17} /> },
      { to: "/pentest-scope", label: "Pentest scope", icon: <FileSignature size={17} /> },
    ],
  },
  {
    label: "Test",
    items: [
      { to: "/vapt", label: "VAPT campaigns", icon: <Crosshair size={17} /> },
      { to: "/scans", label: "Web & API", icon: <Radar size={17} /> },
      { to: "/mobile", label: "Mobile", icon: <Smartphone size={17} /> },
    ],
  },
  {
    label: "Findings",
    items: [{ to: "/findings", label: "Vulnerabilities", icon: <ShieldAlert size={17} /> }],
  },
];
