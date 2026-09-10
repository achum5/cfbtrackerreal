// Heisman Trophy presentation video — one optional URL per season, stored on
// the award row itself: dynasty.awardsByYear[year].heisman.videoUrl.
//
// Why the award row and not a separate field: every reader of the winner
// already has that row in hand (Awards page card, Heisman Watch banner, the
// Player page plates/tiles, the Team Year award list), so the play button
// can be decided from the same object with no extra lookup. The cost is
// that the awards paste flow rebuilds the whole year's object on every
// save — preserveHeismanVideo carries the URL across those re-saves.
//
// Only the Heisman is exposed in the UI. The field is plain enough that
// another award could carry one later without a migration.

import { getYouTubeData, getEmbedUrl } from '../components/ScoringHighlightsModal'

export const normalizeVideoUrl = (url) => (typeof url === 'string' ? url.trim() : '')

/** The saved presentation URL for a season, or null. */
export function getHeismanVideoUrl(dynasty, year) {
  const byYear = dynasty?.awardsByYear
  if (!byYear) return null
  const row = byYear[year]?.heisman ?? byYear[String(year)]?.heisman ?? byYear[Number(year)]?.heisman
  const url = normalizeVideoUrl(row?.videoUrl)
  return url || null
}

/** Newest season in `years` that has a presentation video: { year, url } or null. */
export function latestHeismanVideo(dynasty, years) {
  const sorted = [...new Set((years || []).map(Number).filter(Number.isFinite))].sort((a, b) => b - a)
  for (const y of sorted) {
    const url = getHeismanVideoUrl(dynasty, y)
    if (url) return { year: y, url }
  }
  return null
}

/**
 * Attach the modal's URL input to a freshly parsed awards object. An empty
 * string is an explicit clear (the input is pre-filled with the saved URL,
 * so blank means the user removed it). No Heisman row → nothing to attach.
 */
export function withHeismanVideoUrl(awards, url) {
  if (!awards?.heisman) return awards
  const next = normalizeVideoUrl(url)
  if (awards.heisman.videoUrl === next) return awards
  return { ...awards, heisman: { ...awards.heisman, videoUrl: next } }
}

/**
 * Carry a saved presentation URL onto a re-saved awards object that never
 * mentioned one (Google-sheet sync, save-file sync, an older client). A row
 * that sets videoUrl — even to '' — is left alone: that was a decision.
 * Returns the same object when nothing changes.
 */
export function preserveHeismanVideo(newAwards, existingAwards) {
  if (!newAwards?.heisman) return newAwards
  if (newAwards.heisman.videoUrl !== undefined) return newAwards
  const kept = normalizeVideoUrl(existingAwards?.heisman?.videoUrl)
  if (!kept) return newAwards
  return { ...newAwards, heisman: { ...newAwards.heisman, videoUrl: kept } }
}

/** Strip the video field from rows headed into the player-honors pipeline. */
export const stripVideoUrl = (row) => {
  if (!row || row.videoUrl === undefined) return row
  const rest = { ...row }
  delete rest.videoUrl
  return rest
}

/**
 * Embed URL for the FULL presentation. Scoring-play clips auto-end a few
 * seconds after their start time; a ceremony must not, so YouTube links are
 * built here directly (start honored, no end unless the link itself carries
 * one). Anything that isn't YouTube falls through to the shared embed helper.
 */
export function buildHeismanEmbedUrl(url) {
  const clean = normalizeVideoUrl(url)
  if (!clean) return null
  const yt = getYouTubeData(clean)
  if (yt?.videoId) {
    const params = new URLSearchParams({ autoplay: '1', rel: '0', modestbranding: '1', controls: '1', playsinline: '1' })
    if (yt.startSec != null && yt.startSec > 0) params.set('start', String(yt.startSec))
    const explicitEnd = explicitEndSeconds(clean)
    if (explicitEnd != null) params.set('end', String(explicitEnd))
    return `https://www.youtube-nocookie.com/embed/${yt.videoId}?${params.toString()}`
  }
  return getEmbedUrl(clean, { controls: 1 })
}

// An end time is only respected when the link itself states one (trimmer
// share links, or an /embed URL with ?end=). Plain watch links never end early.
function explicitEndSeconds(url) {
  const trimmer = url.match(/youtubetrimmer\.com\/view\/?\?([^#]+)/)
  if (trimmer) {
    const e = parseInt(new URLSearchParams(trimmer[1]).get('end'), 10)
    return Number.isFinite(e) ? e : null
  }
  if (/youtube(?:-nocookie)?\.com\/embed\//.test(url)) {
    try {
      const e = parseInt(new URL(url).searchParams.get('end'), 10)
      return Number.isFinite(e) ? e : null
    } catch { return null }
  }
  return null
}

/** Can we embed this at all? Used to gate the play button. */
export const isPlayableVideoUrl = (url) => !!buildHeismanEmbedUrl(url)
