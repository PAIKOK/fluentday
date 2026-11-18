import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BookOpenText, Check, Flag, Search, X } from 'lucide-react'
import { Alert } from '@/components/common/Alert'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadState } from '@/components/common/LoadState'
import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Select } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { StarterVocabulary } from '@/features/admin/StarterVocabulary'
import { WordEditor } from '@/features/admin/WordEditor'
import { useApiQuery } from '@/hooks/useApiQuery'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { api, errorMessage } from '@/lib/api'
import type { Page, Word, WordStatus } from '@/types/admin'

const FILTER_KEYS = ['status', 'level', 'needs_review', 'slot'] as const
const STATUS_BADGE: Record<WordStatus, 'sage' | 'coral' | 'outline'> = { approved: 'sage', rejected: 'coral', pending: 'outline' }

export function AdminVocabularyPage() {
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') ?? '')
  const debounced = useDebouncedValue(query, 300)
  const page = Number(params.get('page') ?? '1') || 1
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<Word | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  const apiParams = new URLSearchParams({ page: String(page), page_size: '25' })
  for (const key of FILTER_KEYS) {
    const value = params.get(key)
    if (value) apiParams.set(key, value)
  }
  if (debounced.trim()) apiParams.set('q', debounced.trim())
  const { data, error, isLoading, reload } = useApiQuery<Page<Word>>(`/admin/vocabulary?${apiParams}`)
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete('page')
    setParams(next, { replace: true })
    setSelected(new Set())
  }

  function goToPage(n: number) {
    const next = new URLSearchParams(params)
    next.set('page', String(n))
    setParams(next)
    setSelected(new Set())
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function bulk(status: WordStatus) {
    try {
      const result = await api<{ updated: number; skipped_without_definition: number }>('/admin/vocabulary/bulk-status', {
        method: 'POST',
        json: { ids: [...selected], status },
      })
      const skipped = result.skipped_without_definition
      setNotice({
        tone: 'success',
        text: `${result.updated} word${result.updated === 1 ? '' : 's'} ${status}.${skipped ? ` ${skipped} skipped because they have no definition yet.` : ''}`,
      })
      setSelected(new Set())
      await reload()
    } catch (e) {
      setNotice({ tone: 'error', text: errorMessage(e) })
    }
  }

  const allOnPage = data?.items.map((w) => w.id) ?? []
  const allSelected = allOnPage.length > 0 && allOnPage.every((id) => selected.has(id))

  return (
    <>
      <PageHeader eyebrow="Admin" title="Vocabulary" description="Review, edit and approve extracted words. Only approved words are used in daily lessons." />

      <StarterVocabulary onLoaded={() => void reload()} />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search words"
            placeholder="Search words"
            className="pl-10"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              if (params.get('page')) goToPage(1)
            }}
          />
        </div>
        <Select aria-label="Status" value={params.get('status') ?? ''} onChange={(e) => setFilter('status', e.target.value)}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </Select>
        <Select aria-label="Review" value={params.get('needs_review') ?? ''} onChange={(e) => setFilter('needs_review', e.target.value)}>
          <option value="">Flagged or not</option>
          <option value="true">Flagged for review</option>
          <option value="false">Not flagged</option>
        </Select>
        <Select aria-label="Level" value={params.get('level') ?? ''} onChange={(e) => setFilter('level', e.target.value)}>
          <option value="">All levels</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </Select>
        <Select aria-label="Book" value={params.get('slot') ?? ''} onChange={(e) => setFilter('slot', e.target.value)}>
          <option value="">All books</option>
          <option value="1">Book 1</option>
          <option value="2">Book 2</option>
          <option value="3">Book 3</option>
        </Select>
      </div>

      {notice && <Alert tone={notice.tone} className="mb-4">{notice.text}</Alert>}

      {selected.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl bg-forest px-4 py-3 text-sm text-white">
          <span className="mr-auto">{selected.size} selected</span>
          <Button size="sm" variant="secondary" onClick={() => bulk('approved')}><Check /> Approve</Button>
          <Button size="sm" variant="secondary" onClick={() => bulk('rejected')}><X /> Reject</Button>
          <Button size="sm" variant="ghost" className="text-white hover:bg-forest-700" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      <LoadState isLoading={isLoading} error={error} onRetry={reload} hasData={data !== null}>
        {data && data.items.length === 0 ? (
          <EmptyState
            icon={BookOpenText}
            title="No words match"
            description={data.total === 0 && !debounced && FILTER_KEYS.every((k) => !params.get(k)) ? 'Load the starter vocabulary or upload a vocabulary book.' : 'Try clearing a filter or changing your search.'}
          />
        ) : (
          data && (
            <Card className="relative overflow-x-auto p-0" role="region" aria-label="Vocabulary table" tabIndex={0}>
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label="Select all on this page"
                        checked={allSelected}
                        onChange={() => setSelected(allSelected ? new Set() : new Set(allOnPage))}
                      />
                    </th>
                    <th className="px-3 py-3 font-medium">Word</th>
                    <th className="px-3 py-3 font-medium">Definition</th>
                    <th className="px-3 py-3 font-medium">Source</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.items.map((w) => (
                    <tr key={w.id} className="align-top">
                      <td className="px-4 py-3.5">
                        <input type="checkbox" aria-label={`Select ${w.word}`} checked={selected.has(w.id)} onChange={() => toggle(w.id)} />
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="font-display font-semibold">{w.word}</div>
                        <div className="text-xs text-muted-foreground">
                          {[w.part_of_speech, w.level].filter(Boolean).join(' · ') || '—'}
                        </div>
                      </td>
                      <td className="max-w-sm px-3 py-3.5">
                        {w.definition ? <p className="line-clamp-2">{w.definition}</p> : <span className="text-muted-foreground italic">No definition</span>}
                      </td>
                      <td className="px-3 py-3.5 text-xs text-muted-foreground">
                        {w.sources.map((s) => (
                          <div key={`${s.book_id}-${s.page}`}>Book {s.book_slot}, p. {s.page}</div>
                        ))}
                        {w.starter_rank ? <div>Starter list #{w.starter_rank}</div> : null}
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex flex-col items-start gap-1">
                          <Badge variant={STATUS_BADGE[w.status]} className="capitalize">{w.status}</Badge>
                          {w.needs_review && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Flag className="size-3" /> Review</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        <Button size="sm" variant="outline" onClick={() => setEditing(w)}>Edit</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )
        )}
      </LoadState>

      {data && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>{data.total} word{data.total === 1 ? '' : 's'}</span>
          {pages > 1 && (
            <div className="flex items-center gap-3">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => goToPage(page - 1)}>Previous</Button>
              <span>Page {page} of {pages}</span>
              <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => goToPage(page + 1)}>Next</Button>
            </div>
          )}
        </div>
      )}

      <Sheet open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <SheetContent side="right" className="w-[36rem] overflow-y-auto px-6 pt-6">
          {editing && (
            <>
              <SheetTitle className="font-display text-xl font-bold">{editing.word}</SheetTitle>
              <SheetDescription className="mb-5 text-sm text-muted-foreground">Edit the entry, then approve or reject it.</SheetDescription>
              <WordEditor
                key={editing.id}
                word={editing}
                onSaved={(saved) => {
                  setEditing(null)
                  setNotice({ tone: 'success', text: `“${saved.word}” saved (${saved.status}).` })
                  void reload()
                }}
              />
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
