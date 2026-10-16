# Dynasty Tracker — Design Language

The north star. Every component, every page, every color decision checks against this doc.

## Personality

**Broadcast scorebug × sports almanac.** Confident live-TV graphics meet reference-book typography. Data is the hero. Team color is flavor, not wallpaper.

We are NOT a generic SaaS dashboard. We are not a landing page. We are a data-dense tool for someone who loves college football enough to track a fictional dynasty season-by-season for years.

## The three rules

1. **Team color is an accent, never a fill.** Never cover more than ~5% of the viewport with pure team color. Use it as: stripes (2–6px), left-border rails, underlines, chip borders, button fills on CTAs. Never as a giant header bar or hero background.
2. **Typography carries the visual weight.** Big tabular numerals for stats. Saira Semi Condensed (700–900) for display, Saira for body. Tracked all-caps only for true column headers and stat captions — not as an eyebrow over every heading. If you're tempted to add a border/shadow/gradient to create hierarchy — try changing font size/weight first.
3. **Density where data lives, generosity where a hero lives.** Tables: tight rows, no zebra, no extra padding. Heroes: editorial spacing, one big number, breathing room.

## Typography scale

| Token | Usage | Spec |
|---|---|---|
| `display-xl` | Team name in hero | Saira Semi Condensed 900, 3.5rem, tracking -0.03em |
| `display-lg` | Page titles | Saira Semi Condensed 800, 2.5rem (1.875rem under 640px), tracking -0.02em |
| `display-md` | Section titles | Saira Semi Condensed 700, 1.75rem, tracking -0.02em |
| `stat-hero` | The single biggest number on a page (OVR, final score) | Saira Semi Condensed 900, 4.5rem, tabular-nums |
| `stat-lg` | Card stat values | Saira Semi Condensed 800, 2.5rem, tabular-nums |
| `stat-md` | Table stat cells | Saira Semi Condensed 600, 1rem, tabular-nums |
| `body` | Paragraph text | Saira 400, 0.875rem, line-height 1.6 |
| `label-sm` | Column headers, meta rows | Saira Semi Condensed 600, 0.75rem, uppercase, tracking 0.05em |
| `label-xs` | Stat tile captions | Saira Semi Condensed 600, 0.625rem, uppercase, tracking 0.1em |

**Rule:** any number that appears next to another number uses `font-variant-numeric: tabular-nums`. No exceptions — the columns must align.

## Color system

### Surface palette (dark, slightly warm)

| Token | Hex | Usage |
|---|---|---|
| `surface-0` | `#101117` | Deep wells |
| `surface-1` | `#191b22` | Page background, header, sidebar |
| `surface-2` | `#242730` | Card backgrounds |
| `surface-3` | `#2f323c` | Elevated / hover / active nav row |
| `surface-4` | `#3b3e49` | Inputs, hairline borders |
| `surface-5` | `#4e515c` | Strong borders, dividers |

Slight blue-black undertone (≈230° hue) so we escape pure neutral zinc — the AI default. Adjustment is ~2–5% saturation, invisible in isolation but present across the whole page.

### Text

| Token | Hex | Usage |
|---|---|---|
| `text-primary` | `#f5f5f7` | Headings, hero numerals |
| `text-secondary` | `#d3d4da` | Body, secondary info |
| `text-tertiary` | `#a4a5af` | Meta, labels |
| `text-muted` | `#90919d` | Quietest real text — still ≥ 4.5:1 on surface-0..2 |

Every text token must clear WCAG AA (4.5:1) on the surfaces it sits on; axe-core's
color-contrast rule is the check. Team-colored text on a team color goes through
`readableTextOn(bg, preferred)` (utils/colorUtils.js), which keeps a school's
secondary color when it contrasts and falls back to black/white when it doesn't.

### Team color

- `--team-primary` — defined per team. Used for: accent stripes, active nav left-border, primary CTA button fill, focus rings, chip borders.
- `--team-primary-faded` — `color-mix(in srgb, var(--team-primary) 15%, var(--surface-2))`. For subtle accent backgrounds (e.g. active table row highlight).
- `--team-primary-muted` — `color-mix(in srgb, var(--team-primary) 40%, var(--surface-2))`. For medium-emphasis accent chips.
- `--team-secondary` — rare direct use. Reserved for two-tone chips (conference badges, "secondary" helmet styling).

**Scoping:** team-color vars are set on a page-wrapper `data-team-theme` element, NOT `:root`. Prevents cross-contamination when two team contexts render (e.g. cross-dynasty player view inside a dynasty page).

### Semantic colors (non-team)

| Token | Hex | Usage |
|---|---|---|
| `success` | `#22c55e` | Win result, positive delta, successful save |
| `danger` | `#ef4444` | Loss result, negative delta, destructive action |
| `warning` | `#f59e0b` | Pending state, validation warning |
| `info` | `#3b82f6` | Neutral informational accent (rare) |

## Hero treatment spec

Replaces the current solid team-color banner. Every dynasty page uses this.

```
┌─┬────────────────────────────────────────────────────┐
│ │ KENTUCKY WILDCATS                    OVR  OFF  DEF │
│ │ 3-6 (2-5)  ·  SEC                     84   84   86 │
│ │                                                    │
└─┴────────────────────────────────────────────────────┘
 ▲
 └─ 6px team-primary vertical stripe (left rail)
```

- Background: `surface-2`
- Left stripe: 6px solid `--team-primary`
- Team name: `display-xl`, `text-primary`
- Meta row: `label-sm` `text-tertiary`
- Stats inline right: each is `<Stat size="lg">`
- Optional: team-logo watermark at 3–5% opacity behind the stats, no more
- Height: content-driven, NOT fixed. No more 240px-tall wasted banners.

## Data table spec

The app lives and dies on its data tables. They must feel typeset, not like a spreadsheet.

- Background: inherit from parent (no bg per table)
- Row height: 36px (compact). 44px for larger stat tables.
- No zebra striping.
- Row hover: `surface-3` background, slight left-border in `--team-primary-faded`.
- Header: `label-sm` text, `text-tertiary`, bottom border `1px solid surface-5`, sticky on scroll.
- Numeric cells: `tabular-nums`, right-aligned, `stat-md` token.
- Text cells: `text-primary`, left-aligned.
- Sortable headers: chevron on the right, subtle color change when active sort.
- Empty: full-width `<EmptyState>` in the body, not a single row.

Anti-patterns:
- ❌ Drop shadows on rows
- ❌ Rounded row corners
- ❌ Fill backgrounds per row
- ❌ Giant padding
- ❌ Icon columns that don't carry data

## Score row spec (scorebug-style)

Used for game results in schedules, history, game pages.

```
W1  [T-logo] TENNESSEE            L 41-17   AWAY
W2  [T-logo] BOWLING GREEN        L 20-17   HOME  OT
```

- Left: week/sequence number, `text-tertiary`, fixed-width
- Team logo (`<TeamLogo size="sm">`)
- Team name + rank, `text-primary`
- Right cluster: result chip (W/L/T), score (`stat-md`, tabular), site (HOME/AWAY/NEUTRAL) as label-xs tertiary, overtime marker as label-xs tertiary
- Row separator: `1px solid surface-4` bottom
- Hover: `surface-3` background
- NEVER put the opponent's team color as a row background — this is what the current app does and it screams "AI look"

## Spacing scale

Stick to the existing CSS vars: `--space-xs` (0.25rem) → `--space-2xl` (3rem). Don't invent new ones inline.

Section vertical rhythm: `--space-xl` (2rem) between major sections on a page. `--space-lg` between cards in a grid. `--space-md` inside a card.

## Elevation

Three tiers, period:

1. **Flat** — `surface-2` background, no border. Default content.
2. **Bordered** — `surface-2` + `1px solid surface-4`. Interactive items, cards that group data.
3. **Elevated** — `surface-3` + `1px solid surface-5` + `shadow-dark-lg`. Modals, dropdowns, floating UI.

That's it. No gradients-as-elevation. No glow-as-elevation (except the existing `.animate-glow` for truly live/active elements — a currently-active game, an incoming notification).

## Team-color-on-team-color rules

Edge case: a dynasty is Kentucky, but we're viewing a player who transferred from Alabama.

Rule:
- **Chrome** (header, sidebar) always uses the **dynasty's** team color.
- **Hero** on a player/team page uses the **viewed** team's color.
- **Content** uses the dynasty color by default; only switches when the content is explicitly about the viewed team (e.g., that player's career stats in the viewed-team context).

When both render on the same page, they're differentiated by position (chrome = top/left, hero = content area). Never nest stripes.

## Teambuilder custom teams

Users can upload teams with arbitrary colors. Some will be ugly (neon pink, low-contrast grays).

Our design tolerates this because:
- Accent stripes are narrow — an ugly color in 6px is fine
- Team color never fills a large area
- Text is always on neutral surfaces, not on team-color backgrounds

If a custom color has near-white primary (Texas #BF5700 ish is fine; pure white is not), fall back to the team's secondary for stripes. Implement this check in the primitive.

## Don'ts gallery

The "AI vibe" smoking guns. If you see these in a PR, it's wrong:

- ❌ Solid team-color banner ≥100px tall
- ❌ Three stat cards in a row with equal weight, equal rounded corners, equal padding (the v0 default)
- ❌ Gradient from team-primary to a slightly darker team-primary
- ❌ Generic "No games found" centered-text empty state (use `<EmptyState>`)
- ❌ `alert('Saved!')` (use `<Toast>`)
- ❌ Ad-hoc `<div className="fixed inset-0 bg-black/50">` for modal backdrops (use `<Modal>`)
- ❌ Tables with drop shadows on every row
- ❌ Non-tabular numerals anywhere a column exists
- ❌ `rounded-2xl` everything — use rounded-md as the default, rounded-xl only for major containers
- ❌ Inline `style={{ backgroundColor: teamColors.primary }}` as a fill — use the token/primitive
- ❌ Purple-to-blue gradients. Anywhere. Ever.

## Page headers

League-wide pages use `<PageHero>`: the title sits directly on the page background
with a hairline rule under it, or an underline tab strip when the page has tabs.
No boxed card, no sheen gradient. Team and player pages keep their team-colored
mastheads — the contrast between the two is how a user tells "about my team" from
"about the league" at a glance.

- An eyebrow is only for real context the title lacks (a team name over "Team
  History", the poll week over "Top 25"). Never one that repeats the title
  ("Roster" over "2036 Roster") or a category ("Admin" over "Danger Zone").
- Header actions (Edit, Edit Rankings, …) are `<Button variant="outline" size="sm">`.

## Generated-UI tells we avoid

Checked against Anthropic's frontend-design guidance and Vercel's Web Interface
Guidelines:

- No "→" appended to link or button text. A link's styling says it's a link.
- No fade/slide-up entrance on every card (`.reveal` / `.stagger-reveal` are
  inert on purpose). One short route fade is the only automatic motion.
- No tracked-caps eyebrow above every heading; no "WORD — fragment" labels.
- Cards meant to be flush use `<Card padding="none">`, which really is flush now
  (it used to fall back to `p-4`).
- Tables that repeat per season/section use fixed column widths so columns line
  up from one table to the next.

## Icons

The project rule in CLAUDE.md: no decorative icons. Reaffirmed here. An icon earns its place only when it is load-bearing information (team logo, conference logo) — never decoration.

## Animation

Use existing utility classes:
- `.page-enter` — the single short route fade (opacity only)
- `.shimmer` for loading skeletons
- `.animate-pulse-subtle` for current-week / active indicators
- `.animate-glow` for live events (only if truly live)

No hover scale-up, no hover shadow growth, no rotating icons. Restraint.

---

**Maintenance rule:** when this doc and the code disagree, update one to match the other in the same PR. Drift is how design systems die.
