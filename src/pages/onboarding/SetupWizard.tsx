import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { SubPageNav } from '@/components/shared/SubPageNav'
import { WelcomeStep } from '@/components/onboarding/WelcomeStep'
import { PrivacyStep } from '@/components/onboarding/PrivacyStep'
import { OtpStep } from '@/components/onboarding/OtpStep'
import { ExplainDualStep } from '@/components/onboarding/ExplainDualStep'
import { CreateUsersStep } from '@/components/onboarding/CreateUsersStep'
import { DualControlStep } from '@/components/onboarding/DualControlStep'
import { UnlockInitiatorStep } from '@/components/onboarding/UnlockInitiatorStep'
import { DbConnectionStep } from '@/components/onboarding/DbConnectionStep'
import { FirstAssetStep } from '@/components/onboarding/FirstAssetStep'
import { CompleteStep } from '@/components/onboarding/CompleteStep'
import { CheckCircle2, Circle, ArrowLeft, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useState, useEffect } from 'react'

const STEPS = [
  { key: 'welcome', label: 'Welcome' },
  { key: 'privacy', label: 'Privacy Policy' },
  { key: 'otp', label: 'Email Verification' },
  { key: 'explain', label: 'Two-Person Control' },
  { key: 'create_initiator', label: 'Create Initiator' },
  { key: 'create_authorizer', label: 'Create Authorizer' },
  { key: 'review', label: 'Review & Assign' },
  { key: 'unlock', label: 'Unlock as Initiator' },
  { key: 'db', label: 'Security Database' },
  { key: 'asset', label: 'First Asset' },
]

export function SetupWizard() {
  const { data: setup, isLoading, refetch } = useQuery({
    queryKey: ['org', 'setup'],
    queryFn: async () => {
      const { data } = await api.get('/organizations/me/setup')
      return data as {
        privacy_notice_accepted: boolean
        email_verified: boolean
        dual_control_configured: boolean
        security_db_connected: boolean
        has_assets: boolean
        completed_steps: string[]
        next_step: string
      }
    },
  })

  const getInitialStep = () => {
    if (!setup) return 0
    // Always start at the first pending setup step.
    // If privacy not accepted (new org), it will be the privacy step.
    // If already accepted, skip it and move to other pending setups.
    const hasDc = typeof sessionStorage !== 'undefined' && !!sessionStorage.getItem('dc_session')
    const completedMap: Record<string, boolean> = {
      welcome: true,
      privacy: setup.privacy_notice_accepted ?? false,
      otp: setup.email_verified ?? false,
      explain: setup.dual_control_configured ?? false,
      create_initiator: setup.completed_steps?.includes('users') ?? false,
      create_authorizer: setup.completed_steps?.includes('users') ?? false,
      review: setup.dual_control_configured ?? false,
      unlock: (setup.dual_control_configured && hasDc) ?? false,
      db: setup.security_db_connected ?? false,
      asset: setup.has_assets ?? false,
    }
    const idx = STEPS.findIndex((s) => !completedMap[s.key])
    return idx === -1 ? STEPS.length - 1 : idx
  }

  const [activeStep, setActiveStep] = useState(0)

  const hasDcSession = typeof sessionStorage !== 'undefined' && !!sessionStorage.getItem('dc_session')
  const completed: Record<string, boolean> = {
    welcome: true,
    privacy: setup?.privacy_notice_accepted ?? false,
    otp: setup?.email_verified ?? false,
    explain: setup?.dual_control_configured ?? false,
    create_initiator: setup?.completed_steps?.includes('users') ?? false,
    create_authorizer: setup?.completed_steps?.includes('users') ?? false,
    review: setup?.dual_control_configured ?? false,
    unlock: (setup?.dual_control_configured && hasDcSession) ?? false,
    db: setup?.security_db_connected ?? false,
    asset: setup?.has_assets ?? false,
  }

  const findNextIncomplete = (): number => {
    const idx = STEPS.findIndex((s) => !completed[s.key])
    return idx === -1 ? STEPS.length - 1 : idx
  }

  // Update active step when setup data arrives
  useEffect(() => {
    if (setup) {
      const idx = getInitialStep()
      setActiveStep(idx)
    }
  }, [setup])

  // Defensive: never stay on privacy step if already accepted
  useEffect(() => {
    if (setup && activeStep === 1 && completed.privacy) {
      const next = findNextIncomplete()
      if (next !== activeStep) setActiveStep(next)
    }
  }, [activeStep, setup, completed.privacy])

  const progress = Math.round(
    (STEPS.filter((s) => completed[s.key]).length / STEPS.length) * 100
  )

  const goToStep = (idx: number) => {
    const step = STEPS[idx]
    // Never re-visit privacy acceptance once done
    if (step.key === 'privacy' && completed.privacy) {
      return
    }
    const lastCompleted = STEPS.reduce((acc, s, i) => (completed[s.key] ? i : acc), -1)
    // Allow going to completed steps or sequential forward one at a time (for sub-steps)
    const maxAllowed = Math.max(lastCompleted + 1, activeStep + 1)
    if (idx <= maxAllowed) {
      setActiveStep(idx)
    }
  }

  const advance = () => {
    refetch()
    const nextIndex = Math.min(activeStep + 1, STEPS.length - 1)
    setActiveStep(nextIndex)
  }

  const goBack = () => {
    let prev = activeStep - 1
    // Skip privacy step backwards if already accepted
    if (prev === 1 && completed.privacy) prev = 0
    if (prev >= 0) setActiveStep(prev)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading setup status...</p>
      </div>
    )
  }

  const allDone = STEPS.every((s) => completed[s.key])

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Organization Onboarding</h1>
          <p className="text-muted-foreground">Complete this framework to fully activate your Phantix workspace</p>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium">{progress}% complete</div>
          <div className="h-2 w-32 bg-muted rounded overflow-hidden mt-1">
            <div className="h-full bg-brand-700 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <SubPageNav items={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Assets', to: '/assets' }]} />

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* Enhanced Stepper */}
        <nav className="space-y-1">
             {STEPS.map((step, i) => {
            const done = completed[step.key]
            const isActive = activeStep === i
            const firstIncomplete = STEPS.findIndex((s) => !completed[s.key])
            let canNavigate = done || i <= firstIncomplete + 1 || i <= activeStep + 1
            // Prevent navigating back to privacy once accepted
            if (step.key === 'privacy' && done) canNavigate = false
            return (
              <button
                key={step.key}
                onClick={() => goToStep(i)}
                disabled={!canNavigate}
                className={cn(
                  'group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition-all',
                  isActive && 'bg-brand-50 ring-1 ring-brand-200 text-brand-700 dark:bg-brand-900/40 dark:ring-brand-800 dark:text-white',
                  !isActive && canNavigate && 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  !canNavigate && 'opacity-50 cursor-not-allowed',
                )}
              >
                <div className="shrink-0">
                  {done ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <Circle className={cn('h-5 w-5', isActive && 'text-brand-700')} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={cn('font-medium', done && 'line-through decoration-green-600/40')}>{step.label}</div>
                  <div className="text-[10px] text-muted-foreground/70 group-hover:text-muted-foreground">
                   {i === 0 && 'Get started'}
                   {i === 1 && 'Legal & compliance'}
                   {i === 2 && 'Secure your account'}
                   {i === 3 && 'Explain two-person control'}
                   {i === 4 && 'Create Initiator'}
                   {i === 5 && 'Create Authorizer'}
                   {i === 6 && 'Review → assign'}
                   {i === 7 && 'Unlock (OTP)'}
                   {i === 8 && 'Data storage'}
                   {i === 9 && 'Kickoff monitoring'}
                  </div>
                </div>
              </button>
            )
          })}
        </nav>

        {/* Step Content - Comprehensive Framework Style */}
        <Card className="shadow-sm">
          <CardContent className="p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                  Step {activeStep + 1} of {STEPS.length}
                </div>
                <div className="text-xl font-semibold mt-1">{STEPS[activeStep].label}</div>
              </div>
              <div className="flex gap-2">
                {activeStep > 0 && (
                  <Button variant="ghost" size="sm" onClick={goBack}>
                    <ArrowLeft className="h-4 w-4 mr-1" /> Back
                  </Button>
                )}
                {!allDone && activeStep < STEPS.length - 1 && completed[STEPS[activeStep].key] && (
                  <Button variant="outline" size="sm" onClick={() => setActiveStep(activeStep + 1)}>
                    Skip for now <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>
            </div>

            {allDone ? (
              <CompleteStep />
            ) : activeStep === 0 ? (
              <WelcomeStep onComplete={advance} />
            ) : activeStep === 1 ? (
              <PrivacyStep onComplete={advance} accepted={completed.privacy} />
            ) : activeStep === 2 ? (
              <OtpStep onComplete={advance} verified={completed.otp} />
            ) : activeStep === 3 ? (
              <ExplainDualStep onComplete={advance} />
            ) : activeStep === 4 ? (
              <CreateUsersStep kind="initiator" onComplete={advance} />
            ) : activeStep === 5 ? (
              <CreateUsersStep kind="authorizer" onComplete={advance} />
            ) : activeStep === 6 ? (
              <DualControlStep onComplete={advance} configured={completed.review} />
            ) : activeStep === 7 ? (
              <UnlockInitiatorStep onComplete={advance} />
            ) : activeStep === 8 ? (
              <DbConnectionStep onComplete={advance} connected={completed.db} />
            ) : activeStep === 9 ? (
              <FirstAssetStep onComplete={advance} />
            ) : (
              <p className="text-muted-foreground">Select a step.</p>
            )}

            {/* Framework footer */}
            {!allDone && (
              <div className="mt-8 pt-6 border-t text-xs text-muted-foreground flex items-center justify-between">
                <span>Phantix Onboarding Framework</span>
                <span>Progress saved automatically</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
