import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { RevisionCalendar } from '@/types/phase4'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Blank cells before the 1st so the grid starts on Monday. */
export function leadingBlanks(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7
}

export function MonthCalendar({ data, onMonth }: { data: RevisionCalendar; onMonth: (month: string) => void }) {
  const label = new Date(`${data.month}-01T12:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{label}</h2>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" aria-label="Previous month" onClick={() => onMonth(shiftMonth(data.month, -1))}><ChevronLeft /></Button>
          <Button size="icon" variant="ghost" aria-label="Next month" onClick={() => onMonth(shiftMonth(data.month, 1))}><ChevronRight /></Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground" aria-hidden="true">
        {WEEKDAYS.map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>
      <ol className="grid grid-cols-7 gap-1">
        {Array.from({ length: leadingBlanks(data.month) }, (_, i) => <li key={`b${i}`} aria-hidden="true" />)}
        {data.days.map((day) => {
          const isToday = day.date === data.today
          const past = day.date < data.today
          const dayNumber = Number(day.date.slice(8))
          const description = [
            day.due ? `${day.due} ${past ? 'overdue' : 'due'}` : null,
            day.reviewed ? `${day.reviewed} reviewed` : null,
          ].filter(Boolean).join(', ')
          return (
            <li
              key={day.date}
              aria-label={`${dayNumber}${description ? `: ${description}` : ''}`}
              className={cn('flex min-h-14 flex-col items-center rounded-xl p-1 text-sm sm:min-h-16', isToday ? 'bg-forest text-white' : 'bg-ivory')}
            >
              <span className="font-medium">{dayNumber}</span>
              {day.due > 0 && (
                <span className={cn('mt-0.5 rounded-full px-1.5 text-[11px] font-semibold', isToday ? 'bg-coral text-forest' : past ? 'bg-coral-50 text-forest ring-1 ring-coral' : 'bg-sage text-forest')}>
                  {day.due}
                </span>
              )}
              {day.reviewed > 0 && <span className={cn('mt-0.5 text-[11px]', isToday ? 'text-sage' : 'text-muted-foreground')}>✓{day.reviewed}</span>}
            </li>
          )
        })}
      </ol>
      <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span><span className="mr-1 inline-block size-2.5 rounded-full bg-sage align-middle" /> Words due</span>
        <span><span className="mr-1 inline-block size-2.5 rounded-full bg-coral-50 ring-1 ring-coral align-middle" /> Overdue</span>
        <span>✓ Reviewed</span>
      </p>
    </Card>
  )
}
