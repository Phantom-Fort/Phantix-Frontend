import { Button } from '@/components/ui/button'
import { ArrowRight, Shield, Zap, Users } from 'lucide-react'

interface WelcomeStepProps {
  onComplete: () => void
}

export function WelcomeStep({ onComplete }: WelcomeStepProps) {
  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto h-16 w-16 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
        <Shield className="h-8 w-8 text-brand-700" />
      </div>
      <div>
        <h2 className="text-2xl font-semibold">Welcome to Phantix</h2>
        <p className="mt-2 text-muted-foreground max-w-md mx-auto">
          Let's get your organization set up for security assessments in just a few minutes.
        </p>
      </div>

      <div className="grid gap-3 text-left max-w-md mx-auto">
        {[
          { icon: Shield, title: 'Privacy & Compliance', desc: 'Accept our policy and verify your email' },
          { icon: Users, title: 'Dual Control Setup', desc: 'Create initiator and authorizer users' },
          { icon: Zap, title: 'Connect & Scan', desc: 'Link your DB and add your first asset' },
        ].map((item, i) => (
          <div key={i} className="flex gap-3 rounded-lg border p-3">
            <item.icon className="h-5 w-5 mt-0.5 text-brand-700 shrink-0" />
            <div>
              <div className="font-medium text-sm">{item.title}</div>
              <div className="text-xs text-muted-foreground">{item.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <Button onClick={onComplete} className="w-full max-w-xs">
        Get Started <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
      <p className="text-xs text-muted-foreground">Takes ~5-10 minutes</p>
    </div>
  )
}
