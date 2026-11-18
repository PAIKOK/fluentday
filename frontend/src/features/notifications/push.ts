import { api } from '@/lib/api'

export type PushSupport = 'supported' | 'unsupported' | 'denied'

export function pushSupport(): PushSupport {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported'
  }
  return Notification.permission === 'denied' ? 'denied' : 'supported'
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

export class PushError extends Error {}

/** Asks for permission, subscribes this browser and registers it with the server. */
export async function enablePush(publicKey: string): Promise<void> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new PushError(
      permission === 'denied'
        ? 'Notifications are blocked for FluentDay. Allow them in your browser’s site settings, then try again.'
        : 'Push reminders need your permission. Switch them on again when you’re ready.',
    )
  }
  const registration = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }))
  const { endpoint, keys } = subscription.toJSON()
  await api('/notifications/push/subscriptions', { method: 'POST', json: { endpoint, keys } })
}

/** Unsubscribes this browser and tells the server. */
export async function disablePush(): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration('/sw.js')
  const subscription = await registration?.pushManager.getSubscription()
  if (subscription) {
    await api('/notifications/push/unsubscribe', { method: 'POST', json: { endpoint: subscription.endpoint } })
    await subscription.unsubscribe()
  }
}
