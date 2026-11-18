import { useState, type FormEvent } from 'react'
import { Star, X } from 'lucide-react'
import { Alert } from '@/components/common/Alert'
import { Button } from '@/components/ui/button'
import { Input, Label, Select, Textarea } from '@/components/ui/input'
import { api, errorMessage } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { NotebookCategory, NotebookEntry } from '@/types/phase4'
import { NOTEBOOK_CATEGORIES } from './categories'

interface EntryEditorProps {
  entry: NotebookEntry | null
  defaultCategory: NotebookCategory
  onSaved: (entry: NotebookEntry) => void
  onCancel: () => void
}

export function EntryEditor({ entry, defaultCategory, onSaved, onCancel }: EntryEditorProps) {
  const [category, setCategory] = useState<NotebookCategory>(entry?.category ?? defaultCategory)
  const [title, setTitle] = useState(entry?.title ?? '')
  const [content, setContent] = useState(entry?.content ?? '')
  const [tags, setTags] = useState<string[]>(entry?.tags ?? [])
  const [tagDraft, setTagDraft] = useState('')
  const [favourite, setFavourite] = useState(entry?.favourite ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addTag() {
    const tag = tagDraft.trim().toLowerCase().replace(/^#/, '')
    if (tag && !tags.includes(tag) && tags.length < 10) setTags([...tags, tag])
    setTagDraft('')
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const body = { category, title, content, tags, favourite }
    try {
      const saved = entry
        ? await api<NotebookEntry>(`/notebook/${entry.id}`, { method: 'PATCH', json: body })
        : await api<NotebookEntry>('/notebook', { method: 'POST', json: body })
      onSaved(saved)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {error && <Alert tone="error">{error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <Label htmlFor="n-category">Category</Label>
          <Select id="n-category" value={category} onChange={(e) => setCategory(e.target.value as NotebookCategory)}>
            {NOTEBOOK_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </Select>
        </div>
        <Button type="button" variant="outline" aria-pressed={favourite} onClick={() => setFavourite(!favourite)}>
          <Star className={cn(favourite && 'fill-coral text-coral')} /> {favourite ? 'Favourite' : 'Add to favourites'}
        </Button>
      </div>
      <div>
        <Label htmlFor="n-title">Title</Label>
        <Input id="n-title" maxLength={120} required value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="n-content">Note</Label>
        <Textarea id="n-content" maxLength={5000} className="min-h-40" value={content} onChange={(e) => setContent(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="n-tag">Tags</Label>
        {tags.length > 0 && (
          <ul className="mb-2 flex flex-wrap gap-2">
            {tags.map((t) => (
              <li key={t} className="flex items-center gap-1 rounded-full bg-sage-50 py-0.5 pl-3 pr-1 text-sm ring-1 ring-sage">
                #{t}
                <button type="button" className="rounded-full p-1 hover:bg-sage" aria-label={`Remove tag ${t}`} onClick={() => setTags(tags.filter((x) => x !== t))}>
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <Input
            id="n-tag"
            maxLength={30}
            placeholder="e.g. grammar"
            value={tagDraft}
            disabled={tags.length >= 10}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault()
                addTag()
              }
            }}
          />
          <Button type="button" variant="outline" onClick={addTag} disabled={!tagDraft.trim() || tags.length >= 10}>Add</Button>
        </div>
      </div>
      <div className="sticky bottom-0 -mx-6 flex gap-2 border-t border-border bg-card px-6 py-4">
        <Button type="submit" disabled={saving || !title.trim()}>{saving ? 'Saving…' : entry ? 'Save changes' : 'Add note'}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}
