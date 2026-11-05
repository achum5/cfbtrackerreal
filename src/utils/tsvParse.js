// Local TSV paste parsing — the no-Google-Sheets ingest path.
//
// The app's AI prompts already emit tab-separated values (TSV): one record
// per line, cells split by a single tab, no CSV quoting, no commas inside
// numbers. That is exactly what the Google read functions get back from the
// Sheets API as `data.values` (an array of arrays of cell strings). So a user
// can paste the AI's reply straight into a textarea and we split it into the
// SAME rows[][] shape the existing parsers already consume — no sheet, no
// OAuth, no rate limits.
//
// splitTsv(text) -> string[][]
//   One inner array per data line, each holding that line's tab-separated
//   cells. Skips blank lines, Markdown code fences (``` ...), and the
//   "=== LABEL ===" paste-target markers the prompts wrap their output in,
//   so the AI reply can be pasted verbatim. Only TRAILING empty cells are
//   dropped by the split (a line "420\t" yields ["420"]); callers read cells
//   positionally with `row[i] ?? ''`, so a short row reads as blanks — the
//   same behavior the Sheets API gives (it omits trailing empty cells too).
// Some prompts ask the AI for a human-readable preamble (or a ```worksheet
// audit block) BEFORE the actual data, with the data itself wrapped in a ```tsv
// fenced block. When a user pastes the WHOLE reply ("Claude output two things"),
// those prose lines would otherwise leak in as bogus rows. If a ```tsv block is
// present, parse ONLY its contents. An unclosed fence (truncated paste) still
// yields its data. No ```tsv fence → unchanged behavior (backward compatible).
//
// EVERY tsv block is collected, not just the first. AI replies routinely split
// long output across several fenced blocks — interleaved with commentary, or
// chunked by day/conference ("here are the rest of the games:"). Reading only
// the first block silently dropped everything after it, which is what made a
// full 55-game week import as ~10 games with no error shown. Blocks are joined
// with a newline so they read as one continuous set of rows.
// Implemented as a line scanner rather than a regex: a lazy multi-block regex
// mis-pairs fences when a block is empty (it swallows the NEXT block's opening
// fence and yields nothing at all), and this shape is easy to reason about.
function extractTsvBlock(text) {
  const str = String(text)
  const lines = str.replace(/\r\n?/g, '\n').split('\n')
  const collected = []
  let sawFence = false
  let inTsv = false
  for (const line of lines) {
    const t = line.trim()
    if (!inTsv) {
      // Only a ```tsv fence opens a data block — a ```worksheet audit block
      // (some prompts ask for one) is deliberately left out.
      if (/^```tsv\b/i.test(t) || /^```tsv$/i.test(t)) { inTsv = true; sawFence = true }
      continue
    }
    if (t.startsWith('```')) { inTsv = false; continue } // closing fence
    collected.push(line)
  }
  return sawFence ? collected.join('\n') : str
}

export function splitTsv(text) {
  if (!text) return []
  return String(extractTsvBlock(text))
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, '')) // drop trailing spaces/tabs only
    .filter((line) => {
      const t = line.trim()
      if (t === '') return false
      if (t.startsWith('```')) return false // markdown code fence
      if (/^={2,}.*={2,}$/.test(t)) return false // === paste-target label ===
      return true
    })
    .map((line) => line.split('\t'))
}

// splitTsv for a paste that may have lost its tabs. Identical to splitTsv
// whenever ANY line has a tab. With none, each line is split as a Markdown
// table row ("| QB | John Smith | ... |", divider rows dropped) or, failing
// that, on runs of 2+ spaces — what an AI reply turns into when it's copied
// as a rendered table or through an app that converts tabs to spaces. Plain
// splitTsv read those as one cell per line, so the honors imports found no
// players and saved an empty list.
export function splitTsvTolerant(text) {
  const rows = splitTsv(text)
  if (rows.some((r) => r.length > 1)) return rows
  const out = []
  for (const [line] of rows) {
    const t = line.trim()
    if (t.includes('|')) {
      if (/^\|?[\s:|-]+\|?$/.test(t)) continue // | --- | :---: | divider
      const cells = t.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())
      out.push(cells)
    } else {
      out.push(t.split(/\s{2,}/))
    }
  }
  return out
}
