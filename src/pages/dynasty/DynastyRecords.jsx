import { useState, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useDynasty } from '../../context/DynastyContext'
import { usePathPrefix } from '../../hooks/usePathPrefix'
import { useTeamColors } from '../../hooks/useTeamColors'
import { getTeamLogo } from '../../data/teams'
import { teamAbbreviations, getAbbreviationFromDisplayName, getTeamName } from '../../data/teamAbbreviations'

// Stat category definitions with all 51 stats
const STAT_CATEGORIES = {
  passing: {
    name: 'Passing',
    minNote: 'Rate stats require minimum 150 pass attempts (career) / 50 attempts (season)',
    stats: [
      { key: 'completions', label: 'Completions', abbr: 'CMP', field: 'Completions' },
      { key: 'attempts', label: 'Pass Attempts', abbr: 'ATT', field: 'Attempts' },
      { key: 'compPct', label: 'Completion %', abbr: 'CMP%', calculated: true, minAtt: { career: 150, season: 50 }, format: 'pct' },
      { key: 'yards', label: 'Passing Yards', abbr: 'YDS', field: 'Yards' },
      { key: 'ypa', label: 'Yards/Attempt', abbr: 'Y/A', calculated: true, minAtt: { career: 150, season: 50 }, format: 'avg' },
      { key: 'aypa', label: 'Adj. Yards/Attempt', abbr: 'AY/A', calculated: true, minAtt: { career: 150, season: 50 }, format: 'avg' },
      { key: 'tds', label: 'Passing TDs', abbr: 'TD', field: 'Touchdowns' },
      { key: 'ints', label: 'Interceptions', abbr: 'INT', field: 'Interceptions', lowerIsBetter: true },
      { key: 'rating', label: 'Passer Rating', abbr: 'RTG', calculated: true, minAtt: { career: 150, season: 50 }, format: 'rating' },
      { key: 'ypg', label: 'Yards/Game', abbr: 'Y/G', calculated: true, minAtt: { career: 150, season: 50 }, format: 'avg' },
      { key: 'tdPct', label: 'TD %', abbr: 'TD%', calculated: true, minAtt: { career: 150, season: 50 }, format: 'pct' },
      { key: 'intPct', label: 'INT %', abbr: 'INT%', calculated: true, minAtt: { career: 150, season: 50 }, format: 'pct', lowerIsBetter: true }
    ]
  },
  rushing: {
    name: 'Rushing',
    minNote: 'Rate stats require minimum 100 rush attempts (career) / 25 attempts (season)',
    stats: [
      { key: 'attempts', label: 'Rush Attempts', abbr: 'ATT', field: 'Carries' },
      { key: 'yards', label: 'Rush Yards', abbr: 'YDS', field: 'Yards' },
      { key: 'ypc', label: 'Yards/Carry', abbr: 'Y/C', calculated: true, minAtt: { career: 100, season: 25 }, format: 'avg' },
      { key: 'tds', label: 'Rush TDs', abbr: 'TD', field: 'Touchdowns' }
    ]
  },
  receiving: {
    name: 'Receiving',
    minNote: 'Rate stats require minimum 50 receptions (career) / 10 receptions (season)',
    stats: [
      { key: 'receptions', label: 'Receptions', abbr: 'REC', field: 'Receptions' },
      { key: 'yards', label: 'Receiving Yards', abbr: 'YDS', field: 'Yards' },
      { key: 'ypr', label: 'Yards/Reception', abbr: 'Y/R', calculated: true, minAtt: { career: 50, season: 10 }, format: 'avg' },
      { key: 'tds', label: 'Receiving TDs', abbr: 'TD', field: 'Touchdowns' }
    ]
  },
  scrimmage: {
    name: 'Scrimmage',
    minNote: 'Combined rushing and receiving stats',
    stats: [
      { key: 'plays', label: 'Scrimmage Plays', abbr: 'PLY', calculated: true },
      { key: 'yards', label: 'Scrimmage Yards', abbr: 'YDS', calculated: true },
      { key: 'tds', label: 'Scrimmage TDs', abbr: 'TD', calculated: true }
    ]
  },
  allPurpose: {
    name: 'All-Purpose',
    minNote: 'Rate stats require minimum 1,500 yards (career) / 300 yards (season)',
    stats: [
      { key: 'plays', label: 'All-Purpose Plays', abbr: 'PLY', calculated: true },
      { key: 'yards', label: 'All-Purpose Yards', abbr: 'YDS', calculated: true },
      { key: 'ypp', label: 'Yards/Play', abbr: 'Y/P', calculated: true, minYds: { career: 1500, season: 300 }, format: 'avg' },
      { key: 'tds', label: 'All-Purpose TDs', abbr: 'TD', calculated: true }
    ]
  },
  defensive: {
    name: 'Defense',
    stats: [
      { key: 'soloTackles', label: 'Solo Tackles', abbr: 'SOLO', field: 'Solo Tackles' },
      { key: 'astTackles', label: 'Assisted Tackles', abbr: 'AST', field: 'Assisted Tackles' },
      { key: 'totalTackles', label: 'Total Tackles', abbr: 'TOT', calculated: true },
      { key: 'tfl', label: 'Tackles for Loss', abbr: 'TFL', field: 'Tackles for Loss' },
      { key: 'sacks', label: 'Sacks', abbr: 'SCK', field: 'Sacks' },
      { key: 'ints', label: 'Interceptions', abbr: 'INT', field: 'Interceptions' },
      { key: 'intYards', label: 'INT Return Yards', abbr: 'YDS', field: 'INT Return Yards' },
      { key: 'defTds', label: 'Defensive TDs', abbr: 'TD', field: 'Defensive TDs' },
      { key: 'pdef', label: 'Passes Defensed', abbr: 'PD', field: 'Deflections' },
      { key: 'ff', label: 'Forced Fumbles', abbr: 'FF', field: 'Forced Fumbles' },
      { key: 'blocks', label: 'Blocks', abbr: 'BLK', field: 'Blocks' },
      { key: 'safeties', label: 'Safeties', abbr: 'SAF', field: 'Safeties' }
    ]
  },
  kicking: {
    name: 'Kicking',
    minNote: 'FG% requires minimum 25 attempts (career) / 5 attempts (season)',
    stats: [
      { key: 'xpa', label: 'XP Attempted', abbr: 'XPA', field: 'XP Attempted' },
      { key: 'xpm', label: 'XP Made', abbr: 'XPM', field: 'XP Made' },
      { key: 'fga', label: 'FG Attempted', abbr: 'FGA', field: 'FG Attempted' },
      { key: 'fgm', label: 'FG Made', abbr: 'FGM', field: 'FG Made' },
      { key: 'fgPct', label: 'FG %', abbr: 'FG%', calculated: true, minAtt: { career: 25, season: 5 }, format: 'pct' }
    ]
  },
  punting: {
    name: 'Punting',
    minNote: 'Rate stats require minimum 50 punts (career) / 10 punts (season)',
    stats: [
      { key: 'punts', label: 'Punts', abbr: 'P', field: 'Punts' },
      { key: 'yards', label: 'Punt Yards', abbr: 'YDS', field: 'Punting Yards' },
      { key: 'ypp', label: 'Yards/Punt', abbr: 'Y/P', calculated: true, minAtt: { career: 50, season: 10 }, format: 'avg' }
    ]
  },
  kickReturn: {
    name: 'Kick Returns',
    minNote: 'Rate stats require minimum 20 returns (career) / 5 returns (season)',
    stats: [
      { key: 'returns', label: 'Kick Returns', abbr: 'RET', field: 'Kickoff Returns' },
      { key: 'yards', label: 'KR Yards', abbr: 'YDS', field: 'KR Yardage' },
      { key: 'avg', label: 'Yards/Return', abbr: 'AVG', calculated: true, minAtt: { career: 20, season: 5 }, format: 'avg' },
      { key: 'tds', label: 'KR TDs', abbr: 'TD', field: 'KR Touchdowns' }
    ]
  },
  puntReturn: {
    name: 'Punt Returns',
    minNote: 'Rate stats require minimum 20 returns (career) / 5 returns (season)',
    stats: [
      { key: 'returns', label: 'Punt Returns', abbr: 'RET', field: 'Punt Returns' },
      { key: 'yards', label: 'PR Yards', abbr: 'YDS', field: 'PR Yardage' },
      { key: 'avg', label: 'Yards/Return', abbr: 'AVG', calculated: true, minAtt: { career: 20, season: 5 }, format: 'avg' },
      { key: 'tds', label: 'PR TDs', abbr: 'TD', field: 'PR Touchdowns' }
    ]
  }
}

// Category order for tabs
const CATEGORY_ORDER = ['passing', 'rushing', 'receiving', 'scrimmage', 'allPurpose', 'defensive', 'kicking', 'punting', 'kickReturn', 'puntReturn']

export default function DynastyRecords() {
  const { id: dynastyId } = useParams()
  const { currentDynasty } = useDynasty()
  const pathPrefix = usePathPrefix()
  const teamColors = useTeamColors(currentDynasty?.teamName)

  const [mode, setMode] = useState(() => {
    return localStorage.getItem('leaderboard-mode') || 'career'
  })
  const [activeCategory, setActiveCategory] = useState(() => {
    return localStorage.getItem('leaderboard-category') || 'passing'
  })

  // Get user's roster players (not honor-only)
  const getRosterPlayers = () => {
    if (!currentDynasty?.players) return []
    return currentDynasty.players.filter(p => !p.isHonorOnly)
  }

  // Get player info by PID
  const getPlayerInfo = (pid) => {
    const player = currentDynasty?.players?.find(p => p.pid === pid)
    const playerTeamRaw = player?.team || currentDynasty?.teamName
    const teamAbbr = getAbbreviationFromDisplayName(playerTeamRaw) || playerTeamRaw
    const teamFullName = getTeamName(teamAbbr) || playerTeamRaw
    const teamLogo = getTeamLogo(teamFullName)
    return {
      name: player?.name || `Player ${pid}`,
      position: player?.position || '',
      team: teamFullName,
      teamAbbr,
      teamLogo
    }
  }

  // Mapping from sheet/legacy field names to internal short keys
  const FIELD_TO_INTERNAL = {
    'Completions': 'comp', 'Attempts': 'attempts', 'Yards': 'yards', 'Touchdowns': 'td',
    'Interceptions': 'int', 'Carries': 'carries', 'Receptions': 'rec',
    'Solo Tackles': 'solo', 'Assisted Tackles': 'ast', 'Tackles for Loss': 'tfl',
    'Sacks': 'sacks', 'Deflections': 'pdef', 'Forced Fumbles': 'ff', 'INT Return Yards': 'intYds',
    'Defensive TDs': 'defTd', 'Blocks': 'blocks', 'Safeties': 'safeties',
    'XP Attempted': 'xpa', 'XP Made': 'xpm', 'FG Attempted': 'fga', 'FG Made': 'fgm',
    'Punts': 'punts', 'Punting Yards': 'puntYds',
    'Kickoff Returns': 'krRet', 'KR Yardage': 'krYds', 'KR Touchdowns': 'krTd',
    'Punt Returns': 'prRet', 'PR Yardage': 'prYds', 'PR Touchdowns': 'prTd'
  }

  // Calculate leaderboards
  const leaderboards = useMemo(() => {
    const rosterPlayers = getRosterPlayers()
    if (rosterPlayers.length === 0) return {}

    const playerStatsByYearLegacy = currentDynasty?.playerStatsByYear || {}
    const detailedStatsByYearLegacy = currentDynasty?.detailedStatsByYear || {}

    const allYears = new Set()
    rosterPlayers.forEach(player => {
      Object.keys(player.statsByYear || {}).forEach(y => allYears.add(y))
    })
    Object.keys(playerStatsByYearLegacy).forEach(y => allYears.add(y))
    Object.keys(detailedStatsByYearLegacy).forEach(y => allYears.add(y))

    const allPlayerStats = []

    rosterPlayers.forEach(player => {
      const playerOwnStats = player.statsByYear || {}

      allYears.forEach(yearStr => {
        const year = parseInt(yearStr)
        const ownYearStats = playerOwnStats[yearStr] || playerOwnStats[year]
        const legacyBasic = playerStatsByYearLegacy[yearStr]?.find(p =>
          p.pid === player.pid || p.name?.toLowerCase().trim() === player.name?.toLowerCase().trim()
        )
        const legacyDetailed = detailedStatsByYearLegacy[yearStr] || {}

        const getCategoryStats = (internalName, legacyName) => {
          if (ownYearStats?.[internalName]) {
            return ownYearStats[internalName]
          }
          const legacyPlayers = legacyDetailed[legacyName] || []
          return legacyPlayers.find(p =>
            p.name?.toLowerCase().trim() === player.name?.toLowerCase().trim()
          )
        }

        const passing = getCategoryStats('passing', 'Passing')
        const rushing = getCategoryStats('rushing', 'Rushing')
        const receiving = getCategoryStats('receiving', 'Receiving')
        const defense = getCategoryStats('defense', 'Defensive')
        const kicking = getCategoryStats('kicking', 'Kicking')
        const punting = getCategoryStats('punting', 'Punting')
        const kickReturn = getCategoryStats('kickReturn', 'Kick Return')
        const puntReturn = getCategoryStats('puntReturn', 'Punt Return')

        const hasAnyStats = passing || rushing || receiving || defense ||
          kicking || punting || kickReturn || puntReturn || ownYearStats?.gamesPlayed || legacyBasic

        if (!hasAnyStats) return

        const normalizeStats = (stats) => {
          if (!stats) return null
          const normalized = {}
          Object.entries(stats).forEach(([key, value]) => {
            if (key === 'name' || key === 'pid') return
            const internalKey = FIELD_TO_INTERNAL[key] || key
            if (typeof value === 'number' || !isNaN(parseFloat(value))) {
              normalized[internalKey] = parseFloat(value) || 0
            }
          })
          return Object.keys(normalized).length > 0 ? normalized : null
        }

        allPlayerStats.push({
          pid: player.pid,
          name: player.name,
          year,
          gamesPlayed: ownYearStats?.gamesPlayed || legacyBasic?.gamesPlayed || 0,
          passing: normalizeStats(passing),
          rushing: normalizeStats(rushing),
          receiving: normalizeStats(receiving),
          defensive: normalizeStats(defense),
          kicking: normalizeStats(kicking),
          punting: normalizeStats(punting),
          kickReturn: normalizeStats(kickReturn),
          puntReturn: normalizeStats(puntReturn)
        })
      })
    })

    if (allPlayerStats.length === 0) return {}

    const aggregateStats = (category) => {
      const playerTotals = {}

      const fieldMaps = {
        passing: { comp: 'Completions', attempts: 'Attempts', yards: 'Yards', td: 'Touchdowns', int: 'Interceptions' },
        rushing: { carries: 'Carries', yards: 'Yards', td: 'Touchdowns' },
        receiving: { rec: 'Receptions', yards: 'Yards', td: 'Touchdowns' },
        defensive: { solo: 'Solo Tackles', ast: 'Assisted Tackles', tfl: 'Tackles for Loss', sacks: 'Sacks', int: 'Interceptions', intYds: 'INT Return Yards', defTd: 'Defensive TDs', pdef: 'Deflections', ff: 'Forced Fumbles', blocks: 'Blocks', safeties: 'Safeties' },
        kicking: { xpa: 'XP Attempted', xpm: 'XP Made', fga: 'FG Attempted', fgm: 'FG Made' },
        punting: { punts: 'Punts', puntYds: 'Punting Yards' },
        kickReturn: { krRet: 'Kickoff Returns', krYds: 'KR Yardage', krTd: 'KR Touchdowns' },
        puntReturn: { prRet: 'Punt Returns', prYds: 'PR Yardage', prTd: 'PR Touchdowns' }
      }

      allPlayerStats.forEach(ps => {
        const catStats = ps[category]
        if (!catStats) return

        const key = mode === 'career' ? ps.pid : `${ps.pid}-${ps.year}`

        if (!playerTotals[key]) {
          playerTotals[key] = {
            pid: ps.pid,
            year: ps.year,
            years: [],
            gamesPlayed: 0
          }
        }

        if (!playerTotals[key].years.includes(ps.year)) {
          playerTotals[key].years.push(ps.year)
        }

        if (ps.gamesPlayed) {
          playerTotals[key].gamesPlayed += ps.gamesPlayed
        }

        const fieldMap = fieldMaps[category] || {}
        Object.entries(catStats).forEach(([shortKey, value]) => {
          const longKey = fieldMap[shortKey] || shortKey
          if (typeof value === 'number') {
            if (mode === 'career') {
              playerTotals[key][longKey] = (playerTotals[key][longKey] || 0) + value
            } else {
              playerTotals[key][longKey] = value
            }
          }
        })
      })

      return Object.values(playerTotals)
    }

    const calcScrimmageStats = () => {
      const playerTotals = {}

      allPlayerStats.forEach(ps => {
        const key = mode === 'career' ? ps.pid : `${ps.pid}-${ps.year}`

        if (!playerTotals[key]) {
          playerTotals[key] = { pid: ps.pid, year: ps.year, years: [], plays: 0, yards: 0, tds: 0 }
        }

        if (!playerTotals[key].years.includes(ps.year)) {
          playerTotals[key].years.push(ps.year)
        }

        if (ps.rushing) {
          playerTotals[key].plays += ps.rushing.carries || 0
          playerTotals[key].yards += ps.rushing.yards || 0
          playerTotals[key].tds += ps.rushing.td || 0
        }
        if (ps.receiving) {
          playerTotals[key].plays += ps.receiving.rec || 0
          playerTotals[key].yards += ps.receiving.yards || 0
          playerTotals[key].tds += ps.receiving.td || 0
        }
      })

      return Object.values(playerTotals).filter(p => p.plays > 0 || p.yards > 0)
    }

    const calcAllPurposeStats = () => {
      const playerTotals = {}

      allPlayerStats.forEach(ps => {
        const key = mode === 'career' ? ps.pid : `${ps.pid}-${ps.year}`

        if (!playerTotals[key]) {
          playerTotals[key] = { pid: ps.pid, year: ps.year, years: [], plays: 0, yards: 0, tds: 0 }
        }

        if (!playerTotals[key].years.includes(ps.year)) {
          playerTotals[key].years.push(ps.year)
        }

        if (ps.rushing) {
          playerTotals[key].plays += ps.rushing.carries || 0
          playerTotals[key].yards += ps.rushing.yards || 0
          playerTotals[key].tds += ps.rushing.td || 0
        }
        if (ps.receiving) {
          playerTotals[key].plays += ps.receiving.rec || 0
          playerTotals[key].yards += ps.receiving.yards || 0
          playerTotals[key].tds += ps.receiving.td || 0
        }
        if (ps.kickReturn) {
          playerTotals[key].plays += ps.kickReturn.krRet || 0
          playerTotals[key].yards += ps.kickReturn.krYds || 0
          playerTotals[key].tds += ps.kickReturn.krTd || 0
        }
        if (ps.puntReturn) {
          playerTotals[key].plays += ps.puntReturn.prRet || 0
          playerTotals[key].yards += ps.puntReturn.prYds || 0
          playerTotals[key].tds += ps.puntReturn.prTd || 0
        }
      })

      return Object.values(playerTotals).filter(p => p.plays > 0 || p.yards > 0)
    }

    const result = {}

    Object.entries(STAT_CATEGORIES).forEach(([catKey, category]) => {
      let baseStats

      if (catKey === 'scrimmage') {
        baseStats = calcScrimmageStats()
      } else if (catKey === 'allPurpose') {
        baseStats = calcAllPurposeStats()
      } else {
        baseStats = aggregateStats(catKey)
      }

      result[catKey] = {}

      category.stats.forEach(stat => {
        let leaderboard = baseStats.map(p => {
          let value

          if (stat.calculated) {
            switch (catKey) {
              case 'passing':
                const att = p['Attempts'] || 0
                const cmp = p['Completions'] || 0
                const yds = p['Yards'] || 0
                const tds = p['Touchdowns'] || 0
                const ints = p['Interceptions'] || 0

                if (stat.key === 'compPct') value = att > 0 ? (cmp / att * 100) : 0
                else if (stat.key === 'ypa') value = att > 0 ? (yds / att) : 0
                else if (stat.key === 'aypa') value = att > 0 ? ((yds + 20 * tds - 45 * ints) / att) : 0
                else if (stat.key === 'rating') {
                  if (att > 0) {
                    const a = Math.max(0, Math.min(((cmp / att) - 0.3) * 20, 2.375))
                    const b = Math.max(0, Math.min(((yds / att) - 3) * 0.25, 2.375))
                    const c = Math.max(0, Math.min((tds / att) * 20, 2.375))
                    const d = Math.max(0, 2.375 - ((ints / att) * 25))
                    value = ((a + b + c + d) / 6) * 100
                  } else value = 0
                }
                else if (stat.key === 'ypg') value = p.gamesPlayed > 0 ? (yds / p.gamesPlayed) : 0
                else if (stat.key === 'tdPct') value = att > 0 ? (tds / att * 100) : 0
                else if (stat.key === 'intPct') value = att > 0 ? (ints / att * 100) : 0

                if (stat.minAtt) {
                  const minReq = mode === 'career' ? stat.minAtt.career : stat.minAtt.season
                  if (att < minReq) value = null
                }
                break

              case 'rushing':
                const rushAtt = p['Carries'] || 0
                const rushYds = p['Yards'] || 0
                if (stat.key === 'ypc') {
                  value = rushAtt > 0 ? (rushYds / rushAtt) : 0
                  if (stat.minAtt) {
                    const minReq = mode === 'career' ? stat.minAtt.career : stat.minAtt.season
                    if (rushAtt < minReq) value = null
                  }
                }
                break

              case 'receiving':
                const rec = p['Receptions'] || 0
                const recYds = p['Yards'] || 0
                if (stat.key === 'ypr') {
                  value = rec > 0 ? (recYds / rec) : 0
                  if (stat.minAtt) {
                    const minReq = mode === 'career' ? stat.minAtt.career : stat.minAtt.season
                    if (rec < minReq) value = null
                  }
                }
                break

              case 'scrimmage':
                if (stat.key === 'plays') value = p.plays
                else if (stat.key === 'yards') value = p.yards
                else if (stat.key === 'tds') value = p.tds
                break

              case 'allPurpose':
                if (stat.key === 'plays') value = p.plays
                else if (stat.key === 'yards') value = p.yards
                else if (stat.key === 'tds') value = p.tds
                else if (stat.key === 'ypp') {
                  value = p.plays > 0 ? (p.yards / p.plays) : 0
                  if (stat.minYds) {
                    const minReq = mode === 'career' ? stat.minYds.career : stat.minYds.season
                    if (p.yards < minReq) value = null
                  }
                }
                break

              case 'defensive':
                if (stat.key === 'totalTackles') {
                  value = (p['Solo Tackles'] || 0) + (p['Assisted Tackles'] || 0)
                }
                break

              case 'kicking':
                const fga = p['FG Attempted'] || 0
                const fgm = p['FG Made'] || 0
                if (stat.key === 'fgPct') {
                  value = fga > 0 ? (fgm / fga * 100) : 0
                  if (stat.minAtt) {
                    const minReq = mode === 'career' ? stat.minAtt.career : stat.minAtt.season
                    if (fga < minReq) value = null
                  }
                }
                break

              case 'punting':
                const punts = p['Punts'] || 0
                const puntYds = p['Punting Yards'] || 0
                if (stat.key === 'ypp') {
                  value = punts > 0 ? (puntYds / punts) : 0
                  if (stat.minAtt) {
                    const minReq = mode === 'career' ? stat.minAtt.career : stat.minAtt.season
                    if (punts < minReq) value = null
                  }
                }
                break

              case 'kickReturn':
                const krRet = p['Kickoff Returns'] || 0
                const krYds = p['KR Yardage'] || 0
                if (stat.key === 'avg') {
                  value = krRet > 0 ? (krYds / krRet) : 0
                  if (stat.minAtt) {
                    const minReq = mode === 'career' ? stat.minAtt.career : stat.minAtt.season
                    if (krRet < minReq) value = null
                  }
                }
                break

              case 'puntReturn':
                const prRet = p['Punt Returns'] || 0
                const prYds = p['PR Yardage'] || 0
                if (stat.key === 'avg') {
                  value = prRet > 0 ? (prYds / prRet) : 0
                  if (stat.minAtt) {
                    const minReq = mode === 'career' ? stat.minAtt.career : stat.minAtt.season
                    if (prRet < minReq) value = null
                  }
                }
                break
            }
          } else {
            value = p[stat.field] || 0
          }

          const playerInfo = getPlayerInfo(p.pid)
          return {
            pid: p.pid,
            name: playerInfo.name,
            position: playerInfo.position,
            team: playerInfo.team,
            teamAbbr: playerInfo.teamAbbr,
            teamLogo: playerInfo.teamLogo,
            value,
            year: p.year,
            years: p.years?.sort((a, b) => a - b) || []
          }
        })

        const isRateStat = stat.format === 'pct' || stat.format === 'avg' || stat.format === 'rating'
        leaderboard = leaderboard
          .filter(p => {
            if (p.value === null || p.value === undefined) return false
            if (!isRateStat && p.value === 0) return false
            return true
          })
          .sort((a, b) => {
            if (stat.lowerIsBetter === true) {
              return a.value - b.value
            }
            return b.value - a.value
          })
          .slice(0, 10)

        result[catKey][stat.key] = leaderboard
      })
    })

    return result
  }, [currentDynasty, mode])

  const handleCategoryChange = (catKey) => {
    setActiveCategory(catKey)
    localStorage.setItem('leaderboard-category', catKey)
  }

  const formatValue = (value, format) => {
    if (value === null || value === undefined) return '-'
    switch (format) {
      case 'pct': return value.toFixed(1) + '%'
      case 'avg': return value.toFixed(1)
      case 'rating': return value.toFixed(1)
      default: return value.toLocaleString()
    }
  }

  const formatYears = (years) => {
    if (!years || years.length === 0) return '-'
    if (years.length === 1) return years[0].toString()
    return `${years[0]}-${years[years.length - 1]}`
  }

  if (!currentDynasty) return null

  const category = STAT_CATEGORIES[activeCategory]
  const catLeaderboards = leaderboards[activeCategory] || {}
  const hasData = Object.values(catLeaderboards).some(lb => lb && lb.length > 0)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div
        className="rounded-xl p-4 sm:p-6"
        style={{ backgroundColor: teamColors.primary }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">
              Dynasty Leaderboards
            </h1>
            <p className="text-white/70 text-sm mt-1">
              All-time records and season bests
            </p>
          </div>

          {/* Mode Toggle */}
          <div className="flex rounded-lg overflow-hidden bg-black/20 p-1">
            <button
              onClick={() => { setMode('career'); localStorage.setItem('leaderboard-mode', 'career') }}
              className={`px-4 py-2 font-semibold text-sm rounded-md transition-all ${
                mode === 'career'
                  ? 'bg-white text-gray-900 shadow-md'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              Career
            </button>
            <button
              onClick={() => { setMode('season'); localStorage.setItem('leaderboard-mode', 'season') }}
              className={`px-4 py-2 font-semibold text-sm rounded-md transition-all ${
                mode === 'season'
                  ? 'bg-white text-gray-900 shadow-md'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              Season
            </button>
          </div>
        </div>
      </div>

      {/* Category Tabs - Scrollable on mobile */}
      <div className="overflow-x-auto -mx-4 px-4 pb-2">
        <div className="flex gap-2 min-w-max">
          {CATEGORY_ORDER.map(catKey => {
            const cat = STAT_CATEGORIES[catKey]
            const isActive = activeCategory === catKey
            return (
              <button
                key={catKey}
                onClick={() => handleCategoryChange(catKey)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
                  isActive
                    ? 'text-white shadow-lg'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                }`}
                style={isActive ? { backgroundColor: teamColors.primary } : {}}
              >
                {cat.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* Active Category Content */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        {/* Category Header */}
        <div
          className="px-4 py-3 border-b border-gray-700 flex items-center justify-between"
          style={{ backgroundColor: `${teamColors.primary}15` }}
        >
          <h2 className="text-lg font-bold text-white">{category.name}</h2>
          {category.minNote && (
            <p className="text-xs text-gray-400 hidden sm:block">
              {category.minNote}
            </p>
          )}
        </div>

        {/* Mobile min note */}
        {category.minNote && (
          <p className="text-xs text-gray-400 px-4 py-2 border-b border-gray-700 sm:hidden">
            {category.minNote}
          </p>
        )}

        {/* Stats Grid */}
        <div className="p-4">
          {!hasData ? (
            <div className="text-center py-12">
              <p className="text-gray-400">
                No {category.name.toLowerCase()} stats recorded yet
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {category.stats.map(stat => {
                const statLeaderboard = catLeaderboards[stat.key] || []
                const leader = statLeaderboard[0]

                return (
                  <div
                    key={stat.key}
                    className="bg-gray-900/50 rounded-lg border border-gray-700 overflow-hidden"
                  >
                    {/* Stat Header with Leader Highlight */}
                    <div className="p-3 border-b border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-gray-300">
                          {stat.label}
                        </h3>
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded"
                          style={{ backgroundColor: `${teamColors.primary}30`, color: teamColors.primary }}
                        >
                          {stat.abbr}
                        </span>
                      </div>

                      {/* Leader Card */}
                      {leader ? (
                        <div
                          className="rounded-lg p-3 flex items-center gap-3"
                          style={{ backgroundColor: `${teamColors.primary}15` }}
                        >
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                            style={{ backgroundColor: teamColors.primary }}
                          >
                            1
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {leader.teamLogo && (
                                <img
                                  src={leader.teamLogo}
                                  alt={leader.teamAbbr}
                                  className="w-5 h-5 object-contain flex-shrink-0"
                                />
                              )}
                              <Link
                                to={`${pathPrefix}/player/${leader.pid}`}
                                className="font-semibold text-white hover:underline truncate"
                              >
                                {leader.name}
                              </Link>
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              {mode === 'career' ? formatYears(leader.years) : leader.year}
                              {leader.position && ` • ${leader.position}`}
                            </div>
                          </div>
                          <div
                            className="text-xl font-bold flex-shrink-0"
                            style={{ color: teamColors.primary }}
                          >
                            {formatValue(leader.value, stat.format)}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-3 text-gray-500 text-sm">
                          No qualifying players
                        </div>
                      )}
                    </div>

                    {/* Rest of Leaderboard */}
                    {statLeaderboard.length > 1 && (
                      <div className="divide-y divide-gray-700/50">
                        {statLeaderboard.slice(1, 5).map((entry, idx) => (
                          <div
                            key={mode === 'career' ? entry.pid : `${entry.pid}-${entry.year}`}
                            className="px-3 py-2 flex items-center gap-3 hover:bg-gray-800/50 transition-colors"
                          >
                            <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-gray-400 text-xs font-medium flex-shrink-0">
                              {idx + 2}
                            </div>
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {entry.teamLogo && (
                                <img
                                  src={entry.teamLogo}
                                  alt={entry.teamAbbr}
                                  className="w-4 h-4 object-contain flex-shrink-0"
                                />
                              )}
                              <Link
                                to={`${pathPrefix}/player/${entry.pid}`}
                                className="text-sm text-gray-300 hover:text-white hover:underline truncate"
                              >
                                {entry.name}
                              </Link>
                            </div>
                            <div className="text-sm font-semibold text-gray-300 flex-shrink-0">
                              {formatValue(entry.value, stat.format)}
                            </div>
                          </div>
                        ))}

                        {/* Show more indicator if there are more entries */}
                        {statLeaderboard.length > 5 && (
                          <div className="px-3 py-2 text-center">
                            <span className="text-xs text-gray-500">
                              +{statLeaderboard.length - 5} more
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
