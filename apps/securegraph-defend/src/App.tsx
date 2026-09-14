import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ApplicationShell } from "@sg/shell/ApplicationShell";
import type { ApplicationKey } from "@sg/shell/types";
import { HOSTS } from "./hosts";
import { NAV } from "./nav";
import Overview from "./pages/Overview";

export default function App() {
  return (
    <Routes>
      <Route
        element={
          <ApplicationShell
            application={"defend" as ApplicationKey}
            subtitle="Defend"
            nav={NAV}
            hosts={HOSTS}
          />
        }
      >
        <Route path="/" element={<Overview application={"defend" as ApplicationKey} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
