// Box Score Stats Tab Configurations

export const STAT_TABS = {
  passing: {
    key: 'passing',
    title: 'Passing',
    headers: ['Player Name', 'QB Rating', 'Yards', 'TD', 'INT', 'Long', 'Sacks', 'Comp', 'Attempts'],
    rowCount: 6
  },
  rushing: {
    key: 'rushing',
    title: 'Rushing',
    headers: ['Player Name', 'Carries', 'Yards', 'TD', 'Fumbles', 'Broken Tackles', 'YAC', 'Long', '20+'],
    rowCount: 15
  },
  receiving: {
    key: 'receiving',
    title: 'Receiving',
    headers: ['Player Name', 'Receptions', 'Yards', 'TD', 'RAC', 'Long', 'Drops'],
    rowCount: 15
  },
  blocking: {
    key: 'blocking',
    title: 'Blocking',
    headers: ['Player Name', 'Sacks Allowed', 'Pancakes'],
    rowCount: 10
  },
  defense: {
    key: 'defense',
    title: 'Defense',
    headers: ['Player Name', 'Solo', 'Assists', 'TFL', 'Sack', 'INT', 'INT Yards', 'INT Long', 'Deflections', 'FF', 'FR', 'Fumble Yards', 'Blocks', 'Safeties', 'TD'],
    rowCount: 20
  },
  kicking: {
    key: 'kicking',
    title: 'Kicking',
    headers: ['Player Name', 'FGM', 'FGA', 'FG Long', 'FG Block', 'XPM', 'XPA', 'XPB', 'FGM 29', 'FGA 29', 'FGM 39', 'FGA 39', 'FGM 49', 'FGA 49', 'FGM 50+', 'FGA 50+', 'Kickoffs', 'Touchbacks'],
    rowCount: 3
  },
  punting: {
    key: 'punting',
    title: 'Punting',
    headers: ['Player Name', 'Punts', 'Yards', 'Net Yards', 'Block', 'In20', 'TB', 'Long'],
    rowCount: 3
  },
  kickReturn: {
    key: 'kickReturn',
    title: 'Kick Return',
    headers: ['Player Name', 'KR', 'Yards', 'TD', 'Long'],
    rowCount: 6
  },
  puntReturn: {
    key: 'puntReturn',
    title: 'Punt Return',
    headers: ['Player Name', 'PR', 'Yards', 'TD', 'Long'],
    rowCount: 6
  }
}

// Order of tabs in the sheet
export const STAT_TAB_ORDER = [
  'passing',
  'rushing',
  'receiving',
  'blocking',
  'defense',
  'kicking',
  'punting',
  'kickReturn',
  'puntReturn'
]

// Scoring Summary configuration
export const SCORING_SUMMARY = {
  title: 'Scoring Summary',
  headers: ['Team', 'Scorer', 'Passer', 'Score Type', 'Quarter', 'Time Left'],
  rowCount: 30
}

// Score type dropdown options
export const SCORE_TYPES = [
  'Rushing TD',
  'Passing TD',
  'Field Goal',
  'Extra Point',
  'Safety',
  '2-Point Conversion',
  'Kick Return TD',
  'Punt Return TD',
  'INT Return TD',
  'Fumble Return TD',
  'Blocked Punt/FG TD'
]

// Quarter dropdown options
export const QUARTERS = ['1', '2', '3', '4', 'OT', '2OT', '3OT', '4OT']

// Helper to get all stat tabs as array
export const getStatTabsArray = () => STAT_TAB_ORDER.map(key => STAT_TABS[key])
