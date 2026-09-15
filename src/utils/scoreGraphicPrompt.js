import { getTeamBrandProfile } from '../data/teamBrandProfiles'

// ─── User-adjustable graphic settings ───────────────────────────────────────
// Shared by the GraphicSettingsModal (the sliders) and buildScoreGraphicPrompt
// (which turns the chosen keys into prompt directives).
//
// Five stops each, left = simpler, right = more. The MIDDLE stop is the median
// house style — the look the page produced before these sliders existed — and
// it is spelled out explicitly rather than left blank. A silent middle was most
// of why these sliders "did nothing": three of the nine old stops emitted a
// byte-identical prompt, and the one style line that did land contradicted the
// rendering sentence already in the prompt.
//
// Each style stop drives THREE places, so the choice actually reaches the
// image model instead of sitting as one bullet among a dozen:
//   designBullets — the DESIGN RULES block (composition + effects budget)
//   renderBody    — the no-photo path's rendering sentence (the one that used
//                   to always say "gradients are all welcome", flatly
//                   contradicting Minimal)
//   overlayNote   — the photo path's overlay budget. The photo itself is
//                   ALWAYS the full-bleed base; style only changes how much
//                   sits on top of it, never whether the photo shows through.

export const GRAPHIC_STYLE_OPTIONS = [
  {
    key: 'minimal',
    label: 'Minimal',
    designBullets: [
      `Style — MINIMAL. Element budget: the score, the two team logos, and nothing else beyond what the blocks below explicitly require. Count the elements before rendering; if you are over budget, REMOVE one, do not shrink it.`,
      `Flat color only: no gradients, no glow, no drop shadows, no texture, no rendered lighting, no angled slabs, no motion streaks.`,
      `One typeface, two weights at most. At least 40% of the canvas stays empty. The negative space IS the design.`,
    ],
    renderBody: `design the full 1080×1080 as a flat, poster-grade score graphic: solid fields of color, precise typography, hard edges. No gradients, no lighting, no texture, no rendered depth — the impact comes from scale and negative space alone. Build it from team logos, typography, and color.`,
    overlayNote: `Overlay budget — MINIMAL: at most three floating elements total (the score block and the two logos). No plates, pills, or slabs unless a number would otherwise be illegible, and then keep it small and barely-there.`,
  },
  {
    key: 'clean',
    label: 'Clean',
    designBullets: [
      `Style — CLEAN. A calm, modern layout: few elements, wide margins, everything aligned to a visible grid.`,
      `One subtle depth cue at most — a soft shadow OR a single gentle gradient, used once. No texture, no glow, no stacked effects.`,
      `Typography carries the piece: clear hierarchy, generous letter and line spacing, nothing decorative.`,
    ],
    renderBody: `design the full 1080×1080 as a clean, modern score graphic — the restrained end of what an athletics department posts. Crisp typography on a disciplined grid, with at most one subtle depth cue (a soft shadow or a single gentle gradient). No texture, glow, or heavy rendering. Build it from team logos, typography, and color.`,
    overlayNote: `Overlay budget — CLEAN: the score block, the two logos, and at most one supporting element. Keep the treatment light: a soft shadow or a small translucent plate, nothing heavier.`,
  },
  {
    key: 'balanced',
    label: 'Balanced',
    designBullets: [
      `Style — BALANCED (the house default). The standard athletics-department post: the score dominant, both logos clearly placed, ranks and records as supporting elements, and ONE graphic device — a color block, a diagonal, a subtle pattern — tying the composition together.`,
      `Moderate depth is expected: real typographic craft, some dimension, restrained lighting or a single gradient. Rich, not loud.`,
    ],
    renderBody: `design the full 1080×1080 as a polished, professionally rendered score graphic, the kind a major athletics program actually posts. This is a finished, high-fidelity image — NOT flat clip-art or a plain SVG. Rich typography, depth, lighting, subtle texture, and gradients are all welcome. The ONLY thing off-limits is fabricated photo-realistic imagery of people — no made-up players, faces, or action shots. Build it from team logos, typography, color, and graphic-design elements.`,
    overlayNote: `Overlay budget — BALANCED: the score block, both logos, and the rank/record elements, arranged as one tidy lockup. A small translucent plate or a drop shadow behind the type is fine.`,
  },
  {
    key: 'bold',
    label: 'Bold',
    designBullets: [
      `Style — BOLD. Large, confident type at high contrast, on a composition with real movement: a diagonal, an off-axis lockup, or an oversized score that breaks the grid.`,
      `Pick ONE dramatic device and carry it across the whole canvas — a hard light sweep, an angular color block, or a strong duotone. Commit to it fully instead of stacking several competing effects.`,
      `The score should be the loudest thing on the canvas and still perfectly legible.`,
    ],
    renderBody: `design the full 1080×1080 as a high-impact score graphic: dramatic lighting, strong contrast, and large confident type on a dynamic composition. Depth, gradients, and rendered dimension are encouraged. The ONLY thing off-limits is fabricated photo-realistic imagery of people — no made-up players, faces, or action shots. Build it from team logos, typography, color, and graphic-design elements.`,
    overlayNote: `Overlay budget — BOLD: a heavier lockup is welcome — oversized score numerals, a strong logo pairing, a pronounced shadow or gradient scrim behind the type for contrast. That scrim is a treatment ON the photo, never a panel replacing it.`,
  },
  {
    key: 'maximal',
    label: 'Maximal',
    designBullets: [
      `Style — MAXIMAL. Layer it: texture, pattern, light and particle effects, multiple depth planes, energy filling the frame. This should read like a playoff hype post.`,
      `Build that depth with stacked PLANES rather than clutter — background texture, mid-ground color forms, foreground lockup — so the eye still lands on the score first.`,
      `Every layer must serve the score. If an effect makes a number or a logo harder to read, delete that layer.`,
    ],
    renderBody: `design the full 1080×1080 as a fully rendered, high-production hype graphic: layered texture, dramatic lighting, glow, depth planes, and rich gradients filling the canvas. The ONLY thing off-limits is fabricated photo-realistic imagery of people — no made-up players, faces, or action shots. Build it from team logos, typography, color, and graphic-design elements.`,
    overlayNote: `Overlay budget — MAXIMAL: layer freely IN THE OVERLAY — glow, outlines, stacked type, accent shapes and streaks around the lockup. The layering happens on top of the photo, never instead of it: add no panel, slab, or color wash that hides the image.`,
  },
]

// Emphasis level shared by the rankings and records sliders. Five stops,
// middle = the house default.
export const GRAPHIC_EMPHASIS_OPTIONS = [
  { key: 'hide',      label: 'Hide' },
  { key: 'subtle',    label: 'Subtle' },
  { key: 'standard',  label: 'Standard' },
  { key: 'prominent', label: 'Prominent' },
  { key: 'hero',      label: 'Hero' },
]

// Per-stop wording for the RANKINGS block. Only reached when a team in this
// game is actually ranked.
const RANK_DIRECTIVES = {
  subtle: {
    header: `RANKINGS — keep the ranking factual and quiet.`,
    line: (name, rank) => `• ${name} is ranked AP #${rank}: set a small "#${rank}" immediately before ${name}'s name or logo, in the same type family as its surroundings. No badge shape, no accent color, no extra weight — it reads as a detail, not a feature.`,
  },
  standard: {
    header: `RANKINGS — this is a Top 25 matchup detail; surface it the way broadcast and athletics-department graphics do.`,
    line: (name, rank) => `• ${name} is ranked AP #${rank}: render a clear "#${rank}" rank badge/numeral next to ${name}'s logo or name in the score zone — styled to match the design, clearly legible, not a tiny afterthought.`,
  },
  prominent: {
    header: `RANKINGS — make the AP Top 25 ranking a headline element, sized and placed the way ESPN/broadcast score bugs treat a ranked team.`,
    line: (name, rank) => `• ${name} is ranked AP #${rank}: render a large, unmistakable "#${rank}" rank badge locked to ${name}'s logo/name in the score zone — a primary element, not a footnote.`,
  },
  hero: {
    header: `RANKINGS — the ranking is part of the headline. Design the score lockup around it: one of the first three things the eye lands on, after the score itself.`,
    line: (name, rank) => `• ${name} is ranked AP #${rank}: set the "#${rank}" at or near the scale of ${name}'s own mark, in an accent color, locked to the team's side of the score. It should be impossible to miss and still never larger than the score.`,
  },
}

// Per-stop wording for records. Only reached when a record is actually known
// for someone in this game — the old "prominent" bullet fired even on a game
// with no records at all, telling the model to draw data it never received.
const RECORD_DIRECTIVES = {
  subtle: `• Records: set each team's W-L record as a small caption under its name — the smallest type on the canvas, never competing with the score.`,
  standard: `• Records: place each team's W-L record near its name or logo at supporting-caption scale — clearly legible, plainly secondary to the score.`,
  prominent: `• Records: show each team's W-L record as a clear supporting element near its name/logo — legible, not buried.`,
  hero: `• Records: give each team's W-L record its own slot in the score lockup — chipped, boxed, or rule-separated, sized just under the team name so it reads as headline information rather than a caption.`,
}

export const DEFAULT_GRAPHIC_SETTINGS = {
  designStyle: 'balanced',
  rankEmphasis: 'standard',
  recordEmphasis: 'standard',
}

const styleOption = (key) =>
  GRAPHIC_STYLE_OPTIONS.find(o => o.key === key)
  || GRAPHIC_STYLE_OPTIONS.find(o => o.key === DEFAULT_GRAPHIC_SETTINGS.designStyle)

const emphasisKey = (key, fallback) =>
  GRAPHIC_EMPHASIS_OPTIONS.some(o => o.key === key) ? key : fallback

/**
 * Build a prompt for an AI image model to generate a post-game score graphic.
 * featuredTeam = 0 → neutral media-company style
 * featuredTeam = 1 → team1's branded graphic
 * featuredTeam = 2 → team2's branded graphic
 */
export function buildScoreGraphicPrompt({
  team1Name,
  team1Score,
  team1Rank,
  team1Record,
  team1Colors,
  team2Name,
  team2Score,
  team2Rank,
  team2Record,
  team2Colors,
  gameLabel,
  year,
  featuredTeam = 1,
  homeTeam = null,
  gameType = 'regular',
  bowlName = null,
  conference = null,
  screenshotCount = 0,
  designStyle = 'balanced',
  rankEmphasis = 'standard',
  recordEmphasis = 'standard',
}) {
  // User-adjustable settings → prompt directives (see GRAPHIC_*_OPTIONS).
  const style = styleOption(designStyle)
  const rankKey = emphasisKey(rankEmphasis, DEFAULT_GRAPHIC_SETTINGS.rankEmphasis)
  const recordKey = emphasisKey(recordEmphasis, DEFAULT_GRAPHIC_SETTINGS.recordEmphasis)
  const showRanks   = rankKey !== 'hide'
  const showRecords = recordKey !== 'hide'
  // The caller knows how many photos the user has attached in the game sheet.
  // When photos are present we hard-commit the prompt to the photo path so the
  // external AI uses the attached image on the FIRST generation instead of
  // defaulting to a logo/type graphic and only using the photo after a
  // follow-up "use the image I attached" nudge.
  const hasAttachedPhoto = Number(screenshotCount) > 0
  // ─── Game context ─────────────────────────────────────────────────────────
  // For bowl + CFP games the designNote nudges the AI to incorporate the
  // game's official visual assets (bowl logo, CFP shield, championship
  // trophy). These are well-known marks the AI has training memory for and
  // they're the single biggest "this feels like the real broadcast" lever
  // for special games.
  const buildGameContext = () => {
    const bn = (bowlName || '').trim()
    const conf = (conference || '').trim()
    switch (gameType) {
      case 'conference_championship':
        return {
          line: conf ? `This was the ${conf} Conference Championship Game.` : `This was a conference championship game.`,
          designNote: `Conference championship — weighty, ceremonial stakes.`,
          callout: conf ? `${conf} Championship` : `Conference Championship`,
        }
      case 'bowl':
        return {
          line: bn ? `This was the ${bn}.` : `This was a postseason bowl game.`,
          designNote: `Bowl game — season-finale stakes. ${bn ? `The ${bn}'s` : `The bowl's`} official logo and trophy are recognized assets; if you can recall them, weave them into the design.`,
          callout: bn || `Bowl Game`,
        }
      case 'cfp_first_round':
        return {
          line: `This was a College Football Playoff First Round game${bn ? ` (${bn})` : ''}.`,
          designNote: `College Football Playoff — national-stage stakes. The CFP shield/logo is the recognized national-stage asset; weave it in.`,
          callout: `CFP First Round`,
        }
      case 'cfp_quarterfinal':
        return {
          line: bn ? `This was a College Football Playoff Quarterfinal at the ${bn}.` : `This was a College Football Playoff Quarterfinal.`,
          designNote: `CFP Quarterfinal — national playoff stakes. The CFP shield/logo${bn ? ` and the ${bn}'s branding` : ''} are recognized assets; weave them in.`,
          callout: `CFP Quarterfinal`,
        }
      case 'cfp_semifinal':
        return {
          line: bn ? `This was a College Football Playoff Semifinal at the ${bn}.` : `This was a College Football Playoff Semifinal.`,
          designNote: `CFP Semifinal — one win from the championship. The CFP shield/logo${bn ? ` and the ${bn}'s branding` : ''} are recognized assets; weave them in.`,
          callout: `CFP Semifinal`,
        }
      case 'cfp_championship':
        return {
          line: `This was the College Football Playoff National Championship.`,
          designNote: `The National Championship — the biggest stage in college football. The CFP National Championship trophy and the CFP shield are iconic assets; weave them in.`,
          callout: `National Championship`,
        }
      default:
        return null
    }
  }
  const gameContext = buildGameContext()

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const isFictionalTeam = (profile) => profile?.isFictional === true

  const fictionalLogoDescription = (profile) => {
    if (!profile || !isFictionalTeam(profile)) return null
    return profile.logoDescription || profile.helmet?.logoMark || null
  }

  const buildBrandSummary = (name, profile, fallbackColors, label = 'OPPONENT') => {
    const primary = profile?.primaryHex || fallbackColors?.primary
    const primaryPMS = profile?.primaryPMS
    const secondary = profile?.secondaryHex || fallbackColors?.secondary
    const fictionalLogo = fictionalLogoDescription(profile)
    const lines = [`${label} — ${name}`]
    if (primary) {
      lines.push(`Colors: primary ${primaryPMS ? `${primaryPMS} / ` : ''}${primary}${secondary ? `, secondary ${secondary}` : ''}.`)
    }
    if (fictionalLogo) {
      lines.push(`Logo (fictional — render from this description only, do NOT substitute a real logo): ${fictionalLogo}`)
    }
    return lines.length > 1 ? lines.join('\n') : null
  }

  const logoInstruction = (...teamNames) => {
    const realTeams = teamNames.filter(Boolean).join(' and ')
    return `Logos — ${realTeams || 'real programs'}: recall each team's actual current athletics mark from training and render it faithfully. If you can't recall it confidently, use a clean wordmark in their primary color. Any team with a "Logo (fictional)" line: render from that description only.`
  }

  // Wrapped so the AI doesn't print "NEUTRAL SITE" / "HOME" verbatim on the canvas.
  const siteContext = () => {
    if (homeTeam === null) return `[Internal context — do NOT print on graphic]: neutral site.`
    const homeName    = homeTeam === 1 ? team1Name : team2Name
    const visitorName = homeTeam === 1 ? team2Name : team1Name
    return `[Internal context — do NOT print on graphic]: ${homeName} home, ${visitorName} away.`
  }

  // Only the rules that address real observed AI problems, plus the chosen
  // style's own bullets. `hasRecord` gates the records directive so a game
  // with no records on file never asks the model to draw one.
  const designRules = (mode = 'branded', hasRecord = false) => [
    `DESIGN RULES:`,
    `• Bold, contemporary, confident.`,
    `• If a photo IS attached: score and branding elements float over the full-bleed photo — they do not sit inside a separate panel or zone. Acceptable overlay treatments: a small semi-transparent pill/badge behind scores, drop shadows on type. Unacceptable: an opaque rectangular bar covering the bottom quarter or more of the frame, a full-width color slab, or any panel that clearly replaces the photo rather than overlaying it.`,
    `• If NO photo is attached: the SCORE is the focal point — the matchup and final score read first and biggest. Team logos identify each side, sized to support the score; do NOT enlarge a team's primary mark into a giant hero/centerpiece. Branding lives in the palette, layout, and small marks, not in one oversized logo.`,
    `• No distressed, scratchy, or grungy letterforms. Clean, bold typography only.`,
    mode === 'branded'
      ? `• This is ${featuredName}'s post — their palette drives the design language. The opponent's colors are limited to their logo and their side of the score zone — not background fills, panels, or design shapes elsewhere on the canvas.`
      : `• Both teams represented equally — neither palette dominates.`,
    ...style.designBullets.map(b => `• ${b}`),
    (showRecords && hasRecord) ? RECORD_DIRECTIVES[recordKey] : null,
  ].filter(Boolean).join('\n')

  const textRules = (fictionalNamesList = []) => {
    const lines = [
      `TEXT RULES: In the score zone, use logos to identify teams — do not write team names next to scores. School or program name as a supporting canvas element (not a score label) is fine, but it MUST stay secondary: smaller than the score, never the largest or dominant element, and never a giant "[School] FOOTBALL" hero banner. The score is the biggest thing on the canvas. If a rank (#N) appears in the RESULT block for either team, it must be shown on the graphic. Do not include:`,
      `• "FINAL SCORE" as a large hero headline. "FINAL" may appear as a label.`,
      `• "AWAY", "HOME", "ROAD", or "VISITOR" as visible canvas text.`,
      `• Outcome declarations — "CATS WIN!", "[TEAM] WIN.", "VICTORY!", or equivalent hype banners.`,
      `• Sentence captions — "STATEMENT WIN IN ATHENS" or any explanatory subtitle.`,
      `• Slogans as the dominant element. A program slogan (small, corner or footer) is fine if it's authentic to this school — never invented.`,
      `• Location text — venue, stadium, city, or state names.`,
      `• Any year, season, or date — NO four-digit year (e.g. "2024", "2025", "2035"), no "20XX", no month/day, anywhere on the canvas. This is absolute. If an official event mark you're recalling (conference-championship logo, CFP shield, bowl logo) normally includes a year, recreate the mark WITHOUT that year — drop the date entirely. Never print YYYY in any form.`,
      `• Hex codes, color names, hashtags, handles, or URLs.`,
    ]
    if (fictionalNamesList.length > 0) {
      const names = fictionalNamesList.join(' / ')
      lines.push(`• Win-loss record for ${names} — placeholder team, record not tracked. Render name/score/logo normally; omit the record.`)
    }
    return lines.join('\n')
  }

  // Two separate paths live in ONE prompt; the model picks based on whether
  // the USER attached an image file to their request. Normally we can't know
  // that at build time (the prompt is copied into an external tool), so both
  // branches ship. BUT when the caller reports attached photos
  // (screenshotCount > 0) we DO know — so we drop the ambiguity and hard-commit
  // to the photo path, which fixes the first-generation image being ignored.
  // The photo path's invariant never moves: the uploaded image IS the canvas
  // and everything else floats on top of it. The style slider only sets how
  // much floats there (overlayNote) — it can never turn the photo into a
  // backdrop behind a panel, at any stop.
  const photoPathText = `THE PHOTO IS THE GRAPHIC. There ${screenshotCount === 1 ? 'is an attached image' : 'are attached images'} to THIS request — you MUST use ${screenshotCount === 1 ? 'it' : 'them (pick the strongest single frame)'} as the base of the graphic. Do NOT generate a logo/typography-only graphic and do NOT ignore the attachment. The attached photo fills the entire 1080×1080 canvas, bleeding corner to corner — no gaps, bars, or panels eating into it. Score numbers, logos, ranks, and records overlay the photo directly as floating elements. Do NOT place any solid/near-solid rectangular panel over the photo covering more than ~15% of the canvas (no heavy opaque score bar, no full-width color slab). Keep the photo's own natural colors; the team palette comes through the score, logos, and type, NOT a color wash, gradient, or tint laid over the image. The photo breathes across the whole canvas: a team photographer's best shot with a handful of graphic elements placed tastefully on top. You MAY make subtle enhancements (slight contrast, saturation, or brightness; minor crop or straighten) but keep the original composition intact. Work ONLY with the attached photo — do not invent or composite additional people or scenery.

${style.overlayNote}`

  // The rendering sentence now comes FROM the chosen style. It used to be one
  // fixed line promising "gradients are all welcome", which flatly contradicted
  // a Minimal or Clean selection further down the same prompt.
  const noPhotoPathText = style.renderBody

  const photoDirective = hasAttachedPhoto
    ? [
        `PHOTO RULE — an image file IS attached to this request. ${photoPathText}`,
      ].join('\n')
    : [
        `PHOTO RULE — there are TWO separate paths. Pick ONE based on a single fact: did the user attach an actual image file to THIS request?`,
        ``,
        `• IF NO IMAGE WAS ATTACHED → ${noPhotoPathText} If you're unsure whether an image is attached, you're in THIS path.`,
        ``,
        `• IF THE USER ATTACHED AN IMAGE → ${photoPathText}`,
      ].join('\n')

  // Rankings are a headline detail in real score graphics but were barely
  // surfaced before (a single soft line). When a team is AP Top 25, tell the
  // model to render a prominent rank badge next to that team — and never to
  // fabricate a rank for an unranked team.
  const rankedForGraphic = showRanks ? [
    team1Rank ? { name: team1Name, rank: team1Rank } : null,
    team2Rank ? { name: team2Name, rank: team2Rank } : null,
  ].filter(Boolean) : []
  const rankSpec = RANK_DIRECTIVES[rankKey] || RANK_DIRECTIVES.standard
  const rankDirective = rankedForGraphic.length
    ? [
        rankSpec.header,
        ...rankedForGraphic.map(t => rankSpec.line(t.name, t.rank)),
        `Do NOT invent, guess, or add a rank for any team not listed above.`,
      ].join('\n')
    : null

  // ─── NEUTRAL PATH ─────────────────────────────────────────────────────────
  if (featuredTeam === 0) {
    const rank1Label = (showRanks && team1Rank) ? `#${team1Rank} ` : ''
    const rank2Label = (showRanks && team2Rank) ? `#${team2Rank} ` : ''
    const s1 = team1Score ?? ''
    const s2 = team2Score ?? ''

    const p1 = getTeamBrandProfile(team1Name)
    const p2 = getTeamBrandProfile(team2Name)
    const color1 = p1?.primaryHex || team1Colors?.primary || '#1a1a1a'
    const color2 = p2?.primaryHex || team2Colors?.primary || '#1a1a1a'
    const fictionalLogo1 = fictionalLogoDescription(p1)
    const fictionalLogo2 = fictionalLogoDescription(p2)

    const p1Fictional = isFictionalTeam(p1)
    const p2Fictional = isFictionalTeam(p2)
    const t1RecordEff = (p1Fictional || !showRecords) ? null : team1Record
    const t2RecordEff = (p2Fictional || !showRecords) ? null : team2Record
    const fictionalParticipantNames = [
      p1Fictional ? team1Name : null,
      p2Fictional ? team2Name : null,
    ].filter(Boolean)

    const realTeamNames = [
      !p1Fictional ? team1Name : null,
      !p2Fictional ? team2Name : null,
    ].filter(Boolean)

    const awayName  = homeTeam === 1 ? team2Name : homeTeam === 2 ? team1Name : null
    const awayScore = homeTeam === 1 ? s2        : homeTeam === 2 ? s1        : null
    const homeName  = homeTeam === 1 ? team1Name : homeTeam === 2 ? team2Name : null
    const homeScore = homeTeam === 1 ? s1        : homeTeam === 2 ? s2        : null

    const lines = [
      `Generate a post-game score graphic image (1080×1080) for a neutral sports media outlet — not either team's branded post.`,
      ``,
      `You are a senior designer at a major sports network. Both teams are represented equally in color, logo placement, and type weight.`,
      ``,
      photoDirective,
      ``,
      `RESULT`,
      `${rank1Label}${team1Name}${t1RecordEff ? ` (${t1RecordEff})` : ''}:  ${s1}`,
      `${rank2Label}${team2Name}${t2RecordEff ? ` (${t2RecordEff})` : ''}:  ${s2}`,
      rankDirective ? `` : null,
      rankDirective,
      gameContext ? gameContext.line : null,
      gameContext ? gameContext.designNote : null,
      ``,
      siteContext(),
      ``,
      `TEAM 1 — ${team1Name}`,
      `Colors: primary ${p1?.primaryPMS ? `${p1.primaryPMS} / ` : ''}${color1}${(p1?.secondaryHex || team1Colors?.secondary) ? `, secondary ${p1?.secondaryHex || team1Colors?.secondary}` : ''}.`,
      fictionalLogo1 ? `Logo (fictional — render from this description only): ${fictionalLogo1}` : null,
      ``,
      `TEAM 2 — ${team2Name}`,
      `Colors: primary ${p2?.primaryPMS ? `${p2.primaryPMS} / ` : ''}${color2}${(p2?.secondaryHex || team2Colors?.secondary) ? `, secondary ${p2?.secondaryHex || team2Colors?.secondary}` : ''}.`,
      fictionalLogo2 ? `Logo (fictional — render from this description only): ${fictionalLogo2}` : null,
      ``,
      logoInstruction(...realTeamNames),
      ``,
      `Score pairing — verify before drawing:`,
      `• ${team1Name} = ${s1}. Pair the number ${s1} with the ${team1Name} logo immediately adjacent — a logo elsewhere on the graphic does not count.`,
      `• ${team2Name} = ${s2}. Pair the number ${s2} with the ${team2Name} logo immediately adjacent. Never swap.`,
      `Both scores equally prominent — neither de-emphasized regardless of result.`,
      homeTeam !== null
        ? `Layout: ${awayName} (${awayScore}) on the left or top; ${homeName} (${homeScore}) on the right or bottom.`
        : `Neutral site — layout is your call.`,
      ``,
      designRules('neutral', !!(t1RecordEff || t2RecordEff)),
      ``,
      textRules(fictionalParticipantNames),
    ]

    return lines.filter(l => l !== null && l !== undefined).join('\n')
  }

  // ─── BRANDED PATH ─────────────────────────────────────────────────────────
  const featuredName   = featuredTeam === 2 ? team2Name   : team1Name
  const featuredScore  = featuredTeam === 2 ? team2Score  : team1Score
  const featuredRank   = featuredTeam === 2 ? team2Rank   : team1Rank
  const featuredRecord = featuredTeam === 2 ? team2Record : team1Record
  const featuredColors = featuredTeam === 2 ? team2Colors : team1Colors

  const oppName    = featuredTeam === 2 ? team1Name   : team2Name
  const oppScore   = featuredTeam === 2 ? team1Score  : team2Score
  const oppRank    = featuredTeam === 2 ? team1Rank   : team2Rank
  const oppRecord  = featuredTeam === 2 ? team1Record : team2Record
  const oppColors  = featuredTeam === 2 ? team1Colors : team2Colors

  const sf = featuredScore ?? ''
  const so = oppScore ?? ''

  const rankLabel    = (showRanks && featuredRank) ? `#${featuredRank} ` : ''
  const oppRankLabel = (showRanks && oppRank) ? `#${oppRank} ` : ''

  const profile    = getTeamBrandProfile(featuredName)
  const oppProfile = getTeamBrandProfile(oppName)
  const primary    = profile?.primaryHex   || featuredColors?.primary   || '#1a1a1a'
  const secondary  = profile?.secondaryHex || featuredColors?.secondary || '#ffffff'
  const tertiary   = profile?.tertiaryHex  || null
  const primaryPMS = profile?.primaryPMS   || null
  const featuredFictionalLogo = fictionalLogoDescription(profile)

  const featuredIsFictional = isFictionalTeam(profile)
  const oppIsFictional      = isFictionalTeam(oppProfile)
  const featuredRecordEff = (featuredIsFictional || !showRecords) ? null : featuredRecord
  const oppRecordEff      = (oppIsFictional      || !showRecords) ? null : oppRecord
  const fictionalParticipantNames = [
    featuredIsFictional ? featuredName : null,
    oppIsFictional      ? oppName      : null,
  ].filter(Boolean)

  // Fictional teams: emit motifs/notes (AI has no training memory for them).
  // Real programs: AI already knows — don't re-describe what it has in training.
  const motifLine = (profile?.motifs?.length && featuredIsFictional)
    ? `Design motifs: ${profile.motifs.join(', ')}.`
    : ''

  const brandIdentitySection = featuredIsFictional
    ? `BRAND IDENTITY: The graphic must be immediately recognizable as a ${featuredName} graphic. Use the program's colors and visual language — design as their graphics department would.`
    : [
        `BRAND IDENTITY:`,
        `Picture what ${featuredName} football's official social media graphics actually look like — the posts their athletics department pushes to Instagram and Twitter right after a game. Not the uniforms. Not the stadium. The graphic design itself: how they use color, how they structure a layout, what typographic choices they make, what visual details make their posts instantly recognizable even before you read the school name.`,
        ``,
        `That is what you are designing right now.`,
        ``,
        `The graphic must feel like it came from ${featuredName}'s own graphics team — not just because a logo is present, but because the design language itself speaks that specific school. That includes the lettering: if ${featuredName} uses a distinctive athletic font or number style, use it.`,
        ``,
        `Failure mode to avoid: a generic college-football scorecard with ${featuredName}'s colors swapped in. If a side-by-side fan couldn't tell this graphic from ${featuredName}'s actual account, you missed the brief. Before you draw, name (to yourself) two or three specific design moves this program's graphics team is known for — a typeface or number treatment, a layout shape, a recurring graphic element — and let those guide the composition. Restraint is often part of the brand too: most college accounts use FEWER elements than fans expect, not more. Don't crowd the canvas trying to prove you know the school — pick the strongest move and commit to it.`,
      ].join('\n')

  const opponentBlock = buildBrandSummary(oppName, oppProfile, oppColors, 'OPPONENT')

  const realTeamNames = [
    !featuredIsFictional              ? featuredName : null,
    !isFictionalTeam(oppProfile)      ? oppName      : null,
  ].filter(Boolean)

  const featuredIsHome = (featuredTeam === 1 && homeTeam === 1) || (featuredTeam === 2 && homeTeam === 2)
  const awayName  = featuredIsHome ? oppName      : featuredName
  const awayScore = featuredIsHome ? so           : sf
  const homeName  = featuredIsHome ? featuredName : oppName
  const homeScore = featuredIsHome ? sf           : so

  const lines = [
    `Generate a post-game social media score graphic image (1080×1080) for ${featuredName}'s official account.`,
    ``,
    `You are the creative director for ${featuredName} football's social media. This goes out on Instagram and Twitter within minutes of the final whistle.`,
    ``,
    photoDirective,
    ``,
    gameContext ? gameContext.line : null,
    gameContext ? gameContext.designNote : null,
    ``,
    `RESULT`,
    `${rankLabel}${featuredName}${featuredRecordEff ? ` (${featuredRecordEff})` : ''}:  ${sf}`,
    `${oppRankLabel}${oppName}${oppRecordEff ? ` (${oppRecordEff})` : ''}:  ${so}`,
    rankDirective ? `` : null,
    rankDirective,
    ``,
    `BRAND — ${featuredName}`,
    `Primary: ${primaryPMS ? `${primaryPMS} / ` : ''}${primary}  Secondary: ${secondary}${tertiary ? `  Accent: ${tertiary}` : ''}`,
    profile?.wordmarkStyle ? `Wordmark: ${profile.wordmarkStyle}` : null,
    (featuredIsFictional && profile?.graphicNotes) ? `${profile.graphicNotes}` : null,
    motifLine || null,
    featuredFictionalLogo ? `Logo (fictional — render from this description only): ${featuredFictionalLogo}` : null,
    ``,
    brandIdentitySection,
    ``,
    opponentBlock,
    opponentBlock ? `` : null,
    logoInstruction(...realTeamNames),
    ``,
    `Score accuracy: ${featuredName} = ${sf}, ${oppName} = ${so}. Each score must have its team's primary logo immediately adjacent. Never swap. Both teams' scores in the same visual format — equal type size and layout treatment.`,
    `Secondary logomark or monogram: only use one if you can recall it confidently and accurately — a hallucinated or approximate mark is worse than no mark. When in doubt, use bold lettering of the school name or team name instead.`,
    ``,
    homeTeam !== null
      ? `Layout: ${awayName} (${awayScore}) on the left or top; ${homeName} (${homeScore}) on the right or bottom.`
      : `Neutral site — layout is your call.`,
    ``,
    designRules('branded', !!(featuredRecordEff || oppRecordEff)),
    ``,
    textRules(fictionalParticipantNames),
  ]

  return lines.filter(l => l !== null && l !== undefined).join('\n')
}
