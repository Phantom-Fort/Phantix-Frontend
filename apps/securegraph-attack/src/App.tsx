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
            application={"attack" as ApplicationKey}
            subtitle="Attack"
            nav={NAV}
            hosts={HOSTS}
          />
        }
      >
        <Route path="/" element={<Overview application={"attack" as ApplicationKey} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
