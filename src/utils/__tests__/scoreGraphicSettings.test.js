import { describe, it, expect } from 'vitest'
import {
  buildScoreGraphicPrompt,
  GRAPHIC_STYLE_OPTIONS,
  GRAPHIC_EMPHASIS_OPTIONS,
  DEFAULT_GRAPHIC_SETTINGS,
} from '../scoreGraphicPrompt'

// These sliders used to barely move the prompt: three of the nine stops
// produced a byte-identical prompt, "Records: standard" emitted nothing at
// all, and the one style line that did land contradicted the rendering
// sentence already in the prompt. Every stop must now change the output, and
// the photo path's invariant must survive all of them.

const base = {
  team1Name: 'Kentucky Wildcats', team1Score: 23, team1Rank: 12, team1Record: '3-1',
  team2Name: 'Ball State Cardinals', team2Score: 34, team2Rank: 8, team2Record: '4-0',
  gameLabel: 'Week 3', year: 2027, homeTeam: 1, gameType: 'regular',
}
const build = (o = {}) => buildScoreGraphicPrompt({ ...base, featuredTeam: 1, ...o })

describe('slider shape', () => {
  it('is five stops per slider, with the default in the middle', () => {
    expect(GRAPHIC_STYLE_OPTIONS).toHaveLength(5)
    expect(GRAPHIC_EMPHASIS_OPTIONS).toHaveLength(5)
    expect(GRAPHIC_STYLE_OPTIONS[2].key).toBe(DEFAULT_GRAPHIC_SETTINGS.designStyle)
    expect(GRAPHIC_EMPHASIS_OPTIONS[2].key).toBe(DEFAULT_GRAPHIC_SETTINGS.rankEmphasis)
    expect(GRAPHIC_EMPHASIS_OPTIONS[2].key).toBe(DEFAULT_GRAPHIC_SETTINGS.recordEmphasis)
  })

  it('every style stop carries all three directives it drives', () => {
    for (const o of GRAPHIC_STYLE_OPTIONS) {
      expect(o.designBullets.length).toBeGreaterThan(0)
      expect(o.renderBody).toBeTruthy()
      expect(o.overlayNote).toContain('Overlay budget')
    }
  })
})

describe('every stop changes the prompt', () => {
  for (const featuredTeam of [0, 1]) {
    for (const screenshotCount of [0, 2]) {
      const label = `featuredTeam=${featuredTeam} photos=${screenshotCount}`
      it(`design style: five distinct prompts (${label})`, () => {
        const outs = GRAPHIC_STYLE_OPTIONS.map(o => build({ designStyle: o.key, featuredTeam, screenshotCount }))
        expect(new Set(outs).size).toBe(5)
      })
      it(`rankings: five distinct prompts (${label})`, () => {
        const outs = GRAPHIC_EMPHASIS_OPTIONS.map(o => build({ rankEmphasis: o.key, featuredTeam, screenshotCount }))
        expect(new Set(outs).size).toBe(5)
      })
      it(`records: five distinct prompts (${label})`, () => {
        const outs = GRAPHIC_EMPHASIS_OPTIONS.map(o => build({ recordEmphasis: o.key, featuredTeam, screenshotCount }))
        expect(new Set(outs).size).toBe(5)
      })
    }
  }

  it('left is simpler and right is busier, measured in element budget wording', () => {
    const minimal = build({ designStyle: 'minimal' })
    const maximal = build({ designStyle: 'maximal' })
    expect(minimal).toContain('Element budget')
    expect(minimal).toContain('No gradients')
    expect(maximal).toContain('Layer it')
    expect(maximal).not.toContain('No gradients')
  })
})

describe('the uploaded photo stays the graphic at every style', () => {
  for (const o of GRAPHIC_STYLE_OPTIONS) {
    it(`${o.key} keeps the photo full-bleed with elements on top`, () => {
      const out = build({ designStyle: o.key, screenshotCount: 1 })
      expect(out).toContain('THE PHOTO IS THE GRAPHIC')
      expect(out).toContain('fills the entire 1080×1080 canvas, bleeding corner to corner')
      expect(out).toContain('overlay the photo directly as floating elements')
      // The cap that stops a busy style becoming a panel over the image.
      expect(out).toContain('covering more than ~15% of the canvas')
      expect(out).toContain(o.overlayNote)
    })
  }

  it('the busiest style is told to layer on top of the photo, never instead of it', () => {
    const out = build({ designStyle: 'maximal', screenshotCount: 1 })
    expect(out).toContain('never instead of it')
  })
})

describe('both paths still ship when we cannot know about an attachment', () => {
  for (const o of GRAPHIC_STYLE_OPTIONS) {
    it(`${o.key} offers the no-image and the image branch`, () => {
      const out = build({ designStyle: o.key, screenshotCount: 0 })
      expect(out).toContain('IF NO IMAGE WAS ATTACHED')
      expect(out).toContain('IF THE USER ATTACHED AN IMAGE')
      // The no-image branch renders in this style, not a fixed house style.
      expect(out).toContain(o.renderBody)
    })
  }
})

describe('the style no longer contradicts the rendering sentence', () => {
  it('minimal never promises gradients; balanced still does', () => {
    expect(build({ designStyle: 'minimal', screenshotCount: 0 })).not.toContain('gradients are all welcome')
    expect(build({ designStyle: 'clean', screenshotCount: 0 })).not.toContain('gradients are all welcome')
    expect(build({ designStyle: 'balanced', screenshotCount: 0 })).toContain('gradients are all welcome')
  })
})

describe('hide still hides, and nothing is asked for that was never supplied', () => {
  it('rank hide drops the block and the #N labels', () => {
    const out = build({ rankEmphasis: 'hide' })
    expect(out).not.toContain('RANKINGS')
    expect(out).not.toContain('#12')
  })
  it('record hide drops the parentheticals', () => {
    const out = build({ recordEmphasis: 'hide' })
    expect(out).not.toContain('(3-1)')
    expect(out).not.toContain('• Records:')
  })
  it('a game with no records never asks for a record, at any stop', () => {
    for (const o of GRAPHIC_EMPHASIS_OPTIONS) {
      for (const featuredTeam of [0, 1]) {
        const out = build({ recordEmphasis: o.key, featuredTeam, team1Record: null, team2Record: null })
        expect(out).not.toContain('• Records:')
      }
    }
  })
  it('an unranked game never asks for a rank, at any stop', () => {
    for (const o of GRAPHIC_EMPHASIS_OPTIONS) {
      const out = build({ rankEmphasis: o.key, team1Rank: null, team2Rank: null })
      expect(out).not.toContain('RANKINGS —')
    }
  })
})

describe('unknown or stale keys fall back to the default stop', () => {
  it('a three-stop-era value resolves to the house default', () => {
    expect(build({ designStyle: 'nonsense' })).toBe(build({ designStyle: 'balanced' }))
    expect(build({ rankEmphasis: 'nonsense' })).toBe(build({ rankEmphasis: 'standard' }))
    expect(build({ recordEmphasis: 'nonsense' })).toBe(build({ recordEmphasis: 'standard' }))
  })
})
