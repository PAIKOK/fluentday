// FluentDay service worker: shows daily reminder push notifications and opens the app when one is clicked.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'FluentDay', {
      body: data.body || 'Your lesson is ready.',
      icon: '/favicon.svg',
      data: { url: data.url || '/app' },
      tag: 'fluentday-daily',
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/app', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url.startsWith(self.location.origin))
      return open ? open.navigate(url).then((w) => w && w.focus()) : self.clients.openWindow(url)
    }),
  )
})
