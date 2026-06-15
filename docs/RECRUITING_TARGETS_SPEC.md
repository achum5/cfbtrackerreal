# Recruiting Targets — Implementation Spec

> Status: APPROVED DESIGN, not yet built. This is the build doc; check items off as we go.

## 1. Core principle (read this first)

There is **no "target system" vs "commit system."** There is **one record type on one funnel**, entered at whatever depth the user wants — the same idea as the game scores/all-plays sheet, applied to the whole recruiting workflow.

```
SCOUTED or UNSCOUTED TARGET            (isTarget, teamsByYear empty, attributes optional)
        │  Commitment resolves to a tid (blank = your team)
        ▼
NORMAL RECRUIT at that tid             (teamsByYear[year+1]=tid, isRecruit, freshman next season)
```

- A **commitment is just a fully-resolved target.** A commit-only user enters records already at the "committed" end and never touches targets. A target user starts records at "Pursuing" and walks them to committed.
- **No modes, no opt-in toggle.** Depth is implicit in which columns get filled:
  | User | Fills | Record starts as |
  |---|---|---|
  | Commit-only (today) | player info, **blank Commitment**, no attributes | committed to you |
  | Targets, no scouting | player info + **"(Pursuing)"** | open target |
  | Targets + scouting | player info + "(Pursuing)" + **attributes** | open, gradeable |
- **The linchpin that makes the two paths safe to mix: name/pid match-merge on reconcile.** A commitment arriving as a fresh sheet row *or* as a resolution of an existing target converges to ONE player record. (The reconciler already dedupes by pid/normalized name today.)
- **Source of truth = the dynasty `players` subcollection.** The Google Sheet is a disposable weekly scratchpad, created fresh and pre-filled FROM the dynasty each time (because the user does Save & Delete, which trashes the sheet — confirmed at `RecruitingCommitmentsModal.jsx:308`). The board survives the weekly delete because the players are persisted.

Soundness facts that make this safe:
- Players live in a Firestore **subcollection** (`savePlayersToSubcollection`), not the 1 MB main doc → hundreds of targets/season is fine.
- An **uncommitted target has empty `teamsByYear` and no `statsByYear`** → automatically excluded from rosters (`isPlayerOnRoster` keys off `teamsByYear`), leaderboards/stats (key off `statsByYear`), and All-Time Team (peak team must be a coached tid > 0). Only generic "all players" directories need an explicit guard.
- `team: -1` is a **display sentinel only** (gray card, no logo — `getColorsFromTid`/`getTeamLogoByTid` already fall back gracefully on unknown tid). We do **NOT** add a `dynasty.teams[-1]` entry, so no team-list/dropdown iteration is affected.

---

## 2. Data model — player record extensions

A target is a real `player`. New/used fields:

```js
player = {
  // ...existing recruit fields: name, position, archetype, stars, devTrait,
  // gemBust, nationalRank, stateRank, positionRank, height, weight, hometown,
  // state, previousTeam, isPortal ...

  isTarget: true,          // board-membership marker. Stays true for the life of the record
                           //   so committed-elsewhere targets still show on YOUR board.
  targetYear: 2035,        // the recruiting class year this record belongs to.
  team: -1,                // DISPLAY sentinel only (gray). Not a real team. Never in dynasty.teams.

  commitmentTid: null,     // null = still pursuing. A tid = committed there (yours or elsewhere).
  commitWeekKey: null,     // e.g. 'regular_5' — week the commitment resolved (powers per-week todo).

  teamsByYear: {},         // EMPTY while pursuing. Set to { [targetYear+1]: commitmentTid } on commit
                           //   → enrolls as a freshman at that school next season.
  isRecruit: true,         // set on commit (existing flag).

  attributes: null,        // optional. { [canonicalAttrName]: number } keyed to ARCHETYPE_WEIGHTS /
                           //   POSITION_CONFIG names. Powers the Scout Staff grade. Blank = ungraded.
}
```

**Status is derived, not stored separately:**
- `commitmentTid == null` → **Open** (Pursuing).
- `commitmentTid === userTid` → **Committed to you.**
- `commitmentTid` is any other tid → **Committed elsewhere.**

**Your board** = `players.filter(p => p.isTarget && p.targetYear === year)` — shows the full board with all three statuses.

---

## 3. The unified sheet

Mirrors the scores/all-plays dual-depth pattern (`boxScoreConstants.js`, `BoxScoreSheetModal.jsx`, `readScoringSummaryFromSheet` in `sheetsService.js`).

### 3.1 Column schema

```
┌─ A–O ─────────────────────────────┬─ P ───────────┬─ Q … Z ───────────────────┐
│ Player info (UNCHANGED from today: │ Commitment    │ Attr 1 … Attr 10          │
│ Player, Class, Position, Archetype,│ (full team    │ (canonical order for the  │
│ Stars, Nat/State/Pos Rank, Height, │  dropdown +   │  row's position/archetype,│
│ Weight, Hometown, State, Gem/Bust, │  "(Pursuing)")│  OPTIONAL — blank = no    │
│ Dev Trait, Prev Team)              │               │  grade)                   │
└────────────────────────────────────┴───────────────┴───────────────────────────┘
         SHALLOW = commitments (today)        DEEP = targets + attributes
```

- **Column P (Commitment) dropdown:** `(Pursuing)` at top, then the user's team, then all other teams (reuse the team list the prev-team/portal dropdown already builds). Strict-ish but allow blank.
  - **blank** → committed to **your** team (backward-compatible: today's sheet has no P column, every row = your commit).
  - **`(Pursuing)`** → open target, no commit.
  - **a team** → committed to that tid.
- **Columns Q–Z (Attr 1–10):** non-strict, allow blank. The canonical attribute *names* per position/archetype come from Scout Staff's `POSITION_CONFIG` / `RECRUIT_FORM_OVERRIDES` / `BASE_POSITION_CONFIG`. The sheet stores values positionally; the reader maps position → names.
- **Read range widens** from `Commitments!A2:O100` → `Commitments!A2:Z500` (more rows; a season has far more targets than commits).

### 3.2 Two AI prompt buttons (same modal)

Mirror `BoxScoreSheetModal`'s "Scoring Summary" / "All Plays" buttons (`SheetModalAIHero.jsx`).

- **"Commitments"** (default) → today's A–O prompt, **unchanged**. Instructs AI to output only new committed recruits, paste at the dynamic cell `A{N+2}`. Commit-only users see exactly today's experience.
- **"Targets + Attributes"** → A–Z prompt. Instructs AI: for each prospect in the recruiting-board screenshots, output player info (A–O); set **Commitment (P)** to `(Pursuing)` unless the board shows them committed (then the school); fill **Q–Z** with the 10 scouted attributes **in the canonical order for that position/archetype** *only if visible* (else leave blank — unscouted is fine). Paste at `A{N+2}`.

Both built by `buildAIPrompt()` (`utils/aiPrompt.js`), different `structure` text — same utility, same team-map block.

### 3.3 Lifecycle (per the Save & Delete reality)

1. **Open** → create a **fresh sheet**, pre-filled from the dynasty: every known target for the class (info + current Commitment status + any attributes already captured) and every commit. (`createRecruitingSheet` extended to prefill all known targets, not just commits.)
2. AI prompt names the next empty row; user pastes this week's new prospects there.
3. Resolutions can be done here (set the P dropdown) OR in-app (§5) — both converge.
4. **Save** → `readRecruitingFromSheet` reads `A2:Z` → reconcile (§4).
5. **Delete** → sheet to trash. The board persists in the dynasty.

### 3.4 The reader (graceful auto-detect)

`readRecruitingFromSheet` extended (`sheetsService.js:~11492`):
- Always parse A–O → recruit object (as today).
- **Col P:** blank → `commitmentTid = userTid`; `(Pursuing)` → `commitmentTid = null` (open); a team → `commitmentTid = getTidFromAbbr(value)` (support abbr *and* full names from the dropdown).
- **Cols Q–Z:** if any non-empty, map positionally → `attributes` map via the position/archetype config; else `attributes = null`.
- Returns recruit objects carrying `{ ...info, commitmentTid|'pursuing', attributes }`.

Blank columns are empty strings that survive the prefill round-trip — same robustness as the box-score reader.

---

## 4. Reconciliation (one source of truth, no duplicates)

⚠️ **Do NOT reuse the existing `handleRecruitingSave` auto-merge as-is** — simulation found it merges by GLOBAL unscoped name and auto-converts off-team same-name players into transfers (§13 B1). Targets need a **dedicated, pid-first reconciler**. Extends/forks `handleRecruitingSave` / `processRecruitingCommitmentsSave` in `Recruiting.jsx:279-447` with the §13 mitigations baked in.

For each parsed recruit, **match to an existing player** by `pid` (if carried) else normalized name within `targetYear`:

- **Match found → merge into that record:**
  - Merge `attributes` (sheet wins where present).
  - If `commitmentTid` resolved (not pursuing): set `teamsByYear[targetYear+1] = commitmentTid`, `isRecruit = true`, `commitWeekKey = currentWeekKey`. Keep `isTarget = true` (stays on the board).
  - If still pursuing: ensure `isTarget = true`, `teamsByYear = {}`.
- **No match → create a new player:**
  - **Pursuing** → `isTarget: true`, `team: -1`, `teamsByYear: {}`, `targetYear`, optional `attributes`.
  - **Committed** → the existing new-player creation path (`Recruiting.jsx:376-404`) with `teamsByYear[targetYear+1] = commitmentTid`, plus `isTarget: true`, `commitmentTid`, `commitWeekKey`.

The existing **blank-Commitment = commit-to-you** path is byte-for-byte today's behavior; commit-only users are untouched. A commit entered "the old way" merges into a tracked target by name → no duplicate.

Also keep writing `recruitingCommitments` for committed-to-you records so class score / Recruiting page / dashboard per-week counts keep working (`commitWeekKey` gives the bucket).

---

## 5. In-app resolution (optional sugar, not required)

A lightweight modal/board action — the "list of targets + checkbox + school picker" originally envisioned. Better than the sheet for one-off status changes (no regenerate/scroll/save/delete).

- Lists **open** targets (`isTarget && commitmentTid == null`) for the class.
- Per target: **[Committed to me]** (one tap) | **[Committed elsewhere → school picker]** | leave open.
- On confirm: set `commitmentTid`, `teamsByYear[targetYear+1] = tid`, `isRecruit`, `commitWeekKey`; write to dynasty.

Because resolution writes the same fields the reader does, the two paths are interchangeable.

---

## 6. Targets board view (Recruiting page)

A "Targets" tab/toggle next to Commitments on `Recruiting.jsx`:
- Full board for `targetYear`, grouped by **status** (Open / Committed to you / Committed elsewhere) and position, against class needs.
- Reuses the existing recruit-tile UI; shows the Scout Staff **grade** when `attributes` present.
- Each tile links to the player page (targets are real players).

---

## 7. "New Targets" weekly todo

Add a recurring dashboard todo on every recruiting-active phase (same phases as `getCommitmentKey`, `Dashboard.jsx:2241`: preseason, regular 1–14, conf champ, bowl 1–4, signing 1–5).

- Shared helper `buildNewTargetsTodo()` pushed next to the existing recruiting todo in each phase section (`Dashboard.jsx` phase blocks).
- Todo shape (existing system, `Dashboard.jsx:73-150`): `{ key:'new-targets', done, title:'New Targets', subtitle, onAction: openTargetsSheet/board, actionLabel, inlineAction:{label:'No new targets'} }`.
- **Done-state:** a small per-week touch/dismiss flag (mirror the commitments "No commits" handling), e.g. `dynasty.teams[tid].byYear[year].targetsTouchedByWeek[weekKey]`. Set when the user enters targets or clicks "No new targets."
- Additive — sits beside the existing recruiting todo, never replaces it.

---

## 8. Attribute model + Scout Staff (later phase)

- Attributes stored on the player as `{ [canonicalName]: number }`, names from `archetypeWeights.js` / `POSITION_CONFIG`. 10 ordered sheet columns map by the row's position/archetype.
- **Scout Staff becomes a lens on the board, not a separate DB.** Port the grading engine (`archetypeWeights.js` `computeScore`/`archetypeBaseScore`, tiers from `ThresholdLookup`/`PlayerDatabase`) to read `player.attributes` from the dynasty instead of the standalone `staffDB` IndexedDB. The roster-aware analysis (`ScoutAnalysis.jsx`) then ranks YOUR targets against YOUR depth/graduation needs.
- This is the payoff phase — do it AFTER the board exists and users actually maintain one.

---

## 9. Guards

- **Generic all-players directory/search** (find the raw `players` iteration that lists everyone): filter out **uncommitted** targets → `!(p.isTarget && (!p.teamsByYear || Object.keys(p.teamsByYear).length === 0))`.
- Everything else (rosters, leaderboards, All-Time, depth chart, stats) auto-excludes uncommitted targets via empty `teamsByYear`/`statsByYear` — **no changes needed**, but verify each during build.
- **Do NOT** add `dynasty.teams[-1]`. `team:-1` is display-only; registry helpers already degrade gracefully.

---

## 10. Build phases (ship in order; each is independently useful)

1. ✅ **DONE — Data model + reconciliation + save wiring (Recruiting page)** — `src/utils/recruitingTargets.js` (+ tests): pid-first reconciler, status branching, B1/B2/B3/M1/M3, `partitionRecruitingRows`, guard predicates. Wired into `Recruiting.jsx:handleRecruitingSave` via the partition — **provably a no-op for commit-only users** (no targets + no Commitment column ⇒ all rows take the existing path; `recruitingCommitments` only gets commits-to-us). ⬜ Dashboard's separate `handleRecruitingCommitmentsSave` path still needs the same wiring.
2. **Sheet schema + two prompts + reader** — column P + Q–Z, "Targets + Attributes" prompt, graceful reader, prefill-all-known-targets.
   - ✅ **2a DONE (read side)** — `src/utils/recruitAttributes.js` (canonical attr config + mapper) and `src/utils/recruitSheetParse.js` (pure row parser, legacy A–O parity proven); `readRecruitingFromSheet` widened to `A2:AA600` and routed through the parser (existing commitments flow unchanged).
   - 🟡 **2b IN PROGRESS (write side — needs live-sheet smoke test, Sheets API can't run in sandbox)**
     - ✅ `createRecruitingSheet`: Commitment dropdown (blank/`(Pursuing)`/team) + **one named column per attribute** (the 42 from `ATTRIBUTE_COLUMNS`, verified against Scout Staff.xlsx — no K/P, no hidden physicals) + hidden pid; grid widened to `TOTAL_COLS` × 120 rows; prefill renders commitment/attributes/pid when present (blank for plain commits — additive). Named columns (not generic "Attr N") so each is unambiguous and the reader maps by name with no positional fragility.
     - ⬜ The "Targets + Attributes" AI prompt + second button in `RecruitingCommitmentsModal`.
     - ⬜ Modal passes tracked targets (not just commits) to `createRecruitingSheet` for prefill, so the board survives Save & Delete.
     - ⬜ Mirror the save wiring into the Dashboard's `handleRecruitingCommitmentsSave`.
     - ⬜ (m4 perf) move the large prefill to a separate `values.PUT`; (B5) route saves through `saveChangedPlayers`.
3. **Targets board view** on the Recruiting page (read-only display by status). See the board.
4. **In-app resolution modal** — commit to me / elsewhere. The payoff link targets → commits.
5. **"New Targets" weekly todo** — the recurring nudge.
6. **(Later) Scout Staff grading lens** — port the engine onto `player.attributes`.

Ship 1–5, see whether users maintain a board, *then* invest in 6.

---

## 11. File-by-file change list

| Area | File | Change |
|---|---|---|
| Sheet columns/dropdowns/prefill | `src/services/sheetsService.js` | `createRecruitingSheet`: add col P + Q–Z headers/dropdowns; prefill ALL known targets+commits (not just commits). `readRecruitingFromSheet`: read `A2:Z`, parse Commitment + attributes. Reuse `starsSymbolToNumber`. |
| Targets AI prompt | `src/components/RecruitingCommitmentsModal.jsx` + `src/utils/aiPrompt.js` | Add "Targets + Attributes" prompt button (mirror `SheetModalAIHero` two-button); new `structure` text with P + Q–Z rules and per-position attribute order. |
| Reconciliation + board + tab | `src/pages/dynasty/Recruiting.jsx` | Extend `handleRecruitingSave` for commitment status + attributes + `isTarget` merge; add "Targets" tab/view. |
| Resolution modal | `src/components/TargetResolutionModal.jsx` (new) | List open targets; commit-to-me / elsewhere + school picker; write to dynasty. |
| Weekly todo | `src/pages/dynasty/Dashboard.jsx` | `buildNewTargetsTodo()` + inject in each recruiting phase; per-week touch/dismiss flag. |
| Attribute mapping helper | `src/utils/recruitAttributes.js` (new) or reuse Scout Staff config | position/archetype → ordered 10 attribute names; map sheet columns ↔ `attributes` map. |
| Guard | generic all-players list (TBD — locate during build) | exclude uncommitted targets. |
| (Phase 6) grading | port `archetypeWeights.js`, `ThresholdLookup`, `ScoutAnalysis` to read `player.attributes` | replace `staffDB` IndexedDB source. |

---

## 12. Decisions locked
- Targets are **real players** (subcollection-backed). One source of truth.
- `isTarget` flag + `team:-1` display sentinel; **no** `dynasty.teams[-1]`.
- Commitment column: **blank = you**, `(Pursuing)` = open, team = there. AI auto-fills `(Pursuing)`.
- Commit **elsewhere = a normal commit** → freshman at that school next year (`teamsByYear[year+1]=tid`).
- **Unscouted is fine** → no attributes, no grade, still a tracked target.
- **No mode toggle.** Depth is implicit in filled columns. Name/pid match-merge prevents duplicates across the two entry paths.

---

## 13. Simulation findings — required mitigations (red-team pass)

Traced a target record through roster / leaderboard / recruiting-score / player-page / sheet subsystems against live code. **No crashes**, and the `isPlayerOnRoster`-keys-off-`teamsByYear` discipline holds — open targets never leak onto rosters, depth charts, stat leaderboards, or All-Time Team. The real risks are in reconciliation, sheet plumbing, persistence cost, and a few list/label leaks. All have file:line fixes.

### BLOCKERS — reshape the reconciler (do NOT reuse the legacy recruiting-save merge)
`Recruiting.jsx:handleRecruitingSave` (294–402) is unsafe for targets:
- **B1. Global name auto-merge / hijack.** `existingPlayersByName` is built from ALL players, unscoped by team/year; a same-name player on ANOTHER team is auto-converted into an incoming transfer (team→yours, fabricated `movementByYear`, `isPortal/isRecruit`). A HS target sharing a name with any existing player corrupts that player. → **Dedicated pid-first reconciler:** assign each target a stable `pid` at first save, write it back into a hidden sheet column, re-reads match on pid exactly. Name-match only as a confirmation-gated fallback scoped to `targetYear` + target records; **never** silent cross-team transfer.
- **B2. Open targets force-committed.** New-player creation unconditionally sets `isRecruit/recruitYear/teamsByYear[year+1]=selectedTid` (376–402). → branch on parsed Commitment: open ⇒ `isTarget`, empty `teamsByYear`, NO `isRecruit`; committed ⇒ enroll at resolved tid.
- **B3. "Elsewhere" can't write otherTid.** `teamsByYearValue` hardcoded to `selectedTid` (286); cross-team branch overwrites with your tid + transfer artifacts. → derive destination tid from Commitment; suppress portal/movement writes.

### BLOCKERS — sheet plumbing & persistence (hard prerequisites)
- **B4. Read range & column count hardcoded.** `readRecruitingFromSheet` reads `A2:O100`, maps `row[0..14]`, `columnCount/endColumnIndex=15`, grid `totalRows=max(35,…)` (`sheetsService.js:11497, 11519-11538, 11164/11183`). → widen to `A2:Z500+`, add `row[15..]` parsing, bump column/row counts. Without this every Commitment + attribute is dropped on save and targets >99 are lost.
- **B5. Save rewrites EVERY player doc + orphan scan.** Recruiting save → `savePlayersToSubcollection(..., deleteOrphans:true)` (`Dashboard.jsx:2799` → `dynastyService.js:554`): N writes + full read every weekly save; `saveChangedPlayers` throws >500 changed (`dynastyService.js:793`). → route target saves through `saveChangedPlayers`/`skipPlayersSubcollection` (the box-score pattern), chunk >500.

### MAJOR — keep class score honest + fix the player page
- **M1. Class-score store has no target guard.** `recruitingScore.js:29` counts any commitment with `stars>0`; class score + "X commits" read only from `recruitingCommitments`. → **Open targets must NEVER be written to `recruitingCommitments`.** Only committed-to-you targets write there (as today). Targets live solely as player records + the targets board.
- **M2. Player page mislabels a target as YOUR team.** `Player.jsx:499-502` falls back to `dynasty.teamName` → target shows the user's name+logo; team link → dead `/team/null`; body defaults to an empty Timeline tab. → target-aware view: suppress team fallback/link when `isTarget`; render a purpose-built target layout (board info + grade) instead of the roster-player layout.

### MAJOR — store the committed school as a tid, not text
- **M3.** Resolving the Commitment cell via `getTidFromAbbr` is unsound (teambuilder/custom abbr collisions, FCS placeholder buckets, misroute to original FBS tid; `teamRegistry.js:1247-1293`). → resolve text→`committedTid` **once at entry**, dynasty-aware (`getTidFromTeamName(text, dynasty.teams)` / picker on ambiguity), persist the numeric `committedTid`, never re-resolve from text on render.

### MINOR — list leaks & flags (one-line guards)
- **m1.** Add `!p.isTarget` (uncommitted) guards to generic all-players surfaces iterating `dynasty.players` directly: `Players.jsx:51`, `PlayersByState.jsx:95/117`, and name-matchers in `AllAmericans.jsx:323`, `AllConference.jsx:339/359`, `Awards.jsx:224/238/246`, `NewsTicker/useTickerSections.js`, `Recruiting.jsx:282`. (Roster/stat-scoped surfaces already safe.)
- **m2.** Dedup on stable `pid`, not name (`Recruiting.jsx:705-718`) — else a target + its commit can both survive, or distinct same-name targets collapse.
- **m3.** Year-flip: `handleRecruitingSave` lacks the `isAfterYearFlip` adjust the Dashboard path has (`Dashboard.jsx:2264`) → centralize year derivation; `targetsTouchedByWeek` flag must key by the adjusted year.
- **m4.** Prefill via a separate `values.PUT` (box-score `prefillScoringSummaryData` pattern), not inside the create `batchUpdate`; keep dropdowns as single-range validations; defer team-color conditional rules.
- **m5.** AI prompt: raise the "35" cap, document cols P–Z + per-position attribute order, instruct "emit all N tab-separated fields even when trailing attributes are blank" (else the AI's own delimiter check fails).
- **m6.** Add `isViewOnly` early-return inside the targets Save handlers, not just the button render (`RecruitingCommitmentsModal.jsx:281/299`).

### Build-order impact
Phase 1 must include **B1–B3** (safe pid-first reconciler) and **M1** (no open targets in `recruitingCommitments`). Phase 2 must include **B4** (sheet columns/range) before targets can round-trip; **B5/m4** are Phase-2 perf. **M2** lands with Phase 3 (board / player view).
