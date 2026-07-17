import { Button } from '@/components/ui/button'
import { ArrowRight, Shield } from 'lucide-react'

interface ExplainDualStepProps {
  onComplete: () => void
}

export function ExplainDualStep({ onComplete }: ExplainDualStepProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-brand-700" />
        <h3 className="text-lg font-semibold">Two-Person Control (Dual Control)</h3>
      </div>

      <p className="text-sm text-muted-foreground">
        Dual-control requires two different people for sensitive operations: an <strong>Initiator</strong> who proposes or performs the action, and an <strong>Authorizer</strong> who reviews and approves it.
      </p>

      <div className="grid gap-3 text-sm">
        <div className="rounded border p-3">
          <div className="font-medium">Initiator</div>
          <div className="text-muted-foreground">Proposes changes, starts scans, adds assets, etc. Their action is recorded but not executed until authorized.</div>
        </div>
        <div className="rounded border p-3">
          <div className="font-medium">Authorizer</div>
          <div className="text-muted-foreground">Reviews the pending action and authorizes (or rejects) it. Must be a different person.</div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">This protects your organization. You will create two users next, assign the roles, then unlock as the initiator to enable writes.</p>

      <Button onClick={onComplete} className="w-full max-w-xs">
        I understand — Continue <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  )
}
