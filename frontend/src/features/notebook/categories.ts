import { AlertCircle, BookOpen, MessageSquareQuote, PenLine, type LucideIcon } from 'lucide-react'
import type { NotebookCategory } from '@/types/phase4'

export const NOTEBOOK_CATEGORIES: { id: NotebookCategory; label: string; icon: LucideIcon; empty: string }[] = [
  { id: 'vocabulary', label: 'My Vocabulary', icon: BookOpen, empty: 'Words you save from your daily lessons live here.' },
  { id: 'expressions', label: 'My Expressions', icon: MessageSquareQuote, empty: 'Save useful phrases you hear in the Listening Room.' },
  { id: 'sentences', label: 'My Sentences', icon: PenLine, empty: 'Sentences you write with new words are collected here.' },
  { id: 'mistakes', label: 'My Mistakes', icon: AlertCircle, empty: 'Note down mistakes so you can learn from them.' },
]

export const categoryLabel = (id: NotebookCategory) => NOTEBOOK_CATEGORIES.find((c) => c.id === id)?.label ?? id
