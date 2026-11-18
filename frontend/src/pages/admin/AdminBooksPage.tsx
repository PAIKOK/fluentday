import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, ExternalLink, FileUp, Loader2, RefreshCw, Upload } from 'lucide-react'
import { Alert } from '@/components/common/Alert'
import { LoadState } from '@/components/common/LoadState'
import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Label } from '@/components/ui/input'
import { formatBytes, formatDateTime } from '@/features/admin/labels'
import { useApiQuery } from '@/hooks/useApiQuery'
import { api, errorMessage } from '@/lib/api'
import type { Book, BookSlot, BookStatus } from '@/types/admin'

const POLL_MS = 2000
const isBusy = (status?: BookStatus) => status === 'queued' || status === 'processing'

export function AdminBooksPage() {
  const { data, error, isLoading, reload } = useApiQuery<BookSlot[]>('/admin/books')
  const anyBusy = data?.some((s) => isBusy(s.book?.status)) ?? false

  // While a book is processing, refresh its status until it finishes.
  useEffect(() => {
    if (!anyBusy) return
    const id = setInterval(() => void reload(), POLL_MS)
    return () => clearInterval(id)
  }, [anyBusy, reload])

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Vocabulary books"
        description="FluentDay draws every daily word from these three PDFs. Files are stored privately and are only visible to administrators."
      />
      <LoadState isLoading={isLoading} error={error} onRetry={reload} hasData={data !== null}>
        <div className="grid gap-6 lg:grid-cols-3">
          {data?.map((slot) => <BookSlotCard key={slot.slot} slot={slot.slot} book={slot.book} onChanged={reload} />)}
        </div>
      </LoadState>
      <Card className="mt-8 p-6 text-sm leading-relaxed text-muted-foreground">
        <h2 className="mb-2 text-base font-semibold text-foreground">How extraction works</h2>
        FluentDay looks for dictionary-style entries: a <strong>bold headword</strong>, or lines like{' '}
        <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">word (adj.): definition</code> and{' '}
        <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">word – definition</code>. Ordinary paragraphs are ignored.
        Example (“e.g.”), synonym (“Syn:”) and antonym (“Ant:”) lines are attached to the word above them. Words found in more than one
        book are merged, keeping every source and page number. Anything uncertain is flagged for your review, and no word reaches
        learners until you approve it.
      </Card>
    </>
  )
}

function BookSlotCard({ slot, book, onChanged }: { slot: number; book: Book | null; onChanged: () => Promise<void> }) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (book && !window.confirm(`Replace “${book.title}”? Its extracted words will be removed, except words you have approved or edited.`)) return
    const form = new FormData()
    form.append('file', file)
    if (title.trim()) form.append('title', title.trim())
    setBusy(true)
    setError(null)
    try {
      await api<Book>(`/admin/books/${slot}`, { method: 'POST', body: form })
      setTitle('')
      await onChanged()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function reprocess() {
    setBusy(true)
    setError(null)
    try {
      await api<Book>(`/admin/books/${slot}/reprocess`, { method: 'POST' })
      await onChanged()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const processing = isBusy(book?.status)

  return (
    <Card className="flex flex-col p-6">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">Book {slot}</p>
        {book && <StatusBadge status={book.status} />}
      </div>

      {book ? (
        <div className="mt-3 flex-1">
          <h2 className="text-lg font-semibold leading-snug">{book.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="break-all">{book.filename}</span>
            <span className="whitespace-nowrap"> · {formatBytes(book.size_bytes)}</span>
            {book.page_count ? <span className="whitespace-nowrap"> · {book.page_count} pages</span> : null}
          </p>
          <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
            <Stat label="Words" value={book.word_count} />
            <Stat label="New" value={book.new_word_count} />
            <Stat label="Flagged" value={book.flagged_count} />
          </dl>
          {book.status === 'failed' && book.error && <Alert tone="error" className="mt-4">{book.error}</Alert>}
          <p className="mt-4 text-xs text-muted-foreground">
            Uploaded {formatDateTime(book.uploaded_at)}
            {book.processed_at && ` · processed ${formatDateTime(book.processed_at)}`}
          </p>
        </div>
      ) : (
        <div className="mt-3 flex-1">
          <h2 className="text-lg font-semibold">No book uploaded</h2>
          <p className="mt-1 text-sm text-muted-foreground">Upload a vocabulary book in PDF format.</p>
        </div>
      )}

      {error && <Alert tone="error" className="mt-4">{error}</Alert>}

      <div className="mt-5 space-y-3 border-t border-border pt-5">
        <div>
          <Label htmlFor={`title-${slot}`} className="text-xs text-muted-foreground">
            Title for the {book ? 'replacement' : 'new'} book (optional)
          </Label>
          <Input id={`title-${slot}`} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Defaults to the file name" />
        </div>
        <input ref={fileInput} type="file" accept="application/pdf,.pdf" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={onFile} />
        <Button className="w-full" variant={book ? 'outline' : 'default'} disabled={busy || processing} onClick={() => fileInput.current?.click()}>
          {busy ? <Loader2 className="animate-spin" /> : book ? <FileUp /> : <Upload />}
          {book ? 'Replace PDF' : 'Upload PDF'}
        </Button>
        {book && (
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="ghost" disabled={busy || processing} onClick={reprocess}>
              <RefreshCw /> Reprocess
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <a href={`/api/admin/books/${slot}/file`} target="_blank" rel="noreferrer">
                <ExternalLink /> View PDF
              </a>
            </Button>
            <Button size="sm" variant="secondary" className="col-span-2" asChild>
              <Link to={`/admin/vocabulary?slot=${slot}`}>View extracted words</Link>
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-ivory py-2.5 ring-1 ring-border/70">
      <dd className="font-display text-xl font-bold">{value}</dd>
      <dt className="text-xs text-muted-foreground">{label}</dt>
    </div>
  )
}

function StatusBadge({ status }: { status: BookStatus }) {
  if (status === 'ready') return <Badge variant="sage"><CheckCircle2 className="size-3" /> Ready</Badge>
  if (status === 'failed') return <Badge variant="coral"><AlertTriangle className="size-3" /> Failed</Badge>
  return (
    <Badge variant="outline">
      <Loader2 className="size-3 animate-spin" /> {status === 'queued' ? 'Queued' : 'Processing'}
    </Badge>
  )
}
