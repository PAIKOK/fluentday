import { cn } from '@/lib/utils'

export interface ChartSeries {
  key: string
  label: string
  color: string
}

export interface ChartPoint {
  /** Short axis label, e.g. "Mon". */
  label: string
  /** Full label for the tooltip and table, e.g. "Monday 18 November". */
  fullLabel: string
  values: Record<string, number>
  /** Extra tooltip lines, e.g. a breakdown of the total. */
  details?: string[]
}

/** Rounds up to a clean axis maximum: 1, 2, 5 × 10ⁿ (at least 4, so an empty chart still has a scale). */
export function niceMax(value: number): number {
  if (value <= 4) return 4
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const step = [1, 2, 5, 10].find((s) => s * magnitude >= value) ?? 10
  return step * magnitude
}

interface ColumnChartProps {
  data: ChartPoint[]
  series: ChartSeries[]
  /** Accessible name of the chart. */
  label: string
}

/** Columns grouped per point, with a hover/focus tooltip, a legend for 2+ series and a table view. */
export function ColumnChart({ data, series, label }: ColumnChartProps) {
  const max = niceMax(Math.max(0, ...data.flatMap((d) => series.map((s) => d.values[s.key] ?? 0))))
  const ticks = [max, max / 2, 0]

  return (
    <figure aria-label={label}>
      {series.length > 1 && (
        <ul className="mb-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ backgroundColor: s.color }} aria-hidden />
              {s.label}
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <div className="relative h-44 w-6 shrink-0 text-right text-[11px] text-muted-foreground" aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${100 - (t / max) * 100}%` }}>{t}</span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative h-44">
            {ticks.map((t) => (
              <div key={t} className="absolute inset-x-0 border-t border-border" style={{ top: `${100 - (t / max) * 100}%` }} aria-hidden />
            ))}
            <div className="relative flex h-full items-end">
              {data.map((d) => {
                const summary = series.map((s) => `${s.label}: ${d.values[s.key] ?? 0}`).join(', ')
                return (
                  <div
                    key={d.fullLabel}
                    tabIndex={0}
                    role="img"
                    aria-label={`${d.fullLabel}. ${summary}${d.details?.length ? `. ${d.details.join(', ')}` : ''}`}
                    className="group relative flex h-full flex-1 items-end justify-center gap-[2px] rounded-md outline-none hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {series.map((s) => {
                      const value = d.values[s.key] ?? 0
                      return (
                        <div
                          key={s.key}
                          className={cn('w-full max-w-6 rounded-t-[4px]', value === 0 && 'min-h-px opacity-40')}
                          style={{ height: `${(value / max) * 100}%`, backgroundColor: s.color }}
                        />
                      )
                    })}
                    <div
                      role="tooltip"
                      className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden w-max max-w-48 -translate-x-1/2 rounded-lg bg-forest px-3 py-2 text-xs text-white shadow-lift group-hover:block group-focus-visible:block"
                    >
                      <p className="font-semibold">{d.fullLabel}</p>
                      {series.map((s) => (
                        <p key={s.key} className="flex items-center gap-1.5">
                          <span className="size-2 rounded-sm ring-1 ring-white/70" style={{ backgroundColor: s.color }} aria-hidden />
                          {s.label}: {d.values[s.key] ?? 0}
                        </p>
                      ))}
                      {d.details?.map((line) => <p key={line} className="text-white/80">{line}</p>)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="mt-1.5 flex text-[11px] text-muted-foreground" aria-hidden>
            {data.map((d) => <span key={d.fullLabel} className="flex-1 text-center">{d.label}</span>)}
          </div>
        </div>
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-forest">Show as a table</summary>
        <div className="mt-2 overflow-x-auto" role="region" aria-label={`${label} table`} tabIndex={0}>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-muted-foreground">
                <th className="py-1 pr-3 font-medium">Period</th>
                {series.map((s) => <th key={s.key} className="py-1 pr-3 font-medium">{s.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.fullLabel} className="border-t border-border">
                  <td className="py-1 pr-3">{d.fullLabel}</td>
                  {series.map((s) => <td key={s.key} className="py-1 pr-3">{d.values[s.key] ?? 0}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  )
}
