import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Alert } from '@/components/common/Alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useApiQuery } from '@/hooks/useApiQuery'
import { api, errorMessage } from '@/lib/api'
import type { StarterVocabulary as StarterStatus } from '@/types/admin'

/** Loads the bundled everyday-English word list (NGSL + Open English WordNet) into the vocabulary. */
export function StarterVocabulary({ onLoaded }: { onLoaded: () => void }) {
  const { data, reload } = useApiQuery<StarterStatus>('/admin/vocabulary/starter')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  if (!data || data.words_in_file === 0) return null
  const complete = data.loaded >= data.words_in_file

  async function load() {
    setBusy(true)
    setNotice(null)
    try {
      const result = await api<StarterStatus>('/admin/vocabulary/starter', { method: 'POST' })
      const parts = [`${result.added} word${result.added === 1 ? '' : 's'} added`]
      if (result.updated) parts.push(`${result.updated} existing word${result.updated === 1 ? '' : 's'} filled in`)
      setNotice({ tone: 'success', text: `${parts.join(', ')}. They're approved and ready for daily lessons.` })
      await reload()
      onLoaded()
    } catch (e) {
      setNotice({ tone: 'error', text: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mb-5 p-5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="mr-auto max-w-2xl">
          <h2 className="font-display font-semibold">Starter vocabulary</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.words_in_file.toLocaleString()} of the most useful everyday English words, with definitions, examples and
            synonyms from Open English WordNet. {data.loaded.toLocaleString()} loaded so far.
          </p>
        </div>
        <Button onClick={load} disabled={busy || complete}>
          <Sparkles /> {complete ? 'All loaded' : busy ? 'Loading…' : 'Load starter vocabulary'}
        </Button>
      </div>
      {notice && <Alert tone={notice.tone} className="mt-4">{notice.text}</Alert>}
    </Card>
  )
}
