/** Human-readable text for the extraction review reasons the backend reports. */
export const REVIEW_REASON_LABELS: Record<string, string> = {
  missing_definition: 'No definition found',
  short_definition: 'Very short definition',
  common_word: 'Very common word',
  multi_word_headword: 'Long phrase',
  unrecognised_part_of_speech: 'Unknown part of speech',
  definition_truncated: 'Definition was cut short',
}

export function reviewReasonLabel(reason: string): string {
  return REVIEW_REASON_LABELS[reason] ?? reason.replaceAll('_', ' ')
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
}
