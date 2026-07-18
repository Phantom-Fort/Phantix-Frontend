import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { publicApi, formLogin, formatApiError } from '@/lib/api'
import { toastError, toastSuccess } from '@/lib/toast'
import { useAuthStore } from '@/store/auth'
import { useThemeStore } from '@/store/theme'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { ChevronDown, ChevronRight } from 'lucide-react'

const INDUSTRIES = [
  'financial_services', 'fintech', 'banking', 'insurance', 'payments',
  'healthcare', 'technology', 'ecommerce', 'government', 'education',
  'telecommunications', 'energy', 'manufacturing', 'media', 'real_estate',
  'transportation', 'other',
]

const COMPANY_TYPES = [
  'private_limited', 'public_limited', 'llc', 'sole_proprietorship',
  'partnership', 'nonprofit', 'government_agency', 'other',
]

const EMPLOYEE_RANGES = [
  '1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001+',
]

const SECURITY_MATURITIES = [
  'initial', 'developing', 'defined', 'managed', 'optimized',
]

const COMPLIANCE_FRAMEWORKS = [
  'iso_27001', 'soc_2', 'pci_dss', 'gdpr', 'ndpr', 'hipaa', 'nist_csf', 'cis_controls', 'cbn_risk_based', 'swift_csp', 'iso_27701', 'other',
]

const TITLES = ['mr', 'mrs', 'ms', 'miss', 'dr', 'prof', 'eng', 'chief', 'other']

const COUNTRIES = [
  'NG', 'US', 'GB', 'CA', 'DE', 'FR', 'NL', 'AU', 'AE', 'SG', 'KE', 'ZA', 'GH',
  'IN', 'BR', 'MX', 'JP', 'CN', 'KR', 'IL',
]

export function RegisterPage() {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const { theme } = useThemeStore()
  const logoSrc = theme === 'dark' ? '/logo-white.png' : '/logo-transparent.png'

  const generateSlugFromName = (name: string) => {
    const base = name.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    return base || `company-${Date.now()}`
  }

  const [form, setForm] = useState({
    email: '',
    secondary_email: '',
    password: '',
    confirmPassword: '',
    name: '',
    industry: 'technology',
    company_type: 'private_limited',
    employee_count_range: '1-10',
    website: '',
    phone: '',
    country: 'NG',
    city: '',
    address_line1: '',
    state_province: '',
    security_maturity: 'initial',
    timezone: 'Africa/Lagos',
    compliance_frameworks: [] as string[],
    primary_contact_title: 'other',
    primary_contact_name: '',
    primary_contact_email: '',
    primary_contact_phone: '',
  })

  const update = (field: string, value: string | string[]) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const toggleFramework = (fw: string) => {
    setForm((prev) => ({
      ...prev,
      compliance_frameworks: prev.compliance_frameworks.includes(fw)
        ? prev.compliance_frameworks.filter((f) => f !== fw)
        : [...prev.compliance_frameworks, fw],
    }))
  }

  const registerMutation = useMutation({
    mutationFn: async () => {
      const slug = generateSlugFromName(form.name)
      const body = {
        email: form.email,
        secondary_email: form.secondary_email,
        password: form.password,
        name: form.name,
        slug: slug,
        industry: form.industry,
        company_type: form.company_type,
        employee_count_range: form.employee_count_range,
        website: form.website || undefined,
        phone: form.phone || undefined,
        country: form.country,
        city: form.city || undefined,
        address_line1: form.address_line1 || undefined,
        state_province: form.state_province || undefined,
        security_maturity: form.security_maturity,
        timezone: form.timezone,
        compliance_frameworks: form.compliance_frameworks.length > 0 ? form.compliance_frameworks : undefined,
        primary_contact: {
          title: form.primary_contact_title,
          name: form.primary_contact_name,
          email: form.primary_contact_email || form.email,
          phone: form.primary_contact_phone || form.phone || undefined,
        },
      }
      const { data } = await publicApi.post('/api/v1/organizations/register', body)
      return data
    },
    onSuccess: async () => {
      toastSuccess('Organization created! Logging you in and starting setup...')
      try {
        // Auto-login after registration to immediately show onboarding (privacy acceptance)
        const loginRes = await formLogin('/organizations/login', form.email, form.password)
        if (loginRes.data?.access_token) {
          useAuthStore.getState().setOrgAuth(loginRes.data.access_token)
          // Go straight to onboarding - privacy notice is first step. Force full refresh to avoid stale state.
          setTimeout(() => {
            window.location.href = '/onboarding'
          }, 300)
        } else {
          setTimeout(() => {
            window.location.href = '/login?registered=true'
          }, 1500)
        }
      } catch (e) {
        // Fallback to login page
        setTimeout(() => {
          window.location.href = '/login?registered=true'
        }, 1500)
      }
    },
    onError: (err: any) => {
      toastError(formatApiError(err, 'Registration failed. Check your input.'))
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirmPassword) {
      toastError('Passwords do not match')
      return
    }
    if (form.password.length < 8) {
      toastError('Password must be at least 8 characters')
      return
    }
    registerMutation.mutate()
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-muted/10 to-background p-6 py-8">
      <div className="mb-6 flex flex-col items-center">
        <div className="flex items-center gap-3">
          <img src={logoSrc} alt="Phantix" className="h-10 w-10 object-contain" />
          <span className="font-semibold text-2xl tracking-tighter">Phantix</span>
        </div>
        <div className="text-[10px] text-[#38BDF8] tracking-[2px] mt-0.5">PROTECT. PREVENT. PERFORM.</div>
      </div>
      <Card className="w-full max-w-xl shadow-2xl border-border/40">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-14 w-14 rounded-xl bg-brand-700 flex items-center justify-center">
            <span className="text-white text-2xl font-bold">P</span>
          </div>
          <CardTitle className="text-xl">Create Your Organization</CardTitle>
          <CardDescription>Set up your Phantix security platform account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Account */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground border-b pb-1">Account Credentials</h3>
               <div className="grid grid-cols-2 gap-3">
                 <div>
                   <label className="text-sm font-medium mb-1 block">Email *</label>
                   <Input type="email" required value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="admin@company.com" />
                 </div>
                 <div>
                   <label className="text-sm font-medium mb-1 block">Secondary Email *</label>
                   <Input type="email" required value={form.secondary_email} onChange={(e) => update('secondary_email', e.target.value)} placeholder="secondary@company.com" />
                 </div>
               </div>
               <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Password *</label>
                  <Input type="password" required value={form.password} onChange={(e) => update('password', e.target.value)} placeholder="Min 8 characters" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Confirm *</label>
                  <Input type="password" required value={form.confirmPassword} onChange={(e) => update('confirmPassword', e.target.value)} placeholder="Repeat password" />
                </div>
              </div>
            </div>

            {/* Company */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground border-b pb-1">Company Details</h3>
              <div>
                <label className="text-sm font-medium mb-1 block">Company Name *</label>
                <Input required value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Acme Corp" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Industry *</label>
                  <select value={form.industry} onChange={(e) => update('industry', e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm shadow-sm">
                    {INDUSTRIES.map((i) => <option key={i} value={i}>{i.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Company Type</label>
                  <select value={form.company_type} onChange={(e) => update('company_type', e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm shadow-sm">
                    {COMPANY_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Employee Count</label>
                  <select value={form.employee_count_range} onChange={(e) => update('employee_count_range', e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm shadow-sm">
                    {EMPLOYEE_RANGES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Website</label>
                  <Input value={form.website} onChange={(e) => update('website', e.target.value)} placeholder="https://acme.com" />
                </div>
              </div>
            </div>

            {/* Primary Contact */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground border-b pb-1">Primary Contact *</h3>
              <div className="grid grid-cols-2 gap-3">
                 <div>
                   <label className="text-sm font-medium mb-1 block">Title</label>
                   <select value={form.primary_contact_title} onChange={(e) => update('primary_contact_title', e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm shadow-sm">
                     {TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
                   </select>
                 </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Full Name *</label>
                  <Input required value={form.primary_contact_name} onChange={(e) => update('primary_contact_name', e.target.value)} placeholder="John Doe" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Contact Email</label>
                  <Input type="email" value={form.primary_contact_email} onChange={(e) => update('primary_contact_email', e.target.value)} placeholder="john@acme.com" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Phone</label>
                  <Input value={form.primary_contact_phone} onChange={(e) => update('primary_contact_phone', e.target.value)} placeholder="+234800000000" />
                </div>
              </div>
            </div>

            {/* Advanced Toggle */}
            <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-1 text-sm text-brand-700 hover:underline">
              {showAdvanced ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              {showAdvanced ? 'Hide optional fields' : 'Show optional fields'}
            </button>

            {showAdvanced && (
              <>
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground border-b pb-1">Address</h3>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Address Line 1</label>
                    <Input value={form.address_line1} onChange={(e) => update('address_line1', e.target.value)} placeholder="123 Main St" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-sm font-medium mb-1 block">City</label>
                      <Input value={form.city} onChange={(e) => update('city', e.target.value)} placeholder="Lagos" />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">State</label>
                      <Input value={form.state_province} onChange={(e) => update('state_province', e.target.value)} placeholder="Lagos" />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Country</label>
                      <select value={form.country} onChange={(e) => update('country', e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm shadow-sm">
                        {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground border-b pb-1">Security Profile</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Security Maturity</label>
                      <select value={form.security_maturity} onChange={(e) => update('security_maturity', e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm shadow-sm">
                        {SECURITY_MATURITIES.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Timezone</label>
                      <Input value={form.timezone} onChange={(e) => update('timezone', e.target.value)} placeholder="Africa/Lagos" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Compliance Frameworks</label>
                    <div className="flex flex-wrap gap-2">
                      {COMPLIANCE_FRAMEWORKS.map((fw) => (
                         <button key={fw} type="button" onClick={() => toggleFramework(fw)}
                           className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                             form.compliance_frameworks.includes(fw)
                               ? 'bg-brand-700 text-white border-brand-700'
                               : 'bg-background text-muted-foreground border-input hover:border-brand-300'
                           }`}>
                           {fw.replace(/_/g, ' ').toUpperCase()}
                         </button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}



            <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
              {registerMutation.isPending ? 'Creating organization...' : 'Create Organization'}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="text-brand-700 hover:underline font-medium">Sign in</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
