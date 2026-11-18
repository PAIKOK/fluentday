import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  Headphones,
  LayoutDashboard,
  ListChecks,
  Mic,
  NotebookPen,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
}

export const APP_BASE = '/app'

export const appNavigation: NavItem[] = [
  { label: 'Dashboard', path: `${APP_BASE}`, icon: LayoutDashboard },
  { label: 'Daily Vocabulary', path: `${APP_BASE}/vocabulary`, icon: BookOpen },
  { label: 'Listening Room', path: `${APP_BASE}/listening`, icon: Headphones },
  { label: 'Pronunciation Lab', path: `${APP_BASE}/pronunciation`, icon: Mic },
  { label: 'Daily Quiz', path: `${APP_BASE}/quiz`, icon: ListChecks },
  { label: 'My Notebook', path: `${APP_BASE}/notebook`, icon: NotebookPen },
  { label: 'Revision Calendar', path: `${APP_BASE}/revision`, icon: CalendarDays },
  { label: 'My Progress', path: `${APP_BASE}/progress`, icon: BarChart3 },
  { label: 'Notifications', path: `${APP_BASE}/notifications`, icon: Bell },
  { label: 'Settings', path: `${APP_BASE}/settings`, icon: Settings },
]

export const landingNavigation = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Features', href: '#features' },
  { label: 'FAQ', href: '#faq' },
]
