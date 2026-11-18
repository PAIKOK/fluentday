/** 425 → "7:05"; 3725 → "1:02:05" */
export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds < 0) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const mm = h ? String(m).padStart(2, '0') : String(m)
  return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`
}

/** "7:05" or "1:02:05" or "425" → seconds; null if it can't be read. */
export function parseDuration(text: string): number | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  if (/^\d+$/.test(trimmed)) return Number(trimmed)
  const parts = trimmed.split(':').map(Number)
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => Number.isNaN(p) || p < 0)) return null
  return parts.reduce((total, part) => total * 60 + part, 0)
}
