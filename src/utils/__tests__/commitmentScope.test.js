import { describe, it, expect } from 'vitest'
import { commitmentScopeBlock } from '../aiPrompt'

const block = commitmentScopeBlock('UMass')

describe('commitmentScopeBlock', () => {
  it('names the user’s own team as the scope', () => {
    expect(block).toContain('WHOSE RECRUITS TO ENTER — UMass ONLY')
    expect(block).toContain("This sheet is UMass's recruiting class")
    expect(block).not.toContain('${')
  })

  it('rules out a recruit who signed with another school', () => {
    expect(block).toMatch(/ANOTHER school's logo[\s\S]*DO NOT OUTPUT a row/)
  })

  it('splits the blank-logo case by screen, because it means opposite things', () => {
    expect(block).toMatch(/NO logo, on a COMMIT LIST[\s\S]*DO NOT OUTPUT a row/)
    expect(block).toMatch(/NO logo, on UMass's OWN recruiting board[\s\S]*"Uncommitted"/)
  })

  it('tells the model to skip a row it cannot attribute rather than guess', () => {
    expect(block).toContain('leave that recruit out')
  })

  it('carries a team name with punctuation through unchanged', () => {
    expect(commitmentScopeBlock('Texas A&M')).toContain('WHOSE RECRUITS TO ENTER — Texas A&M ONLY')
    expect(commitmentScopeBlock('Miami (OH)')).toContain("This sheet is Miami (OH)'s recruiting class")
  })
})
