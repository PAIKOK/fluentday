// Drives the real app in headless Chrome. Usage: node scripts/browser-check.mjs [baseUrl]
// Prints PASS/FAIL lines and saves screenshots to /tmp/fluentday-shots.
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { chromium } from 'playwright-core'
import { fixtures } from './fixtures.mjs'

const require = createRequire(import.meta.url)
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')
const BASE = process.argv[2] ?? 'http://localhost:5173'
const SHOTS = '/tmp/fluentday-shots'
fs.mkdirSync(SHOTS, { recursive: true })

let failures = 0
const check = (cond, msg) => {
  if (!cond) failures++
  console.log(`${cond ? 'PASS' : 'FAIL'} ${msg}`)
}

// Pages that render without signing in. (/app and /admin need the backend; see README.)
const ROUTES = ['/', '/about', '/contact', '/privacy', '/terms', '/does-not-exist', '/login', '/register', '/forgot-password', '/reset-password?token=example-token', '/unsubscribe?token=example-token-123']
// Without a backend the session check (/api/auth/me) fails; that is expected here.
const EXPECTED_ERROR = /Failed to load resource: the server responded with a status of (401|500|502|504)|Something went wrong \((500|502|504)\)|The FluentDay server isn’t responding/
const WIDTHS = [[375, 812], [768, 1024], [1280, 900]]
// Signed-in pages, rendered against fake API responses (scripts/fixtures.mjs).
const MOCKED = [
  ['subscriber', ['/app', '/app/vocabulary', '/app/vocabulary/w1', '/app/listening', '/app/notebook', '/app/revision', '/app/pronunciation', '/app/quiz', '/app/progress', '/app/notifications', '/app/settings']],
  ['admin', ['/admin', '/admin/books', '/admin/vocabulary', '/admin/youtube', '/admin/users']],
]

// A 1×1 PNG and a tiny stand-in for YouTube's IFrame API, so the check runs offline
// (the fixture video IDs aren't real videos).
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
const YT_STUB = `window.YT = { PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 }, Player: class {
  constructor(el, o) { el.textContent = 'Video ' + o.videoId; el.style.cssText = 'color:#fff;display:flex;align-items:center;justify-content:center;height:100%' }
  getCurrentTime() { return 0 } getDuration() { return 375 } destroy() {} } };
window.onYouTubeIframeAPIReady && window.onYouTubeIframeAPIReady();`

async function mockApi(page, role) {
  await page.route('https://i.ytimg.com/**', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }))
  await page.route('https://www.youtube.com/iframe_api', (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: YT_STUB }))
  const data = fixtures(role)
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url())
    const body = data[`${route.request().method()} ${url.pathname}`]
    return body === undefined
      ? route.fulfill({ status: 404, contentType: 'application/json', body: '{"detail":"not in fixtures"}' })
      : route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
}

const browser = await chromium.launch({ channel: 'chrome', headless: true })

async function audit(page, route, w) {
  const label = `${route} @${w}`
  const errs = []
  const onConsole = (m) => m.type() === 'error' && !EXPECTED_ERROR.test(m.text()) && errs.push(m.text())
  const onError = (e) => errs.push(e.message)
  page.on('console', onConsole)
  page.on('pageerror', onError)
  await page.goto(BASE + route, { waitUntil: 'networkidle' })
  const h1 = await page.locator('h1').first().textContent({ timeout: 5000 }).catch(() => null)
  check(Boolean(h1?.trim()), `${label}: has h1 "${h1?.trim().slice(0, 40)}"`)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check(overflow <= 0, `${label}: no horizontal scroll (overflow ${overflow}px)`)
  await page.addScriptTag({ content: AXE })
  const violations = await page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] })
    return r.violations.map((v) => `${v.id} x${v.nodes.length}: ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`)
  })
  check(violations.length === 0, `${label}: axe ${violations.length ? violations.join('; ') : 'clean'}`)
  check(errs.length === 0, `${label}: no console errors ${errs.length ? JSON.stringify(errs.slice(0, 3)) : ''}`)
  if (SHOTS_FOR.includes(route)) {
    const name = route === '/' ? 'landing' : route.slice(1).replaceAll('/', '-')
    await page.screenshot({ path: `${SHOTS}/${name}-${w}.png`, fullPage: true })
  }
  page.off('console', onConsole)
  page.off('pageerror', onError)
}

const SHOTS_FOR = ['/app', '/app/notifications', '/app/settings', '/unsubscribe?token=example-token-123']

for (const [w, h] of WIDTHS) {
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  for (const route of ROUTES) await audit(page, route, w)
  await page.close()
  for (const [role, routes] of MOCKED) {
    const signedIn = await browser.newPage({ viewport: { width: w, height: h } })
    await mockApi(signedIn, role)
    for (const route of routes) await audit(signedIn, route, w)
    await signedIn.close()
  }
}

// Interaction flows
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
await page.goto(BASE + '/')
await page.getByRole('link', { name: 'Start Learning' }).first().click()
check(page.url().endsWith('/register'), 'Hero "Start Learning" opens registration')
await page.goto(BASE + '/app/notebook')
await page.waitForURL(/\/login/)
check(page.url().endsWith('/login?next=%2Fapp%2Fnotebook'), 'Signed-out visitor to /app is sent to login with ?next=')
await page.goto(BASE + '/admin')
await page.waitForURL(/\/login/)
check(page.url().includes('/login'), 'Signed-out visitor to /admin is sent to login')
await page.goto(BASE + '/register')
await page.getByLabel('Password').fill('short')
check(await page.getByRole('button', { name: 'Create account' }).isDisabled(), 'Register button stays disabled for a short password')
await page.goto(BASE + '/')
await page.getByRole('link', { name: 'Explore Features' }).click()
check(page.url().endsWith('#features'), '"Explore Features" jumps to features')
await page.getByRole('button', { name: /where do the daily words come from/i }).click()
check(await page.getByText('three curated English vocabulary books').isVisible(), 'FAQ accordion opens')
await page.close()

const mobile = await browser.newPage({ viewport: { width: 375, height: 812 } })
await mobile.goto(BASE + '/')
await mobile.getByRole('button', { name: 'Open menu' }).click()
await mobile.getByRole('dialog').getByRole('link', { name: 'FAQ' }).click()
check(mobile.url().endsWith('#faq') && (await mobile.getByRole('dialog').count()) === 0, 'Mobile landing menu jumps to the FAQ and closes')
await mobile.close()

await browser.close()
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED')
process.exit(failures ? 1 : 0)
