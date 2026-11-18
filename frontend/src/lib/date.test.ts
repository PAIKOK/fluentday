import { formatLongDate, getGreeting } from './date'

describe('getGreeting', () => {
  it.each([
    [2, 'Good evening'],
    [8, 'Good morning'],
    [13, 'Good afternoon'],
    [20, 'Good evening'],
  ])('at %i:00 says "%s"', (hour, expected) => {
    expect(getGreeting(new Date(2026, 10, 17, hour))).toBe(expected)
  })
})

describe('formatLongDate', () => {
  it('formats a full British-style date', () => {
    expect(formatLongDate(new Date(2026, 10, 17))).toMatch(/^Tuesday,? 17 November 2026$/)
  })
})
