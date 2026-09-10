import { describe, it, expect } from 'vitest'
import {
  getHeismanVideoUrl, latestHeismanVideo, withHeismanVideoUrl, preserveHeismanVideo,
  stripVideoUrl, buildHeismanEmbedUrl, isPlayableVideoUrl,
} from '../heismanVideo'

const row = (extra = {}) => ({ player: 'Star QB', position: 'QB', team: 'IU', tid: 42, class: 'Jr', ...extra })

describe('getHeismanVideoUrl / latestHeismanVideo', () => {
  const d = { awardsByYear: { 2030: { heisman: row({ videoUrl: ' https://youtu.be/abc123 ' }) }, '2031': { heisman: row() } } }
  it('reads the trimmed URL under numeric or string year keys', () => {
    expect(getHeismanVideoUrl(d, 2030)).toBe('https://youtu.be/abc123')
    expect(getHeismanVideoUrl(d, '2030')).toBe('https://youtu.be/abc123')
    expect(getHeismanVideoUrl(d, 2031)).toBeNull()
    expect(getHeismanVideoUrl(d, 2029)).toBeNull()
    expect(getHeismanVideoUrl(null, 2030)).toBeNull()
  })
  it('picks the newest season that has a video', () => {
    expect(latestHeismanVideo(d, [2030, 2031])).toEqual({ year: 2030, url: 'https://youtu.be/abc123' })
    expect(latestHeismanVideo(d, [2031])).toBeNull()
    expect(latestHeismanVideo(d, [])).toBeNull()
  })
})

describe('withHeismanVideoUrl (the modal input)', () => {
  it('attaches, clears with an empty string, and is a no-op when unchanged or without a winner', () => {
    const awards = { heisman: row(), maxwell: row({ player: 'Other' }) }
    expect(withHeismanVideoUrl(awards, ' https://youtu.be/x ').heisman.videoUrl).toBe('https://youtu.be/x')
    expect(withHeismanVideoUrl(awards, '').heisman.videoUrl).toBe('')
    const withUrl = { heisman: row({ videoUrl: 'https://youtu.be/x' }) }
    expect(withHeismanVideoUrl(withUrl, 'https://youtu.be/x')).toBe(withUrl)
    const noWinner = { maxwell: row() }
    expect(withHeismanVideoUrl(noWinner, 'https://youtu.be/x')).toBe(noWinner)
  })
})

describe('preserveHeismanVideo (re-saves that never mention the field)', () => {
  const existing = { heisman: row({ videoUrl: 'https://youtu.be/kept' }) }
  it('carries the saved URL onto a fresh object', () => {
    const fresh = { heisman: row() }
    expect(preserveHeismanVideo(fresh, existing).heisman.videoUrl).toBe('https://youtu.be/kept')
  })
  it('respects an explicit value, including an explicit clear', () => {
    const cleared = { heisman: row({ videoUrl: '' }) }
    expect(preserveHeismanVideo(cleared, existing)).toBe(cleared)
    const replaced = { heisman: row({ videoUrl: 'https://youtu.be/new' }) }
    expect(preserveHeismanVideo(replaced, existing)).toBe(replaced)
  })
  it('is a no-op when there is nothing to keep or no winner', () => {
    const fresh = { heisman: row() }
    expect(preserveHeismanVideo(fresh, { heisman: row() })).toBe(fresh)
    expect(preserveHeismanVideo(fresh, undefined)).toBe(fresh)
    const noWinner = { maxwell: row() }
    expect(preserveHeismanVideo(noWinner, existing)).toBe(noWinner)
  })
})

describe('stripVideoUrl', () => {
  it('removes the field for the honors pipeline and leaves other rows alone', () => {
    expect(stripVideoUrl(row({ videoUrl: 'x' }))).toEqual(row())
    const plain = row()
    expect(stripVideoUrl(plain)).toBe(plain)
    expect(stripVideoUrl(null)).toBeNull()
  })
})

describe('buildHeismanEmbedUrl — the full ceremony, not a clip', () => {
  it('embeds YouTube links with the start time and NO auto end', () => {
    const u = new URL(buildHeismanEmbedUrl('https://youtu.be/abc123?t=90'))
    expect(u.origin + u.pathname).toBe('https://www.youtube-nocookie.com/embed/abc123')
    expect(u.searchParams.get('start')).toBe('90')
    expect(u.searchParams.has('end')).toBe(false)
    expect(u.searchParams.get('autoplay')).toBe('1')
    expect(u.searchParams.get('controls')).toBe('1')
    const plain = new URL(buildHeismanEmbedUrl('https://www.youtube.com/watch?v=abc123'))
    expect(plain.searchParams.has('start')).toBe(false)
    expect(plain.searchParams.has('end')).toBe(false)
  })
  it('keeps an end time only when the link itself carries one', () => {
    const trimmed = new URL(buildHeismanEmbedUrl('https://youtubetrimmer.com/view/?v=abc123&start=10&end=400'))
    expect(trimmed.searchParams.get('start')).toBe('10')
    expect(trimmed.searchParams.get('end')).toBe('400')
    const embed = new URL(buildHeismanEmbedUrl('https://www.youtube.com/embed/abc123?start=5&end=50'))
    expect(embed.searchParams.get('end')).toBe('50')
  })
  it('rejects empty or unknown links', () => {
    expect(buildHeismanEmbedUrl('')).toBeNull()
    expect(buildHeismanEmbedUrl(null)).toBeNull()
    expect(isPlayableVideoUrl('https://youtu.be/abc123')).toBe(true)
    expect(isPlayableVideoUrl('not a url')).toBe(false)
  })
})
