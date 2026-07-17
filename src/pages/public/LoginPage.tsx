import { useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { formLogin, api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { useThemeStore } from '@/store/theme'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { MfaChallenge } from '@/components/auth/MfaChallenge'

export function LoginPage() {
  const [searchParams] = useSearchParams()
  const justRegistered = searchParams.get('registered') === 'true'
  const { theme } = useThemeStore()
  const logoSrc = theme === 'dark' ? '/logo-white.png' : '/logo-transparent.png'
  const [orgEmail, setOrgEmail] = useState('')
  const [orgPassword, setOrgPassword] = useState('')
  const [hasOrgSession, setHasOrgSession] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [userMfaToken, setUserMfaToken] = useState<string | null>(null)
  const [userCode, setUserCode] = useState('')
  const [mfaToken, setMfaToken] = useState<string | null>(null)
  const [mfaType, setMfaType] = useState<'org' | 'user'>('org')
  const [error, setError] = useState('')

  const orgLoginMutation = useMutation({
    mutationFn: async () => {
      const { data } = await formLogin('/organizations/login', orgEmail, orgPassword)
      return data
    },
    onSuccess: async (data) => {
      if (data.access_token) {
        useAuthStore.getState().setOrgAuth(data.access_token)
        if (justRegistered) {
          window.location.href = '/onboarding'
          return
        }
        setHasOrgSession(true)
        setError('')
      } else if (data.mfa_required && data.mfa_token) {
        setMfaType('org')
        setMfaToken(data.mfa_token)
      } else {
        setError(data.detail || 'Organization login failed')
      }
    },
    onError: (err: any) => {
      setError(err?.response?.data?.detail || 'Organization login failed. Check your credentials.')
    },
  })

  const userSigninMutation = useMutation({
    mutationFn: async () => {
      // Org user sign-in (access for viewers etc). Requires prior org session.
      const { data } = await api.post('/org-users/auth/login', { email: userEmail, purpose: 'access' })
      return data
    },
    onSuccess: async (data) => {
      if (data.access_token) {
        useAuthStore.getState().setOrgAuth(data.access_token)

        if (justRegistered) {
          window.location.href = '/onboarding'
          return
        }

        try {
          const { data: setup } = await api.get('/organizations/me/setup')
          if (!setup?.privacy_notice_accepted) {
            window.location.href = '/onboarding'
            return
          }
        } catch {}

        window.location.href = '/dashboard'
      } else if (data.mfa_required && data.mfa_token) {
        setUserMfaToken(data.mfa_token)
        setError('')
      } else {
        setError(data.detail || 'Sign in failed')
      }
    },
    onError: (err: any) => {
      setError(err?.response?.data?.detail || 'User sign in failed. Check your org email.')
    },
  })

  const userVerifyMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/org-users/auth/login/mfa', { mfa_token: userMfaToken, code: userCode })
      return data
    },
    onSuccess: (data) => {
      if (data.access_token) {
        useAuthStore.getState().setOrgAuth(data.access_token)
        setUserMfaToken(null)
        setUserCode('')
        if (justRegistered) {
          window.location.href = '/onboarding'
          return
        }
        window.location.href = '/dashboard'
      }
    },
    onError: (err: any) => {
      setError(err?.response?.data?.detail || 'Verification failed')
    },
  })

  const handleMfaSuccess = () => {
    if (mfaType === 'org') {
      setMfaToken(null)
      if (justRegistered) {
        window.location.href = '/onboarding'
        return
      }
      setHasOrgSession(true)
      setError('')
    } else {
      // For user MFA, the MfaChallenge already saved the token via its onSuccess
      // but ensure store is updated and force refresh to clear stale state
      useAuthStore.getState().checkAuth()
      setMfaToken(null)
      if (justRegistered) {
        window.location.href = '/onboarding'
        return
      }
      window.location.href = '/dashboard'
    }
  }

  if (mfaToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <MfaChallenge
          mfaToken={mfaToken}
          onSuccess={handleMfaSuccess}
          onBack={() => setMfaToken(null)}
          mfaEndpoint={mfaType === 'org' ? '/organizations/login/mfa' : '/org-users/auth/login/mfa'}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-muted/10 to-background p-6">
      <div className="mb-6 flex flex-col items-center">
        <img src={logoSrc} alt="Phantix" className="h-24 w-24 object-contain mb-2" />
        <span className="font-semibold text-2xl tracking-tighter">Phantix</span>
        <div className="text-[10px] text-[#38BDF8] tracking-[2px] mt-0.5">PROTECT. PREVENT. PERFORM.</div>
      </div>
      <Card className="w-full max-w-md shadow-2xl border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-2xl tracking-tight">Welcome back</CardTitle>
          <CardDescription>
            {hasOrgSession ? 'Sign in as your user (after org session)' : justRegistered ? 'Organization login to start setup wizard' : 'Organization login first'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasOrgSession ? (
            <>
              <div>
                <label className="text-sm font-medium mb-1 block">Organization Email</label>
                <Input
                  type="email"
                  placeholder="admin@company.com"
                  value={orgEmail}
                  onChange={(e) => setOrgEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Password</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={orgPassword}
                  onChange={(e) => setOrgPassword(e.target.value)}
                />
              </div>
              <div className="text-[10px] text-muted-foreground">
                Organization login (establishes org session). {justRegistered ? 'First sign-in after registration skips user sign-in to complete setup wizard.' : 'User sign-in (org user email + OTP) follows for future logins.'}
              </div>
              {justRegistered && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-3 text-sm text-green-700 dark:text-green-300">
                  Organization created successfully! Sign in with your credentials.
                </div>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                className="w-full"
                onClick={() => orgLoginMutation.mutate()}
                disabled={!orgEmail || !orgPassword || orgLoginMutation.isPending}
              >
                {orgLoginMutation.isPending ? 'Signing in...' : 'Organization Login'}
              </Button>
            </>
          ) : (
            <>
              <div className="text-xs bg-muted/50 p-2 rounded">Organization session established. Now sign in with your org email.</div>
              <div>
                <label className="text-sm font-medium mb-1 block">Your Org Email (provide at sign-in, do not auto-fill)</label>
                <Input
                  type="email"
                  placeholder="your@company.com"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  disabled={!!userMfaToken}
                />
              </div>
              {userMfaToken ? (
                <>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Verification Code (OTP sent to your email)</label>
                    <Input
                      value={userCode}
                      onChange={(e) => setUserCode(e.target.value)}
                      maxLength={6}
                      placeholder="000000"
                    />
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Enter the code to complete sign in. (Dev-OTP will be disabled soon.)
                  </div>
                </>
              ) : (
                <div className="text-[10px] text-muted-foreground">
                  Email verification required. Click send to receive OTP.
                </div>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { 
                  setHasOrgSession(false); 
                  setError(''); 
                  setUserEmail(''); 
                  setUserMfaToken(null); 
                  setUserCode(''); 
                }} className="flex-1">Back</Button>
                {!userMfaToken ? (
                  <Button
                    className="flex-1"
                    onClick={() => userSigninMutation.mutate()}
                    disabled={!userEmail || userSigninMutation.isPending}
                  >
                    {userSigninMutation.isPending ? 'Sending code...' : 'Send verification code'}
                  </Button>
                ) : (
                  <Button
                    className="flex-1"
                    onClick={() => userVerifyMutation.mutate()}
                    disabled={userCode.length < 4 || userVerifyMutation.isPending}
                  >
                    {userVerifyMutation.isPending ? 'Verifying...' : 'Verify code'}
                  </Button>
                )}
              </div>
            </>
          )}
          <p className="text-center text-sm text-muted-foreground">
            Don't have an organization?{' '}
            <Link to="/register" className="text-brand-700 hover:underline font-medium">Create one</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
