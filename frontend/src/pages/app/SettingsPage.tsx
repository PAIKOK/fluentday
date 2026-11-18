import { useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Bell, Globe2, GraduationCap, UserRound, X, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Alert } from '@/components/common/Alert'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Label, Select } from '@/components/ui/input'
import { useAuth } from '@/features/auth/AuthContext'
import { disablePush, enablePush, pushSupport } from '@/features/notifications/push'
import { useApiQuery } from '@/hooks/useApiQuery'
import { api, errorMessage } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { Profile } from '@/types/auth'
import type { PushConfig } from '@/types/notifications'
import type { ProficiencyLevel } from '@/types/learning'

const LEVELS: { value: ProficiencyLevel; label: string; hint: string }[] = [
  { value: 'beginner', label: 'Beginner', hint: 'I know basic everyday words.' },
  { value: 'intermediate', label: 'Intermediate', hint: 'I can hold simple conversations.' },
  { value: 'advanced', label: 'Advanced', hint: 'I want precise, richer vocabulary.' },
]

const SUGGESTED_GOALS = ['Speak confidently at work', 'Prepare for job interviews', 'Travel abroad', 'Pass an English exam', 'Understand films and series']

function timezones(current: string): string[] {
  const list = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []
  return list.includes(current) ? list : [current, ...list]
}

export function SettingsPage() {
  const { me, setProfile } = useAuth()
  const [params] = useSearchParams()
  const [form, setForm] = useState<Profile>(me!.profile)
  const [goalDraft, setGoalDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const zones = useMemo(() => timezones(form.timezone), [form.timezone])
  const welcome = params.get('welcome') === '1' && !me!.profile.proficiency_level

  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setResult(null)
  }

  function addGoal(goal: string) {
    const clean = goal.trim()
    if (!clean || form.learning_goals.includes(clean) || form.learning_goals.length >= 5) return
    update('learning_goals', [...form.learning_goals, clean])
    setGoalDraft('')
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    try {
      const saved = await api<Profile>('/profile', { method: 'PATCH', json: form })
      setProfile(saved)
      setForm(saved)
      setResult({ tone: 'success', text: 'Your settings have been saved.' })
    } catch (e) {
      setResult({ tone: 'error', text: errorMessage(e) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader eyebrow="Settings" title="Make FluentDay yours" description={me!.user.email} />
      {welcome && (
        <Alert tone="success" className="mb-6">
          Your email is confirmed — welcome to FluentDay! Choose your level so we can pick the right words for you.
        </Alert>
      )}
      <form onSubmit={onSubmit} className="space-y-6">
        <Section icon={UserRound} title="Profile">
          <Label htmlFor="full_name">Your name</Label>
          <Input id="full_name" maxLength={80} required value={form.full_name} onChange={(e) => update('full_name', e.target.value)} />
        </Section>

        <Section icon={GraduationCap} title="Learning">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">English level</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {LEVELS.map((level) => (
                <label
                  key={level.value}
                  className={cn(
                    'cursor-pointer rounded-xl p-4 ring-1 transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring',
                    form.proficiency_level === level.value ? 'bg-sage-50 ring-forest' : 'bg-ivory ring-border hover:bg-muted',
                  )}
                >
                  <input
                    type="radio"
                    name="level"
                    className="sr-only"
                    checked={form.proficiency_level === level.value}
                    onChange={() => update('proficiency_level', level.value)}
                  />
                  <span className="block text-sm font-semibold">{level.label}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{level.hint}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-6">
            <legend className="mb-2 text-sm font-medium">Pronunciation</legend>
            <div className="inline-flex rounded-full bg-muted p-1">
              {(['british', 'american'] as const).map((accent) => (
                <label
                  key={accent}
                  className={cn(
                    'cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium has-focus-visible:ring-2 has-focus-visible:ring-ring',
                    form.accent === accent ? 'bg-card text-forest shadow-soft' : 'text-muted-foreground',
                  )}
                >
                  <input type="radio" name="accent" className="sr-only" checked={form.accent === accent} onChange={() => update('accent', accent)} />
                  {accent === 'british' ? 'British English' : 'American English'}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mt-6">
            <Label htmlFor="goal">Learning goals <span className="font-normal text-muted-foreground">(up to 5)</span></Label>
            {form.learning_goals.length > 0 && (
              <ul className="mb-3 flex flex-wrap gap-2">
                {form.learning_goals.map((goal) => (
                  <li key={goal} className="flex items-center gap-1 rounded-full bg-sage-50 py-1 pl-3 pr-1 text-sm ring-1 ring-sage">
                    {goal}
                    <button
                      type="button"
                      onClick={() => update('learning_goals', form.learning_goals.filter((g) => g !== goal))}
                      className="rounded-full p-1 hover:bg-sage"
                      aria-label={`Remove goal: ${goal}`}
                    >
                      <X className="size-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <Input
                id="goal"
                maxLength={80}
                placeholder="e.g. Speak confidently in meetings"
                value={goalDraft}
                disabled={form.learning_goals.length >= 5}
                onChange={(e) => setGoalDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addGoal(goalDraft)
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={() => addGoal(goalDraft)} disabled={!goalDraft.trim() || form.learning_goals.length >= 5}>
                Add
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGGESTED_GOALS.filter((g) => !form.learning_goals.includes(g)).map((goal) => (
                <button
                  key={goal}
                  type="button"
                  disabled={form.learning_goals.length >= 5}
                  onClick={() => addGoal(goal)}
                  className="rounded-full px-3 py-1 text-xs text-muted-foreground ring-1 ring-border hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  + {goal}
                </button>
              ))}
            </div>
          </div>
        </Section>

        <Section icon={Bell} title="Reminders & notifications">
          <div className="max-w-xs">
            <Label htmlFor="reminder_time">Daily reminder time</Label>
            <Input id="reminder_time" type="time" required value={form.reminder_time} onChange={(e) => update('reminder_time', e.target.value)} />
          </div>
          <div className="mt-5 space-y-3">
            <Toggle
              label="In-app notifications"
              hint="A reminder inside FluentDay when your lesson is ready."
              checked={form.notifications.in_app}
              onChange={(v) => update('notifications', { ...form.notifications, in_app: v })}
            />
            <Toggle
              label="Email reminders"
              hint="A short daily email at your reminder time. You can unsubscribe at any time."
              checked={form.notifications.email}
              onChange={(v) => update('notifications', { ...form.notifications, email: v })}
            />
            <PushToggle
              checked={form.notifications.push}
              onChanged={(push) => setForm((f) => ({ ...f, notifications: { ...f.notifications, push } }))}
            />
          </div>
        </Section>

        <Section icon={Globe2} title="Region">
          <div className="max-w-sm">
            <Label htmlFor="timezone">Timezone</Label>
            <Select id="timezone" value={form.timezone} onChange={(e) => update('timezone', e.target.value)}>
              {zones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone.replaceAll('_', ' ')}
                </option>
              ))}
            </Select>
            <p className="mt-1.5 text-xs text-muted-foreground">Each new lesson starts at midnight in this timezone.</p>
          </div>
        </Section>

        <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-2xl bg-card/95 p-4 shadow-lift ring-1 ring-border backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          {result ? <Alert tone={result.tone} className="flex-1">{result.text}</Alert> : <span className="text-sm text-muted-foreground">Changes are saved to your account.</span>}
          <Button type="submit" disabled={saving || !form.full_name.trim()}>
            {saving ? 'Saving…' : 'Save settings'}
          </Button>
        </div>
      </form>

      <SignOutEverywhere />
    </>
  )
}

function SignOutEverywhere() {
  const { setMe } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signOutEverywhere() {
    setBusy(true)
    setError(null)
    try {
      await api('/auth/logout-all', { method: 'POST' })
      setMe(null)
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <Card className="mt-6 p-6">
      <h2 className="text-lg font-semibold">Security</h2>
      <p className="mt-1 text-sm text-muted-foreground">Used FluentDay on a shared or lost device? Log out everywhere, including here.</p>
      {error && <Alert tone="error" className="mt-3">{error}</Alert>}
      <Button className="mt-4" variant="outline" disabled={busy} onClick={signOutEverywhere}>{busy ? 'Logging out…' : 'Log out of all devices'}</Button>
    </Card>
  )
}

function Section({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <Card className="p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-xl bg-sage-50 text-forest ring-1 ring-sage">
          <Icon className="size-4" />
        </div>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {children}
    </Card>
  )
}

/** Push needs the browser's permission and a subscription, so it switches on or off straight away (not on Save). */
function PushToggle({ checked, onChanged }: { checked: boolean; onChanged: (push: boolean) => void }) {
  const { me, setProfile } = useAuth()
  const config = useApiQuery<PushConfig>('/notifications/push/config')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const support = pushSupport()
  const available = config.data?.enabled && config.data.public_key && support === 'supported'

  let hint = 'Your browser will ask for permission. This switch takes effect straight away.'
  if (config.data && !config.data.enabled) hint = 'Push reminders aren’t set up on this server yet. Use in-app or email reminders.'
  else if (support === 'unsupported') hint = 'This browser doesn’t support push notifications. Try Chrome, Edge, Firefox or Safari on macOS.'
  else if (support === 'denied' && !checked) hint = 'Notifications are blocked for FluentDay in this browser. Allow them in your site settings to use push.'

  async function change(on: boolean) {
    setBusy(true)
    setError(null)
    try {
      if (on) {
        await enablePush(config.data!.public_key!)
      } else {
        if (support !== 'unsupported') await disablePush()
        await api<Profile>('/profile', { method: 'PATCH', json: { notifications: { ...me!.profile.notifications, push: false } } })
      }
      setProfile({ ...me!.profile, notifications: { ...me!.profile.notifications, push: on } })
      onChanged(on)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <Toggle label="Browser push notifications" hint={hint} checked={checked} disabled={busy || (!available && !checked)} onChange={change} />
      {error && <Alert tone="error" className="mt-2">{error}</Alert>}
    </div>
  )
}

function Toggle({ label, hint, checked, disabled = false, onChange }: { label: string; hint: string; checked: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className={cn('flex items-start justify-between gap-4 rounded-xl bg-ivory p-4 ring-1 ring-border/70', disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer')}>
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-input transition-colors peer-checked:bg-forest peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5"
      />
    </label>
  )
}
