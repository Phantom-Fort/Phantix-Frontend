import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';

export function ApprovalNotice({
  count = 1,
  stateChanging = true,
  authorizationsHref,
  dense = false,
}: {
  count?: number;
  stateChanging?: boolean;
  authorizationsHref?: string;
  dense?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-start"
    >
      <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2.5">
        <ShieldCheck className="mt-0.5 h-5 w-5 text-amber-400" />
        <div>
          <p className="font-semibold text-amber-200">
            Paused — awaiting authorization{count > 1 ? ` (${count} steps)` : ''}
          </p>
          <p className="text-xs text-slate-400">
            {stateChanging
              ? authorizationsHref
                ? 'Ask an authorizer to approve it in the Authorizations queue.'
                : 'Review and decide it in the Human gate.'
              : 'This step is held pending approval.'}
          </p>
          {authorizationsHref && (
            <a href={authorizationsHref} className="text-xs text-gold-300 underline">
              Open Authorizations queue →
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}
