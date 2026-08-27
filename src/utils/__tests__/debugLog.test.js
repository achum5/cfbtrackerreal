import { describe, it, expect, beforeEach, vi } from 'vitest'

// Capture installs against window + console, so give the module a browser-ish
// globalThis BEFORE import. localStorage backs the per-device toggle.
const store = new Map()
globalThis.window = globalThis.window || globalThis
if (typeof globalThis.window.addEventListener !== 'function') {
  globalThis.window.addEventListener = () => {}
}
if (!globalThis.navigator?.userAgent) {
  Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'test-agent' }, configurable: true })
}
globalThis.window.location = globalThis.window.location || { href: 'https://test.local/x' }
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
}

const mod = await import('../debugLog')
const {
  installDebugLogCapture, getDebugLogEntries, clearDebugLog,
  debugLogAsText, isDebugLogEnabled, setDebugLogEnabled, subscribeDebugLog,
} = mod

installDebugLogCapture()

beforeEach(() => {
  clearDebugLog()
  store.clear()
})

describe('debug log capture', () => {
  it('captures console.warn and console.error with levels, and still forwards them', () => {
    // Forwarding matters: capture must never eat the real console output.
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    console.warn('cache stale for', 'dyn-1')
    console.error('sync failed:', new Error('boom'))
    spy.mockRestore()
    const entries = getDebugLogEntries()
    expect(entries).toHaveLength(2)
    expect(entries[0].level).toBe('warn')
    expect(entries[0].text).toContain('cache stale for dyn-1')
    expect(entries[1].level).toBe('error')
    expect(entries[1].text).toContain('boom')
  })

  it('keeps the buffer bounded', () => {
    for (let i = 0; i < 450; i++) console.warn('w', i)
    expect(getDebugLogEntries().length).toBeLessThanOrEqual(400)
    // Oldest entries fell off; the newest survived.
    const texts = getDebugLogEntries().map((e) => e.text)
    expect(texts.at(-1)).toBe('w 449')
    expect(texts).not.toContain('w 0')
  })

  it('serializes objects rather than printing [object Object]', () => {
    console.warn({ code: 'permission-denied', dynastyId: 'd1' })
    expect(getDebugLogEntries()[0].text).toContain('permission-denied')
  })

  it('produces paste-ready text with a version/url header', () => {
    console.error('it broke')
    const text = debugLogAsText()
    expect(text).toContain('CFB Dynasty Tracker debug log')
    expect(text).toContain('url: https://test.local/x')
    expect(text).toContain('ERROR it broke')
  })

  it('round-trips the per-device toggle and notifies subscribers', () => {
    expect(isDebugLogEnabled()).toBe(false)
    let fired = 0
    const unsub = subscribeDebugLog(() => fired++)
    setDebugLogEnabled(true)
    expect(isDebugLogEnabled()).toBe(true)
    setDebugLogEnabled(false)
    expect(isDebugLogEnabled()).toBe(false)
    expect(fired).toBeGreaterThanOrEqual(2)
    unsub()
  })
})
