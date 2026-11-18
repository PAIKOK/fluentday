export type Channel = 'in_app' | 'email' | 'push'

export interface AppNotification {
  id: string
  kind: string
  title: string
  body: string
  link: string | null
  created_at: string
  read: boolean
}

export interface NotificationList {
  items: AppNotification[]
  unread: number
}

export interface PushConfig {
  enabled: boolean
  public_key: string | null
}
