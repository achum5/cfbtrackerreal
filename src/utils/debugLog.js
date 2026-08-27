// On-device diagnostic log capture, for debugging live issues on a user's own
// phone/browser — where there's no devtools console to read and "what did it
// say?" is otherwise unanswerable. Captures console.warn/console.error plus
// uncaught errors and unhandled promise rejections into a small in-memory
// ring buffer; DebugLogPanel.jsx renders it and offers one-tap copy.
//
// Deliberately NOT console.log/info/debug: the production build marks those
// pure and strips the calls entirely (vite.config.js esbuild.pure), so
// warn/error IS the complete diagnostic surface that actually exists in
// production. Capture is installed unconditionally at boot (a few pushes to
// an array — no measurable cost) so the buffer already holds the history
// when the user flips the panel on AFTER something went wrong; whether any
// UI shows is a separate, per-account gate (see DebugLogPanel).

const MAX_ENTRIES = 400
const entries = []
const listeners = new Set()
let installed = false
let seq = 0

const ENABLED_KEY = 'cfb-debug-logs-enabled'

export function isDebugLogEnabled() {
  try { return localStorage.getItem(ENABLED_KEY) === '1' } catch { return false }
}

export function setDebugLogEnabled(on) {
  try { on ? localStorage.setItem(ENABLED_KEY, '1') : localStorage.removeItem(ENABLED_KEY) } catch { /* storage blocked */ }
  notify()
}

function notify() {
  for (const fn of listeners) { try { fn() } catch { /* listener must never break capture */ } }
}

function push(level, parts) {
  const text = parts.map((p) => {
    if (typeof p === 'string') return p
    if (p instanceof Error) return `${p.name}: ${p.message}${p.stack ? `\n${p.stack}` : ''}`
    try { return JSON.stringify(p) } catch { return String(p) }
  }).join(' ')
  entries.push({ id: ++seq, at: new Date(), level, text: text.slice(0, 4000) })
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES)
  notify()
}

export function installDebugLogCapture() {
  if (installed || typeof window === 'undefined') return
  installed = true
  const origWarn = console.warn.bind(console)
  const origError = console.error.bind(console)
  console.warn = (...args) => { push('warn', args); origWarn(...args) }
  console.error = (...args) => { push('error', args); origError(...args) }
  window.addEventListener('error', (e) => {
    push('error', [e?.error || e?.message || 'window error'])
  })
  window.addEventListener('unhandledrejection', (e) => {
    push('error', ['Unhandled rejection:', e?.reason || e])
  })
}

export function getDebugLogEntries() {
  return entries
}

export function clearDebugLog() {
  entries.length = 0
  notify()
}

export function subscribeDebugLog(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// The whole buffer as paste-ready text: version + context header, then one
// timestamped line per entry, oldest first.
export function debugLogAsText() {
  const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'
  const header = [
    `CFB Dynasty Tracker debug log`,
    `version: v${version}`,
    `url: ${window.location.href}`,
    `userAgent: ${navigator.userAgent}`,
    `captured: ${new Date().toISOString()}`,
    `entries: ${entries.length}`,
    '',
  ].join('\n')
  return header + entries
    .map((e) => `[${e.at.toISOString().slice(11, 23)}] ${e.level.toUpperCase()} ${e.text}`)
    .join('\n')
}
