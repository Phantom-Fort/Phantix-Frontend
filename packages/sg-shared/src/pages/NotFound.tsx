import React from "react";
import { useNavigate } from "react-router-dom";
import { Compass } from "lucide-react";
import { EmptyState } from "../ui";

export default function NotFound({ homePath = "/dashboard" }: { homePath?: string }) {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <EmptyState
        icon={<Compass size={22} />}
        title="Page not found"
        body="That link doesn't match anything here — it may be out of date or mistyped."
        action={
          <button onClick={() => navigate(homePath)} className="btn-primary">
            Back to dashboard
          </button>
        }
      />
    </div>
  );
}
