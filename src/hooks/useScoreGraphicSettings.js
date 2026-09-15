import { useState, useEffect } from 'react'
import { DEFAULT_GRAPHIC_SETTINGS, GRAPHIC_STYLE_OPTIONS, GRAPHIC_EMPHASIS_OPTIONS } from '../utils/scoreGraphicPrompt'

// The score-graphic slider values, per device (localStorage), shared by every
// surface that copies a score-graphic prompt.
//
// There are two such surfaces — the Edit Game page and the Score Graphic card
// on the game page — and only the first one used to read these at all. The
// game page built its prompt without passing any of them, so the sliders were
// inert there no matter what you set. One hook now backs both, on the same
// three keys, so a change in either place applies in both.

const KEYS = {
  designStyle: 'scoreGraphicStyle',
  rankEmphasis: 'scoreGraphicRankEmphasis',
  recordEmphasis: 'scoreGraphicRecordEmphasis',
}

// A stored value from an older build may name a stop that no longer exists
// (the sliders went from three stops to five). Fall back to the default rather
// than leaving the slider pinned at index 0.
const valid = {
  designStyle: (v) => GRAPHIC_STYLE_OPTIONS.some(o => o.key === v),
  rankEmphasis: (v) => GRAPHIC_EMPHASIS_OPTIONS.some(o => o.key === v),
  recordEmphasis: (v) => GRAPHIC_EMPHASIS_OPTIONS.some(o => o.key === v),
}

const read = (field) => {
  try {
    const v = localStorage.getItem(KEYS[field])
    return valid[field](v) ? v : DEFAULT_GRAPHIC_SETTINGS[field]
  } catch {
    return DEFAULT_GRAPHIC_SETTINGS[field]
  }
}

export function useScoreGraphicSettings() {
  const [designStyle, setDesignStyle] = useState(() => read('designStyle'))
  const [rankEmphasis, setRankEmphasis] = useState(() => read('rankEmphasis'))
  const [recordEmphasis, setRecordEmphasis] = useState(() => read('recordEmphasis'))

  useEffect(() => { try { localStorage.setItem(KEYS.designStyle, designStyle) } catch { /* ignored */ } }, [designStyle])
  useEffect(() => { try { localStorage.setItem(KEYS.rankEmphasis, rankEmphasis) } catch { /* ignored */ } }, [rankEmphasis])
  useEffect(() => { try { localStorage.setItem(KEYS.recordEmphasis, recordEmphasis) } catch { /* ignored */ } }, [recordEmphasis])

  return {
    designStyle, setDesignStyle,
    rankEmphasis, setRankEmphasis,
    recordEmphasis, setRecordEmphasis,
    // Spread straight into buildScoreGraphicPrompt.
    promptSettings: { designStyle, rankEmphasis, recordEmphasis },
  }
}
