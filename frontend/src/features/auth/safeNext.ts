/** Only allows same-site relative paths, so ?next= can't redirect off-site. */
export function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/app'
}
