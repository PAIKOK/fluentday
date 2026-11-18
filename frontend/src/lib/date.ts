/** Returns a time-of-day greeting for the given date (defaults to now). */
export function getGreeting(date: Date = new Date()): string {
  const hour = date.getHours()
  if (hour < 5) return 'Good evening'
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/** e.g. "Tuesday, 17 November 2026" */
export function formatLongDate(date: Date = new Date(), locale = 'en-GB'): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}
