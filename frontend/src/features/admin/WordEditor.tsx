import { useState, type FormEvent } from 'react'
import { Plus, Sparkles, Trash2 } from 'lucide-react'
import { Alert } from '@/components/common/Alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Label, Select, Textarea } from '@/components/ui/input'
import { api, errorMessage } from '@/lib/api'
import type { Example, Word, WordStatus } from '@/types/admin'
import type { ProficiencyLevel } from '@/types/learning'
import { reviewReasonLabel } from './labels'

const splitTerms = (text: string) =>
  text
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)

const SOURCE_LABEL: Record<Example['source'], string> = { book: 'From book', admin: 'Added by admin', ai: 'AI-generated', dataset: 'Open English WordNet' }

export function WordEditor({ word, onSaved }: { word: Word; onSaved: (word: Word) => void }) {
  const [text, setText] = useState(word.word)
  const [pos, setPos] = useState(word.part_of_speech ?? '')
  const [pronunciation, setPronunciation] = useState(word.pronunciation ?? '')
  const [definition, setDefinition] = useState(word.definition ?? '')
  const [level, setLevel] = useState<ProficiencyLevel | ''>(word.level ?? '')
  const [examples, setExamples] = useState<Example[]>(word.examples)
  const [synonyms, setSynonyms] = useState(word.synonyms.join(', '))
  const [antonyms, setAntonyms] = useState(word.antonyms.join(', '))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<WordStatus | 'save' | null>(null)

  async function save(status?: WordStatus) {
    setSaving(status ?? 'save')
    setError(null)
    try {
      const saved = await api<Word>(`/admin/vocabulary/${word.id}`, {
        method: 'PATCH',
        json: {
          word: text,
          part_of_speech: pos.trim() || null,
          pronunciation: pronunciation.trim() || null,
          definition: definition.trim() || null,
          ...(level ? { level } : { clear_level: true }),
          examples: examples.filter((e) => e.text.trim()).map((e) => ({ ...e, text: e.text.trim() })),
          synonyms: splitTerms(synonyms),
          antonyms: splitTerms(antonyms),
          ...(status ? { status } : {}),
        },
      })
      onSaved(saved)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSaving(null)
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    void save()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {word.review_reasons.length > 0 && word.needs_review && (
        <Alert tone="info">
          <span className="font-medium">Flagged for review:</span> {word.review_reasons.map(reviewReasonLabel).join(', ')}
        </Alert>
      )}
      {error && <Alert tone="error">{error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="w-word">Word</Label>
          <Input id="w-word" maxLength={60} required value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="w-pos">Part of speech</Label>
          <Input id="w-pos" maxLength={30} placeholder="e.g. adjective" value={pos} onChange={(e) => setPos(e.target.value)} />
        </div>
      </div>

      <div className="max-w-xs">
        <Label htmlFor="w-pron">Pronunciation</Label>
        <Input id="w-pron" maxLength={60} placeholder="e.g. /ˈkændɪd/" value={pronunciation} onChange={(e) => setPronunciation(e.target.value)} />
      </div>

      <div>
        <Label htmlFor="w-def">Definition</Label>
        <Textarea id="w-def" maxLength={1000} value={definition} onChange={(e) => setDefinition(e.target.value)} />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Learners see this as the book definition. Keep it faithful to the source.
        </p>
      </div>

      <div className="max-w-xs">
        <Label htmlFor="w-level">Proficiency level</Label>
        <Select id="w-level" value={level} onChange={(e) => setLevel(e.target.value as ProficiencyLevel | '')}>
          <option value="">Not assigned</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </Select>
      </div>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Example sentences</legend>
        <ul className="space-y-2">
          {examples.map((example, i) => (
            <li key={i} className="flex items-start gap-2">
              <div className="flex-1">
                <Input
                  aria-label={`Example ${i + 1}`}
                  maxLength={300}
                  value={example.text}
                  onChange={(e) => setExamples(examples.map((ex, j) => (j === i ? { ...ex, text: e.target.value } : ex)))}
                />
                <span className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                  {example.source === 'ai' && <Sparkles className="size-3" />} {SOURCE_LABEL[example.source]}
                </span>
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove example ${i + 1}`} onClick={() => setExamples(examples.filter((_, j) => j !== i))}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          disabled={examples.length >= 10}
          onClick={() => setExamples([...examples, { text: '', source: 'admin' }])}
        >
          <Plus /> Add example
        </Button>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="w-syn">Synonyms</Label>
          <Input id="w-syn" placeholder="comma, separated" value={synonyms} onChange={(e) => setSynonyms(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="w-ant">Antonyms</Label>
          <Input id="w-ant" placeholder="comma, separated" value={antonyms} onChange={(e) => setAntonyms(e.target.value)} />
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium">Sources</h3>
        {word.sources.length === 0 ? (
          <p className="text-sm text-muted-foreground">No book source (the book was replaced). The word was kept because it was approved or edited.</p>
        ) : (
          <ul className="space-y-2">
            {word.sources.map((s) => (
              <li key={`${s.book_id}-${s.page}`} className="rounded-xl bg-ivory p-3 text-sm ring-1 ring-border/70">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{s.book_title}</span>
                  <Badge variant="outline">Page {s.page}</Badge>
                  <span className="text-xs text-muted-foreground">confidence {Math.round(s.confidence * 100)}%</span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">“{s.raw_text}”</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="sticky bottom-0 -mx-6 flex flex-wrap gap-2 border-t border-border bg-card px-6 py-4">
        <Button type="submit" disabled={saving !== null}>
          {saving === 'save' ? 'Saving…' : 'Save changes'}
        </Button>
        <Button type="button" variant="secondary" disabled={saving !== null || !definition.trim()} onClick={() => save('approved')}>
          {saving === 'approved' ? 'Approving…' : 'Save & approve'}
        </Button>
        <Button type="button" variant="ghost" disabled={saving !== null} onClick={() => save('rejected')}>
          {saving === 'rejected' ? 'Rejecting…' : 'Reject'}
        </Button>
      </div>
    </form>
  )
}
