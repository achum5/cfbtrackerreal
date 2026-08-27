// EA CFB ratings puller — paste this whole file into the browser console
// on https://www.ea.com/games/ea-sports-college-football/ratings
//
// Why the browser and not a script: drop-api.ea.com only accepts requests
// whose Origin is https://www.ea.com, and it requires the `x-feature`
// header (which triggers a CORS preflight the API only answers for that
// origin). Running it from the page itself is the path of least friction —
// no keys, no proxy, no headless browser.
//
// Picks the NEWEST ratings iteration EA has published rather than a
// hardcoded one, so a roster update is pulled automatically once it lands.
// It prints every iteration it saw and which one it used, and refuses to
// re-download launch ratings we already ship unless you ask it to.
//
// Downloads `ea-cfb-ratings-<iteration>.json`. Feed that to
// scripts/convertEaRatings.mjs to regenerate src/data/cfb27Rosters/{tid}.json.
//
// To force a re-pull of an iteration already shipped, run with:
//   window.EA_FORCE = true
// before pasting.

;(async () => {
  const BASE = 'https://drop-api.ea.com/rating/ea-sports-college-football'
  const HDRS = {
    accept: 'application/json',
    'x-feature': '8586515909697864000',
    'drop-referrer': 'https://www.ea.com/games/ea-sports-college-football/ratings',
  }
  const LIMIT = 100
  // Already generated into src/data/cfb27Rosters — pulling it again is a
  // few minutes spent to produce a byte-identical file.
  const ALREADY_SHIPPED = '1-base'

  // The endpoint 500s intermittently (seen in the wild), so every request
  // gets retried with backoff before we give up on the whole run.
  const get = async (url, tries = 5) => {
    for (let i = 0; i < tries; i++) {
      const r = await fetch(url, { headers: HDRS, credentials: 'omit' })
      if (r.ok) return r.json()
      console.warn('HTTP', r.status, '- retry', i + 1, 'of', tries)
      await new Promise((s) => setTimeout(s, 1500 * (i + 1)))
    }
    throw new Error('gave up on ' + url)
  }

  const rowsOf = (j) => j.docs || j.items || j.results || j.data || []

  // Probe one record to see what EA has published. availableIterations is
  // EA's own list of every version of that player's ratings, so its last
  // entry is the newest thing there is to pull.
  console.log('Checking which ratings iterations EA has published…')
  const probe = await get(`${BASE}?locale=en&limit=1`)
  const iterations = rowsOf(probe)[0]?.availableIterations || []
  if (!iterations.length) {
    console.error('Could not read availableIterations — EA may have changed the response shape. Send this to Claude:', JSON.stringify(rowsOf(probe)[0]).slice(0, 800))
    return
  }
  console.log('Iterations available:', iterations.map((i) => `${i.id} (${i.label})`).join(', '))

  const chosen = iterations[iterations.length - 1]
  if (chosen.id === ALREADY_SHIPPED && !window.EA_FORCE) {
    console.log(`%cNothing new. EA is still only publishing "${chosen.id}" (${chosen.label}), which the tracker already ships.`, 'font-weight:bold')
    console.log('The in-game roster update has not reached the web API yet. Check again later.')
    console.log('To re-download it anyway: set window.EA_FORCE = true and re-run.')
    return
  }
  console.log(`%cPulling "${chosen.id}" (${chosen.label})…`, 'font-weight:bold;color:green')

  const all = []
  let offset = 0
  let total = null
  for (;;) {
    const j = await get(`${BASE}?locale=en&limit=${LIMIT}&offset=${offset}&iteration=${encodeURIComponent(chosen.id)}`)
    const rows = rowsOf(j)
    if (total == null) total = j.totalCount ?? j.count ?? j.total ?? null
    if (!rows.length) break
    all.push(...rows)
    console.log(`${all.length}${total ? ' / ' + total : ''}`)
    offset += LIMIT
    if (total && all.length >= total) break
    if (offset > 40000) break // runaway guard
    await new Promise((s) => setTimeout(s, 250))
  }

  console.log('DONE —', all.length, 'players, iteration', chosen.id)
  const blob = new Blob([JSON.stringify(all)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `ea-cfb-ratings-${chosen.id}.json`
  a.click()
  console.log(`%cSaved ea-cfb-ratings-${chosen.id}.json — zip it and send it over.`, 'font-weight:bold')
})()
