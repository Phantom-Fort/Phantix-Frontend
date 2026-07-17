import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
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

  const [form, setForm] = useState({ email: '', name: '' })

  const userPayload = {
    email: form.email || `${kind}-${Date.now()}@example.com`,
    password: 'UserPass456!',
    full_name: form.name || `${label} User`,
    title: defaultTitle,
    role: defaultRole,
    mfa_enabled: true,
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/org-users', userPayload)
      return data as { id: number; email?: string }
    },
    onSuccess: () => {
      // created
    },
  })

  const createdEmail = form.email || userPayload.email

  if (createMutation.isSuccess) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle2 className="h-5 w-5" />
          <p className="font-medium">{label} created</p>
        </div>
        <p className="text-sm text-muted-foreground">
          {label}: {createdEmail}
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
        Provide details for the {label.toLowerCase()}. Use a work email that matches your organization domain.
      </p>

      <div className="rounded-lg border p-4 space-y-3 max-w-md">
        <div className="font-medium text-sm flex items-center gap-2"><UserPlus className="h-4 w-4" /> {label}</div>
        <Input
          placeholder={`${kind}@company.com`}
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <Input
          placeholder="Full name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <div className="text-xs text-muted-foreground">Title: {defaultTitle} • Role: {defaultRole}</div>
      </div>

      {createMutation.isError && (
        <p className="text-sm text-destructive">Failed to create {label.toLowerCase()}. Try again.</p>
      )}

      <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
        {createMutation.isPending ? 'Creating...' : `Create ${label}`}
      </Button>
    </div>
  )
}
