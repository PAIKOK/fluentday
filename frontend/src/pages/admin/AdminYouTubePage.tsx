import { useState, type FormEvent } from 'react'
import { Download, ListChecks, MonitorPlay, Trash2 } from 'lucide-react'
import { Alert } from '@/components/common/Alert'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadState } from '@/components/common/LoadState'
import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Label, Select } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { QuestionsEditor } from '@/features/admin/QuestionsEditor'
import { formatDateTime } from '@/features/admin/labels'
import { useApiQuery } from '@/hooks/useApiQuery'
import { api, errorMessage } from '@/lib/api'
import { formatDuration, parseDuration } from '@/lib/duration'
import type { Page } from '@/types/admin'
import type { AdminVideo, Channel, ChannelKey } from '@/types/phase4'

type Notice = { tone: 'success' | 'error'; text: string } | null

export function AdminYouTubePage() {
  const channels = useApiQuery<Channel[]>('/admin/youtube/channels')
  const [channelFilter, setChannelFilter] = useState<ChannelKey | ''>('')
  const [scheduledOnly, setScheduledOnly] = useState(false)
  const params = new URLSearchParams({ page_size: '50' })
  if (channelFilter) params.set('channel_key', channelFilter)
  if (scheduledOnly) params.set('scheduled', 'true')
  const videos = useApiQuery<Page<AdminVideo>>(`/admin/youtube/videos?${params}`)
  const [notice, setNotice] = useState<Notice>(null)
  const [questionsFor, setQuestionsFor] = useState<AdminVideo | null>(null)
  const channelName = (key: ChannelKey) => channels.data?.find((c) => c.key === key)?.name ?? key

  async function patchVideo(video: AdminVideo, body: Record<string, unknown>, success?: string) {
    try {
      await api<AdminVideo>(`/admin/youtube/videos/${video.id}`, { method: 'PATCH', json: body })
      if (success) setNotice({ tone: 'success', text: success })
      await videos.reload()
    } catch (e) {
      setNotice({ tone: 'error', text: errorMessage(e) })
    }
  }

  async function removeVideo(video: AdminVideo) {
    if (!window.confirm(`Delete “${video.title}”?`)) return
    try {
      await api<void>(`/admin/youtube/videos/${video.id}`, { method: 'DELETE' })
      setNotice({ tone: 'success', text: 'Video deleted.' })
      await videos.reload()
    } catch (e) {
      setNotice({ tone: 'error', text: errorMessage(e) })
    }
  }

  return (
    <>
      <PageHeader eyebrow="Admin" title="Listening videos" description="Each learner gets one video per channel every day: the one scheduled for that day, otherwise the newest they haven’t seen." />
      {notice && <Alert tone={notice.tone} className="mb-6">{notice.text}</Alert>}

      <LoadState isLoading={channels.isLoading} error={channels.error} onRetry={channels.reload} hasData={channels.data !== null}>
        <div className="grid gap-6 lg:grid-cols-2">
          {channels.data?.map((c) => <ChannelCard key={c.key} channel={c} onNotice={setNotice} onChanged={async () => { await channels.reload(); await videos.reload() }} />)}
        </div>
      </LoadState>

      <AddVideoForm onNotice={setNotice} onAdded={videos.reload} />

      <div className="mb-4 mt-10 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-xl font-semibold">Videos</h2>
        <div className="flex flex-wrap gap-2">
          <Select aria-label="Channel" className="w-auto" value={channelFilter} onChange={(e) => setChannelFilter(e.target.value as ChannelKey | '')}>
            <option value="">Both channels</option>
            <option value="tv_series">Learn English with TV Series</option>
            <option value="bbc_6min">BBC 6 Minute English</option>
          </Select>
          <Button variant={scheduledOnly ? 'secondary' : 'outline'} aria-pressed={scheduledOnly} onClick={() => setScheduledOnly(!scheduledOnly)}>Scheduled only</Button>
        </div>
      </div>

      <LoadState isLoading={videos.isLoading} error={videos.error} onRetry={videos.reload} hasData={videos.data !== null}>
        {videos.data && videos.data.items.length === 0 ? (
          <EmptyState icon={MonitorPlay} title="No videos yet" description="Import from a channel’s feed or add a video by its link." />
        ) : (
          <ul className="space-y-3">
            {videos.data?.items.map((v) => (
              <li key={v.id}>
                <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                  <img src={v.thumbnail_url} alt="" className="aspect-video w-full rounded-xl object-cover sm:w-40" loading="lazy" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="sage">{channelName(v.channel_key)}</Badge>
                      {!v.active && <Badge variant="outline">Inactive</Badge>}
                      {v.scheduled_for && <Badge variant="coral">Scheduled {v.scheduled_for}</Badge>}
                    </div>
                    <a href={`https://www.youtube.com/watch?v=${v.video_id}`} target="_blank" rel="noreferrer" className="mt-1.5 block font-medium hover:underline">{v.title}</a>
                    <p className="text-xs text-muted-foreground">
                      {[formatDuration(v.duration_seconds) || 'Duration unknown', v.published_at ? `published ${formatDateTime(v.published_at)}` : null, `given to ${v.times_assigned} learner${v.times_assigned === 1 ? '' : 's'}`, `${v.questions.length} question${v.questions.length === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <label className="sr-only" htmlFor={`sched-${v.id}`}>Schedule “{v.title}” for a day</label>
                    <Input id={`sched-${v.id}`} type="date" className="h-9 w-40" value={v.scheduled_for ?? ''}
                      onChange={(e) => patchVideo(v, e.target.value ? { scheduled_for: e.target.value } : { clear_schedule: true }, e.target.value ? `Scheduled for ${e.target.value}.` : 'Schedule cleared.')} />
                    <Button size="sm" variant="outline" onClick={() => setQuestionsFor(v)}><ListChecks /> Questions</Button>
                    <Button size="sm" variant="ghost" onClick={() => patchVideo(v, { active: !v.active })}>{v.active ? 'Deactivate' : 'Activate'}</Button>
                    {v.times_assigned === 0 && (
                      <Button size="icon" variant="ghost" className="size-9" aria-label={`Delete “${v.title}”`} onClick={() => removeVideo(v)}><Trash2 className="size-4" /></Button>
                    )}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </LoadState>

      <Sheet open={questionsFor !== null} onOpenChange={(open) => !open && setQuestionsFor(null)}>
        <SheetContent side="right" className="w-[36rem] overflow-y-auto px-6 pt-6">
          <SheetTitle className="font-display text-xl font-bold">Comprehension questions</SheetTitle>
          <SheetDescription className="mb-5 text-sm text-muted-foreground">{questionsFor?.title}</SheetDescription>
          {questionsFor && (
            <QuestionsEditor key={questionsFor.id} video={questionsFor} onSaved={(saved) => {
              setQuestionsFor(null)
              setNotice({ tone: 'success', text: `Saved ${saved.questions.length} question${saved.questions.length === 1 ? '' : 's'}.` })
              void videos.reload()
            }} />
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}

function ChannelCard({ channel, onNotice, onChanged }: { channel: Channel; onNotice: (n: Notice) => void; onChanged: () => Promise<void> }) {
  const [url, setUrl] = useState(channel.url)
  const [channelId, setChannelId] = useState(channel.channel_id)
  const [filter, setFilter] = useState(channel.title_filter)
  const [busy, setBusy] = useState<'save' | 'import' | null>(null)

  async function save(event: FormEvent) {
    event.preventDefault()
    setBusy('save')
    try {
      await api<Channel>(`/admin/youtube/channels/${channel.key}`, { method: 'PATCH', json: { url, channel_id: channelId, title_filter: filter } })
      onNotice({ tone: 'success', text: `${channel.name} saved.` })
      await onChanged()
    } catch (e) {
      onNotice({ tone: 'error', text: errorMessage(e) })
    } finally {
      setBusy(null)
    }
  }

  async function importFeed() {
    setBusy('import')
    try {
      const r = await api<{ added: number; skipped: number }>(`/admin/youtube/channels/${channel.key}/import`, { method: 'POST' })
      onNotice({ tone: 'success', text: `${channel.name}: ${r.added} new video${r.added === 1 ? '' : 's'} added${r.skipped ? `, ${r.skipped} skipped by the title filter` : ''}.` })
      await onChanged()
    } catch (e) {
      onNotice({ tone: 'error', text: errorMessage(e) })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold">{channel.name}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{channel.last_imported_at ? `Last imported ${formatDateTime(channel.last_imported_at)}` : 'Not imported yet'}</p>
      <form onSubmit={save} className="mt-4 space-y-3">
        <div>
          <Label htmlFor={`url-${channel.key}`}>Channel address</Label>
          <Input id={`url-${channel.key}`} placeholder="https://www.youtube.com/@…" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <div>
          <Label htmlFor={`cid-${channel.key}`}>Channel ID <span className="font-normal text-muted-foreground">(for importing from the feed)</span></Label>
          <Input id={`cid-${channel.key}`} placeholder="UC…" maxLength={24} value={channelId} onChange={(e) => setChannelId(e.target.value)} />
          <p className="mt-1 text-xs text-muted-foreground">On the channel page: About → Share channel → Copy channel ID.</p>
        </div>
        <div>
          <Label htmlFor={`filter-${channel.key}`}>Only import titles containing <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Input id={`filter-${channel.key}`} maxLength={80} placeholder="e.g. 6 Minute English" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="submit" variant="outline" disabled={busy !== null}>{busy === 'save' ? 'Saving…' : 'Save'}</Button>
          <Button type="button" disabled={busy !== null || !channel.channel_id} onClick={importFeed}><Download /> {busy === 'import' ? 'Importing…' : 'Import latest videos'}</Button>
        </div>
      </form>
    </Card>
  )
}

function AddVideoForm({ onNotice, onAdded }: { onNotice: (n: Notice) => void; onAdded: () => Promise<void> }) {
  const [url, setUrl] = useState('')
  const [channelKey, setChannelKey] = useState<ChannelKey>('tv_series')
  const [title, setTitle] = useState('')
  const [duration, setDuration] = useState('')
  const [published, setPublished] = useState('')
  const [saving, setSaving] = useState(false)
  const durationSeconds = parseDuration(duration)
  const durationInvalid = duration.trim() !== '' && durationSeconds === null

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    try {
      const video = await api<AdminVideo>('/admin/youtube/videos', {
        method: 'POST',
        json: { url, channel_key: channelKey, title: title || null, duration_seconds: durationSeconds, published_at: published || null },
      })
      onNotice({ tone: 'success', text: `Added “${video.title}”.` })
      setUrl('')
      setTitle('')
      setDuration('')
      setPublished('')
      await onAdded()
    } catch (e) {
      onNotice({ tone: 'error', text: errorMessage(e) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="mt-6 p-6">
      <h2 className="text-lg font-semibold">Add a video by link</h2>
      <form onSubmit={onSubmit} className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <div className="lg:col-span-3">
          <Label htmlFor="v-url">YouTube link</Label>
          <Input id="v-url" required placeholder="https://www.youtube.com/watch?v=…" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <div className="lg:col-span-3">
          <Label htmlFor="v-channel">Channel</Label>
          <Select id="v-channel" value={channelKey} onChange={(e) => setChannelKey(e.target.value as ChannelKey)}>
            <option value="tv_series">Learn English with TV Series</option>
            <option value="bbc_6min">BBC Learning English — 6 Minute English</option>
          </Select>
        </div>
        <div className="lg:col-span-3">
          <Label htmlFor="v-title">Title <span className="font-normal text-muted-foreground">(filled in from YouTube if empty)</span></Label>
          <Input id="v-title" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="lg:col-span-1">
          <Label htmlFor="v-duration">Duration</Label>
          <Input id="v-duration" placeholder="6:30" aria-invalid={durationInvalid} value={duration} onChange={(e) => setDuration(e.target.value)} />
        </div>
        <div className="lg:col-span-2">
          <Label htmlFor="v-published">Published</Label>
          <Input id="v-published" type="date" value={published} onChange={(e) => setPublished(e.target.value)} />
        </div>
        <div className="md:col-span-2 lg:col-span-6">
          <Button type="submit" disabled={saving || !url.trim() || durationInvalid}>{saving ? 'Adding…' : 'Add video'}</Button>
          {durationInvalid && <span className="ml-3 text-sm text-destructive">Use minutes:seconds, e.g. 6:30</span>}
        </div>
      </form>
    </Card>
  )
}
