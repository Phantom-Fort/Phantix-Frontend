import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api, clearDcSession, formatApiError, isDualControlConfigured } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CheckCircle2, ArrowRight, UserPlus } from 'lucide-react'

interface CreateUsersStepProps {
  onComplete: () => void
  kind: 'initiator' | 'authorizer'
}

export function CreateUsersStep({ onComplete, kind }: CreateUsersStepProps) {
  const isInitiator = kind === 'initiator'
  const label = isInitiator ? 'Initiator' : 'Authorizer'
  const defaultTitle = isInitiator ? 'IT Admin' : 'CISO'
  const defaultRole = isInitiator ? 'operator' : 'security_admin'

  const [form, setForm] = useState({ email: '', name: '', password: 'TempPass123!' })
  const [error, setError] = useState('')

  const createMutation = useMutation({
    mutationFn: async () => {
      // Bootstrap: company JWT only — never dual-control session (doc Phase 1)
      if (!isDualControlConfigured()) {
        clearDcSession()
      }
      const email = form.email.trim()
      const full_name = form.name.trim()
      if (!email || !full_name) {
        throw new Error('Email and full name are required')
      }
      const { data } = await api.post(
        '/org-users',
        {
          email,
          password: form.password || 'TempPass123!',
          full_name,
          title: defaultTitle,
          role: defaultRole,
          mfa_enabled: true,
        },
        { _skipDc: true } as any,
      )
      return data as { id: number; email?: string }
    },
    onSuccess: (data) => {
      setError('')
      try {
        const key = kind === 'initiator' ? 'phantix_wizard_initiator_id' : 'phantix_wizard_authorizer_id'
        if (data?.id) sessionStorage.setItem(key, String(data.id))
        if (data?.email || form.email) {
          sessionStorage.setItem(
            kind === 'initiator' ? 'phantix_wizard_initiator_email' : 'phantix_wizard_authorizer_email',
            data?.email || form.email.trim(),
          )
        }
      } catch { /* ignore */ }
    },
    onError: (err: any) => {
      setError(formatApiError(err, `Failed to create ${label.toLowerCase()}`))
    },
  })

  if (createMutation.isSuccess) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle2 className="h-5 w-5" />
          <p className="font-medium">{label} created</p>
        </div>
        <p className="text-sm text-muted-foreground">
          {label}: {form.email.trim()}
        </p>
        <Button onClick={onComplete} variant="outline">
          Continue <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <h3 className="text-lg font-semibold">Create {label}</h3>
      <p className="text-sm text-muted-foreground">
        Use a work email on your organization domain. Day-to-day login is email OTP (not this password).
      </p>

      <div className="rounded-lg border p-4 space-y-3 max-w-md">
        <div className="font-medium text-sm flex items-center gap-2">
          <UserPlus className="h-4 w-4" /> {label}
        </div>
        <Input
          type="email"
          placeholder={`${kind}@company.com`}
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <Input
          placeholder="Full name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <Input
          type="password"
          placeholder="Temp password (directory only)"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <div className="text-xs text-muted-foreground">
          Title: {defaultTitle} • Role: {defaultRole}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        onClick={() => createMutation.mutate()}
        disabled={createMutation.isPending || !form.email.trim() || !form.name.trim()}
      >
        {createMutation.isPending ? 'Creating...' : `Create ${label}`}
      </Button>
    </div>
  )
}
