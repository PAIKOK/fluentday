import type { PronunciationAccent, ProficiencyLevel } from './learning'

export type Role = 'admin' | 'subscriber'

export interface User {
  id: string
  email: string
  role: Role
  email_verified: boolean
  created_at: string
}

export interface NotificationPreferences {
  email: boolean
  push: boolean
  in_app: boolean
}

export interface Profile {
  full_name: string
  proficiency_level: ProficiencyLevel | null
  accent: PronunciationAccent
  reminder_time: string
  timezone: string
  learning_goals: string[]
  notifications: NotificationPreferences
}

export interface Me {
  user: User
  profile: Profile
}

export interface Message {
  message: string
}
