import React from "react";
import { Activity, AlertTriangle, Boxes, Cloud, Fingerprint, Scale, ShieldAlert, ShieldCheck } from "lucide-react";
import type { NavSection } from "@sg/shell/types";

/** Defend — defensive posture and continuous assurance. */
export const NAV: NavSection[] = [
  {
    label: "Posture",
    items: [
      { to: "/", label: "Overview", icon: <Activity size={17} /> },
      { to: "/assets", label: "Assets", icon: <Boxes size={17} /> },
      { to: "/posture", label: "Exposure", icon: <ShieldCheck size={17} /> },
    ],
  },
  {
    label: "Continuous",
    items: [
      { to: "/cloud", label: "Cloud posture", icon: <Cloud size={17} /> },
      { to: "/compliance", label: "Compliance", icon: <Scale size={17} /> },
      { to: "/risks", label: "Risk register", icon: <ShieldAlert size={17} /> },
    ],
  },
  {
    label: "Operate",
    items: [
      { to: "/soc", label: "SOC", icon: <Activity size={17} /> },
      { to: "/threat-intel", label: "Threat intel", icon: <Fingerprint size={17} /> },
      { to: "/alerts", label: "Incidents", icon: <AlertTriangle size={17} /> },
    ],
  },
];
