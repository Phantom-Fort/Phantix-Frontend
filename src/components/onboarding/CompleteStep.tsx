import { Button } from '@/components/ui/button'
import { ArrowRight, Rocket, Play, BarChart3, FileText, Shield } from 'lucide-react'

interface CompleteStepProps {
  onContinue?: () => void
}

export function CompleteStep({ onContinue }: CompleteStepProps) {
  const quickActions = [
    { href: '/discovery', icon: Play, label: 'Run Discovery', desc: 'Find assets automatically' },
    { href: '/vapt', icon: Shield, label: 'Plan VAPT', desc: 'Start a security campaign' },
    { href: '/reports', icon: FileText, label: 'Generate Report', desc: 'Create your first report' },
    { href: '/dashboard', icon: BarChart3, label: 'Dashboard', desc: 'View security overview' },
  ]

  return (
    <div className="flex flex-col items-center text-center space-y-6 py-4">
      <div className="h-20 w-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
        <Rocket className="h-10 w-10 text-green-600" />
      </div>
      <div>
        <h3 className="text-2xl font-semibold">Onboarding Complete!</h3>
        <p className="text-muted-foreground mt-2 max-w-md">
          Your organization is now fully configured in the Phantix Onboarding Framework. 
          You have privacy acceptance, verified identity, dual-control users, database, and your first asset.
        </p>
      </div>

      <div className="w-full max-w-lg">
        <div className="text-sm font-medium mb-3 text-left">Recommended next actions</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {quickActions.map((action, i) => (
            <a
              key={i}
              href={action.href}
              className="flex items-start gap-3 rounded-xl border p-4 hover:bg-accent transition-colors text-left group"
            >
              <action.icon className="h-5 w-5 mt-0.5 text-brand-700 group-hover:scale-110 transition" />
              <div>
                <div className="font-medium text-sm">{action.label}</div>
                <div className="text-xs text-muted-foreground">{action.desc}</div>
              </div>
              <ArrowRight className="ml-auto h-4 w-4 opacity-0 group-hover:opacity-100 transition" />
            </a>
          ))}
        </div>
      </div>

      <div className="pt-4">
        <Button size="lg" onClick={onContinue || (() => window.location.href = '/dashboard')}>
          Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
