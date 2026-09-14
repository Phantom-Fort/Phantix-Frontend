import React, { useEffect, useState } from "react";
import { apiGet } from "@sg/shell/api";
import { APPLICATION_LABEL, type ApplicationKey } from "@sg/shell/types";

interface Card {
  key: ApplicationKey;
  label: string;
  tagline: string;
  description: string;
  capabilities: string[];
  accessible: boolean;
}
interface Snapshot {
  applications: Card[];
}

/** Landing page for an application shell; renders the backend launcher card. */
export default function Overview({ application }: { application: ApplicationKey }) {
  const [card, setCard] = useState<Card | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<Snapshot>("/app/auth/applications")
      .then((s) => setCard(s.applications.find((a) => a.key === application) ?? null))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [application]);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-2xl font-bold text-white">
        {APPLICATION_LABEL[application]} overview
      </h1>
      <p className="mt-1 text-sm text-slate-500">{card?.tagline ?? "Loading…"}</p>
      {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
      {card && (
        <>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">{card.description}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {card.capabilities.map((c) => (
              <span
                key={c}
                className="chip border-phantix-700 bg-phantix-900 text-[11px] text-slate-300"
              >
                {c}
              </span>
            ))}
          </div>
          <p className="mt-8 text-xs text-slate-600">
            Pages for this application are being migrated from the Command Centre. Use the
            Applications switcher to reach the others.
          </p>
        </>
      )}
    </div>
  );
}
