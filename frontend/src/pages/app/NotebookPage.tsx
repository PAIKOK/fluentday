import { useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Download, NotebookPen, Pencil, Plus, Search, Star, Trash2 } from 'lucide-react'
import { Alert } from '@/components/common/Alert'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadState } from '@/components/common/LoadState'
import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Select } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { EntryEditor } from '@/features/notebook/EntryEditor'
import { NOTEBOOK_CATEGORIES, categoryLabel } from '@/features/notebook/categories'
import { useApiQuery } from '@/hooks/useApiQuery'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { api, errorMessage } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { NotebookCategory, NotebookEntry, NotebookPage as NotebookPageData } from '@/types/phase4'

const isCategory = (v: string | null): v is NotebookCategory => NOTEBOOK_CATEGORIES.some((c) => c.id === v)

export function NotebookPage() {
  const [params, setParams] = useSearchParams()
  const category = isCategory(params.get('category')) ? (params.get('category') as NotebookCategory) : null
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState('')
  const [favouritesOnly, setFavouritesOnly] = useState(false)
  const [editing, setEditing] = useState<NotebookEntry | 'new' | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const debounced = useDebouncedValue(query, 300)

  const apiParams = new URLSearchParams({ page_size: '100' })
  if (category) apiParams.set('category', category)
  if (debounced.trim()) apiParams.set('q', debounced.trim())
  if (tag) apiParams.set('tag', tag)
  if (favouritesOnly) apiParams.set('favourite', 'true')
  const { data, error, isLoading, reload } = useApiQuery<NotebookPageData>(`/notebook?${apiParams}`)
  const tags = useApiQuery<string[]>('/notebook/tags')
  const total = data ? Object.values(data.counts).reduce((a, b) => a + b, 0) : 0
  const filtering = Boolean(debounced.trim() || tag || favouritesOnly)
  const current = NOTEBOOK_CATEGORIES.find((c) => c.id === category)

  function selectCategory(id: NotebookCategory | null) {
    setParams(id ? { category: id } : {}, { replace: true })
  }

  async function refresh() {
    await Promise.all([reload(), tags.reload()])
  }

  async function toggleFavourite(entry: NotebookEntry) {
    try {
      await api<NotebookEntry>(`/notebook/${entry.id}`, { method: 'PATCH', json: { favourite: !entry.favourite } })
      await reload()
    } catch (e) {
      setNotice({ tone: 'error', text: errorMessage(e) })
    }
  }

  async function remove(entry: NotebookEntry) {
    if (!window.confirm(`Delete “${entry.title}”? This can’t be undone.`)) return
    try {
      await api<void>(`/notebook/${entry.id}`, { method: 'DELETE' })
      setNotice({ tone: 'success', text: `“${entry.title}” deleted.` })
      await refresh()
    } catch (e) {
      setNotice({ tone: 'error', text: errorMessage(e) })
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="My Notebook"
        title="Your private study notebook"
        description="Only you can see what you keep here."
        actions={
          <>
            <Button variant="outline" asChild>
              <a href={`/api/notebook/export.pdf${category ? `?category=${category}` : ''}`} download>
                <Download /> Export PDF
              </a>
            </Button>
            <Button onClick={() => setEditing('new')}><Plus /> New note</Button>
          </>
        }
      />

      <div role="tablist" aria-label="Notebook categories" className="mb-5 flex gap-2 overflow-x-auto pb-1">
        <CategoryTab active={category === null} onClick={() => selectCategory(null)} label="All" count={total} />
        {NOTEBOOK_CATEGORIES.map(({ id, label, icon: Icon }) => (
          <CategoryTab key={id} active={category === id} onClick={() => selectCategory(id)} label={label} count={data?.counts[id]} icon={<Icon className="size-4" />} />
        ))}
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_12rem_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search notes" placeholder="Search notes" className="pl-10" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Select aria-label="Filter by tag" value={tag} onChange={(e) => setTag(e.target.value)}>
          <option value="">All tags</option>
          {tags.data?.map((t) => <option key={t} value={t}>#{t}</option>)}
        </Select>
        <Button variant={favouritesOnly ? 'secondary' : 'outline'} aria-pressed={favouritesOnly} onClick={() => setFavouritesOnly(!favouritesOnly)}>
          <Star className={cn(favouritesOnly && 'fill-coral text-coral')} /> Favourites
        </Button>
      </div>

      {notice && <Alert tone={notice.tone} className="mb-4">{notice.text}</Alert>}

      <LoadState isLoading={isLoading} error={error} onRetry={reload} hasData={data !== null}>
        {data && data.items.length === 0 ? (
          <EmptyState
            icon={current?.icon ?? NotebookPen}
            title={filtering ? 'No notes match' : current ? `${current.label} is empty` : 'Your notebook is empty'}
            description={filtering ? 'Try a different search or filter.' : current?.empty ?? 'Save words, expressions and sentences as you learn, or write a note of your own.'}
            action={!filtering && <Button variant="outline" onClick={() => setEditing('new')}><Plus /> New note</Button>}
          />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {data?.items.map((entry) => (
              <li key={entry.id}>
                <Card className="flex h-full flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {!category && <p className="mb-1 text-xs font-medium text-muted-foreground">{categoryLabel(entry.category)}</p>}
                      <h2 className="break-words text-base font-semibold">
                        {entry.word_id ? <Link to={`/app/vocabulary/${entry.word_id}`} className="hover:underline">{entry.title}</Link> : entry.title}
                      </h2>
                    </div>
                    <Button size="icon" variant="ghost" className="size-8 shrink-0" aria-pressed={entry.favourite} aria-label={entry.favourite ? `Remove “${entry.title}” from favourites` : `Add “${entry.title}” to favourites`} onClick={() => toggleFavourite(entry)}>
                      <Star className={cn('size-4', entry.favourite && 'fill-coral text-coral')} />
                    </Button>
                  </div>
                  {entry.content && <p className="mt-2 line-clamp-4 whitespace-pre-line text-sm text-foreground/85">{entry.content}</p>}
                  {entry.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {entry.tags.map((t) => <Badge key={t} variant="outline">#{t}</Badge>)}
                    </div>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-4 text-xs text-muted-foreground">
                    <span>Updated {new Date(entry.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                    <span className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(entry)} aria-label={`Edit “${entry.title}”`}><Pencil /> Edit</Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(entry)} aria-label={`Delete “${entry.title}”`}><Trash2 /> Delete</Button>
                    </span>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </LoadState>

      <Sheet open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <SheetContent side="right" className="w-[34rem] overflow-y-auto px-6 pt-6">
          <SheetTitle className="font-display text-xl font-bold">{editing === 'new' ? 'New note' : 'Edit note'}</SheetTitle>
          <SheetDescription className="mb-5 text-sm text-muted-foreground">Notes are private to your account.</SheetDescription>
          {editing !== null && (
            <EntryEditor
              key={editing === 'new' ? 'new' : editing.id}
              entry={editing === 'new' ? null : editing}
              defaultCategory={category ?? 'vocabulary'}
              onCancel={() => setEditing(null)}
              onSaved={(saved) => {
                setEditing(null)
                setNotice({ tone: 'success', text: `“${saved.title}” saved.` })
                void refresh()
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}

function CategoryTab({ active, onClick, label, count, icon }: { active: boolean; onClick: () => void; label: string; count?: number; icon?: ReactNode }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
        active ? 'bg-forest text-white' : 'bg-card text-muted-foreground ring-1 ring-border hover:text-foreground',
      )}
    >
      {icon} {label}
      {count !== undefined && <span className={cn('rounded-full px-1.5 text-xs', active ? 'bg-white/20' : 'bg-muted')}>{count}</span>}
    </button>
  )
}
