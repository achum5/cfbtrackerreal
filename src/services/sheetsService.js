import { auth } from '../config/firebase'
import { teamAbbreviations, getTeamAbbreviationsList, getAbbreviationFromDisplayName } from '../data/teamAbbreviations'

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3/files'

// Get the current user's OAuth access token
async function getAccessToken() {
  // Try to get from localStorage first
  const storedToken = localStorage.getItem('google_access_token')
  const tokenExpiry = localStorage.getItem('google_token_expiry')

  if (storedToken && tokenExpiry) {
    const expiryTime = parseInt(tokenExpiry)
    if (Date.now() < expiryTime) {
      return storedToken
    }
  }

  // Token not found or expired
  throw new Error('OAuth access token not found or expired. Please sign out and sign back in.')
}

// Create a new Google Sheet for a dynasty
export async function createDynastySheet(dynastyName, coachName, year) {
  try {
    const user = auth.currentUser
    if (!user) throw new Error('User not authenticated')

    // Get OAuth access token from localStorage
    const accessToken = await getAccessToken()

    // Create the spreadsheet
    const response = await fetch(SHEETS_API_BASE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: `${dynastyName} Dynasty - ${coachName} (${year})`
        },
        sheets: [
          {
            properties: {
              title: 'Schedule',
              gridProperties: {
                rowCount: 14,
                columnCount: 4,
                frozenRowCount: 1
              }
            }
          },
          {
            properties: {
              title: 'Roster',
              gridProperties: {
                rowCount: 86,
                columnCount: 12,
                frozenRowCount: 1
              }
            }
          }
        ]
      })
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('Sheets API error:', error)
      throw new Error(`Failed to create sheet: ${error.error?.message || 'Unknown error'}`)
    }

    const sheet = await response.json()

    // Extract actual sheet IDs from the response
    const scheduleSheetId = sheet.sheets[0].properties.sheetId
    const rosterSheetId = sheet.sheets[1].properties.sheetId

    console.log('Sheet IDs:', { scheduleSheetId, rosterSheetId })

    // Initialize headers with actual sheet IDs and user's team name
    await initializeSheetHeaders(sheet.spreadsheetId, accessToken, scheduleSheetId, rosterSheetId, dynastyName)

    return {
      spreadsheetId: sheet.spreadsheetId,
      spreadsheetUrl: sheet.spreadsheetUrl
    }
  } catch (error) {
    console.error('Error creating dynasty sheet:', error)
    throw error
  }
}

// Helper function to convert hex color to RGB object for Google Sheets API
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    red: parseInt(result[1], 16) / 255,
    green: parseInt(result[2], 16) / 255,
    blue: parseInt(result[3], 16) / 255
  } : { red: 1, green: 1, blue: 1 }
}

// Generate conditional formatting rules for team colors (case-insensitive)
function generateTeamFormattingRules(sheetId, columnIndex) {
  const rules = []

  for (const [abbr, teamData] of Object.entries(teamAbbreviations)) {
    // Add rule for uppercase version
    rules.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [{
            sheetId: sheetId,
            startRowIndex: 1,
            endRowIndex: 13,
            startColumnIndex: columnIndex,
            endColumnIndex: columnIndex + 1
          }],
          booleanRule: {
            condition: {
              type: 'TEXT_EQ',
              values: [{ userEnteredValue: abbr }]
            },
            format: {
              backgroundColor: hexToRgb(teamData.backgroundColor),
              textFormat: {
                foregroundColor: hexToRgb(teamData.textColor),
                bold: true,
                italic: true
              }
            }
          }
        },
        index: 0
      }
    })

    // Add rule for lowercase version
    rules.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [{
            sheetId: sheetId,
            startRowIndex: 1,
            endRowIndex: 13,
            startColumnIndex: columnIndex,
            endColumnIndex: columnIndex + 1
          }],
          booleanRule: {
            condition: {
              type: 'TEXT_EQ',
              values: [{ userEnteredValue: abbr.toLowerCase() }]
            },
            format: {
              backgroundColor: hexToRgb(teamData.backgroundColor),
              textFormat: {
                foregroundColor: hexToRgb(teamData.textColor),
                bold: true,
                italic: true
              }
            }
          }
        },
        index: 0
      }
    })
  }

  return rules
}

// Initialize sheet headers
async function initializeSheetHeaders(spreadsheetId, accessToken, scheduleSheetId, rosterSheetId, userTeamName) {
  try {
    console.log('Initializing sheet headers and data...')

    // Get user team abbreviation
    const userTeamAbbr = getAbbreviationFromDisplayName(userTeamName)
    console.log('User team abbreviation:', userTeamAbbr, 'for team:', userTeamName)

    const requests = [
      // Schedule headers
      {
        updateCells: {
          range: {
            sheetId: scheduleSheetId, // Schedule sheet
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: 4
          },
          rows: [{
            values: [
              { userEnteredValue: { stringValue: 'Week' } },
              { userEnteredValue: { stringValue: 'User Team' } },
              { userEnteredValue: { stringValue: 'CPU Team' } },
              { userEnteredValue: { stringValue: 'Site' } }
            ]
          }],
          fields: 'userEnteredValue'
        }
      },
      // Pre-fill Week column with weeks 1-12
      {
        updateCells: {
          range: {
            sheetId: scheduleSheetId,
            startRowIndex: 1,
            endRowIndex: 13,
            startColumnIndex: 0,
            endColumnIndex: 1
          },
          rows: Array.from({ length: 12 }, (_, i) => ({
            values: [{ userEnteredValue: { numberValue: i + 1 } }]
          })),
          fields: 'userEnteredValue'
        }
      },
      // Pre-fill User Team column with user's team abbreviation
      ...(userTeamAbbr ? [{
        updateCells: {
          range: {
            sheetId: scheduleSheetId,
            startRowIndex: 1,
            endRowIndex: 13,
            startColumnIndex: 1,
            endColumnIndex: 2
          },
          rows: Array.from({ length: 12 }, () => ({
            values: [{ userEnteredValue: { stringValue: userTeamAbbr } }]
          })),
          fields: 'userEnteredValue'
        }
      }] : []),
      // Roster headers (12 columns)
      {
        updateCells: {
          range: {
            sheetId: rosterSheetId, // Roster sheet
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: 12
          },
          rows: [{
            values: [
              { userEnteredValue: { stringValue: 'Name' } },
              { userEnteredValue: { stringValue: 'Position' } },
              { userEnteredValue: { stringValue: 'Class' } },
              { userEnteredValue: { stringValue: 'Dev Trait' } },
              { userEnteredValue: { stringValue: 'Jersey #' } },
              { userEnteredValue: { stringValue: 'Archetype' } },
              { userEnteredValue: { stringValue: 'Overall' } },
              { userEnteredValue: { stringValue: 'Height' } },
              { userEnteredValue: { stringValue: 'Weight' } },
              { userEnteredValue: { stringValue: 'Hometown' } },
              { userEnteredValue: { stringValue: 'State' } },
              { userEnteredValue: { stringValue: 'Recruitment Stars' } }
            ]
          }],
          fields: 'userEnteredValue'
        }
      },
      // Bold headers
      {
        repeatCell: {
          range: {
            sheetId: scheduleSheetId,
            startRowIndex: 0,
            endRowIndex: 1
          },
          cell: {
            userEnteredFormat: {
              textFormat: { bold: true }
            }
          },
          fields: 'userEnteredFormat.textFormat.bold'
        }
      },
      {
        repeatCell: {
          range: {
            sheetId: rosterSheetId,
            startRowIndex: 0,
            endRowIndex: 1
          },
          cell: {
            userEnteredFormat: {
              textFormat: { bold: true }
            }
          },
          fields: 'userEnteredFormat.textFormat.bold'
        }
      },
      // Protect Schedule header row
      {
        addProtectedRange: {
          protectedRange: {
            range: {
              sheetId: scheduleSheetId,
              startRowIndex: 0,
              endRowIndex: 1
            },
            description: 'Protected header row',
            warningOnly: false
          }
        }
      },
      // Protect Schedule Column A (Week)
      {
        addProtectedRange: {
          protectedRange: {
            range: {
              sheetId: scheduleSheetId,
              startRowIndex: 1,
              endRowIndex: 13,
              startColumnIndex: 0,
              endColumnIndex: 1
            },
            description: 'Protected Week column',
            warningOnly: false
          }
        }
      },
      // Protect Schedule Column B (User Team)
      {
        addProtectedRange: {
          protectedRange: {
            range: {
              sheetId: scheduleSheetId,
              startRowIndex: 1,
              endRowIndex: 13,
              startColumnIndex: 1,
              endColumnIndex: 2
            },
            description: 'Protected User Team column',
            warningOnly: false
          }
        }
      },
      // Protect Roster header row
      {
        addProtectedRange: {
          protectedRange: {
            range: {
              sheetId: rosterSheetId,
              startRowIndex: 0,
              endRowIndex: 1
            },
            description: 'Protected header row',
            warningOnly: false
          }
        }
      },
      // Format all cells in Schedule sheet: Bold, Italic, Center, Barlow font, size 10
      {
        repeatCell: {
          range: {
            sheetId: scheduleSheetId
          },
          cell: {
            userEnteredFormat: {
              textFormat: {
                bold: true,
                italic: true,
                fontFamily: 'Barlow',
                fontSize: 10
              },
              horizontalAlignment: 'CENTER',
              verticalAlignment: 'MIDDLE'
            }
          },
          fields: 'userEnteredFormat(textFormat,horizontalAlignment,verticalAlignment)'
        }
      },
      // Format all cells in Roster sheet: Bold, Italic, Center, Barlow font, size 10
      {
        repeatCell: {
          range: {
            sheetId: rosterSheetId
          },
          cell: {
            userEnteredFormat: {
              textFormat: {
                bold: true,
                italic: true,
                fontFamily: 'Barlow',
                fontSize: 10
              },
              horizontalAlignment: 'CENTER',
              verticalAlignment: 'MIDDLE'
            }
          },
          fields: 'userEnteredFormat(textFormat,horizontalAlignment,verticalAlignment)'
        }
      },
      // Add data validation dropdown for User Team column (B2:B13)
      {
        setDataValidation: {
          range: {
            sheetId: scheduleSheetId,
            startRowIndex: 1,
            endRowIndex: 13,
            startColumnIndex: 1,
            endColumnIndex: 2
          },
          rule: {
            condition: {
              type: 'ONE_OF_LIST',
              values: getTeamAbbreviationsList().map(abbr => ({ userEnteredValue: abbr }))
            },
            showCustomUi: true,
            strict: true
          }
        }
      },
      // Add data validation dropdown for CPU Team column (C2:C13)
      {
        setDataValidation: {
          range: {
            sheetId: scheduleSheetId,
            startRowIndex: 1,
            endRowIndex: 13,
            startColumnIndex: 2,
            endColumnIndex: 3
          },
          rule: {
            condition: {
              type: 'ONE_OF_LIST',
              values: getTeamAbbreviationsList().map(abbr => ({ userEnteredValue: abbr }))
            },
            showCustomUi: true,
            strict: true
          }
        }
      },
      // Add data validation dropdown for Site column (D2:D13)
      {
        setDataValidation: {
          range: {
            sheetId: scheduleSheetId,
            startRowIndex: 1,
            endRowIndex: 13,
            startColumnIndex: 3,
            endColumnIndex: 4
          },
          rule: {
            condition: {
              type: 'ONE_OF_LIST',
              values: [
                { userEnteredValue: 'Home' },
                { userEnteredValue: 'Road' },
                { userEnteredValue: 'Neutral' }
              ]
            },
            showCustomUi: true,
            strict: true
          }
        }
      },
      // Add data validation dropdown for Position column in Roster (B2:B86)
      {
        setDataValidation: {
          range: {
            sheetId: rosterSheetId,
            startRowIndex: 1,
            endRowIndex: 86,
            startColumnIndex: 1,
            endColumnIndex: 2
          },
          rule: {
            condition: {
              type: 'ONE_OF_LIST',
              values: [
                { userEnteredValue: 'QB' },
                { userEnteredValue: 'HB' },
                { userEnteredValue: 'FB' },
                { userEnteredValue: 'WR' },
                { userEnteredValue: 'TE' },
                { userEnteredValue: 'LT' },
                { userEnteredValue: 'LG' },
                { userEnteredValue: 'C' },
                { userEnteredValue: 'RG' },
                { userEnteredValue: 'RT' },
                { userEnteredValue: 'LEDG' },
                { userEnteredValue: 'REDG' },
                { userEnteredValue: 'DT' },
                { userEnteredValue: 'SAM' },
                { userEnteredValue: 'MIKE' },
                { userEnteredValue: 'WILL' },
                { userEnteredValue: 'CB' },
                { userEnteredValue: 'FS' },
                { userEnteredValue: 'SS' },
                { userEnteredValue: 'K' },
                { userEnteredValue: 'P' }
              ]
            },
            showCustomUi: true,
            strict: true
          }
        }
      },
      // Add data validation dropdown for Class column in Roster (C2:C86)
      {
        setDataValidation: {
          range: {
            sheetId: rosterSheetId,
            startRowIndex: 1,
            endRowIndex: 86,
            startColumnIndex: 2,
            endColumnIndex: 3
          },
          rule: {
            condition: {
              type: 'ONE_OF_LIST',
              values: [
                { userEnteredValue: 'Fr' },
                { userEnteredValue: 'RS Fr' },
                { userEnteredValue: 'So' },
                { userEnteredValue: 'RS So' },
                { userEnteredValue: 'Jr' },
                { userEnteredValue: 'RS Jr' },
                { userEnteredValue: 'Sr' },
                { userEnteredValue: 'RS Sr' }
              ]
            },
            showCustomUi: true,
            strict: true
          }
        }
      },
      // Add data validation dropdown for Dev Trait column in Roster (D2:D86)
      {
        setDataValidation: {
          range: {
            sheetId: rosterSheetId,
            startRowIndex: 1,
            endRowIndex: 86,
            startColumnIndex: 3,
            endColumnIndex: 4
          },
          rule: {
            condition: {
              type: 'ONE_OF_LIST',
              values: [
                { userEnteredValue: 'Elite' },
                { userEnteredValue: 'Star' },
                { userEnteredValue: 'Impact' },
                { userEnteredValue: 'Normal' }
              ]
            },
            showCustomUi: true,
            strict: true
          }
        }
      },
      // Add data validation dropdown for Archetype column in Roster (F2:F86)
      {
        setDataValidation: {
          range: {
            sheetId: rosterSheetId,
            startRowIndex: 1,
            endRowIndex: 86,
            startColumnIndex: 5,
            endColumnIndex: 6
          },
          rule: {
            condition: {
              type: 'ONE_OF_LIST',
              values: [
                // QB Archetypes
                { userEnteredValue: 'Backfield Creator' },
                { userEnteredValue: 'Dual Threat' },
                { userEnteredValue: 'Pocket Passer' },
                { userEnteredValue: 'Pure Runner' },
                // HB Archetypes
                { userEnteredValue: 'Backfield Threat' },
                { userEnteredValue: 'East/West Playmaker' },
                { userEnteredValue: 'Elusive Bruiser' },
                { userEnteredValue: 'North/South Receiver' },
                { userEnteredValue: 'North/South Blocker' },
                // FB Archetypes
                { userEnteredValue: 'Blocking' },
                { userEnteredValue: 'Utility' },
                // WR Archetypes
                { userEnteredValue: 'Contested Specialist' },
                { userEnteredValue: 'Elusive Route Runner' },
                { userEnteredValue: 'Gadget' },
                { userEnteredValue: 'Gritty Possession' },
                { userEnteredValue: 'Physical Route Runner' },
                { userEnteredValue: 'Route Artist' },
                { userEnteredValue: 'Speedster' },
                // TE Archetypes
                { userEnteredValue: 'Possession' },
                { userEnteredValue: 'Pure Blocker' },
                { userEnteredValue: 'Vertical Threat' },
                // OL Archetypes
                { userEnteredValue: 'Agile' },
                { userEnteredValue: 'Pass Protector' },
                { userEnteredValue: 'Raw Strength' },
                { userEnteredValue: 'Ground and Pound' },
                { userEnteredValue: 'Well Rounded' },
                // DL Archetypes
                { userEnteredValue: 'Edge Setter' },
                { userEnteredValue: 'Gap Specialist' },
                { userEnteredValue: 'Power Rusher' },
                { userEnteredValue: 'Pure Power' },
                { userEnteredValue: 'Speed Rusher' },
                // LB Archetypes
                { userEnteredValue: 'Lurker' },
                { userEnteredValue: 'Signal Caller' },
                { userEnteredValue: 'Thumper' },
                // CB Archetypes
                { userEnteredValue: 'Boundary' },
                { userEnteredValue: 'Field' },
                { userEnteredValue: 'Zone' },
                // S Archetypes
                { userEnteredValue: 'Box Specialist' },
                { userEnteredValue: 'Coverage Specialist' },
                { userEnteredValue: 'Hybrid' },
                // K/P Archetypes
                { userEnteredValue: 'Accurate' },
                { userEnteredValue: 'Power' }
              ]
            },
            showCustomUi: true,
            strict: true
          }
        }
      },
      // Add data validation dropdown for Height column in Roster (H2:H86)
      {
        setDataValidation: {
          range: {
            sheetId: rosterSheetId,
            startRowIndex: 1,
            endRowIndex: 86,
            startColumnIndex: 7,
            endColumnIndex: 8
          },
          rule: {
            condition: {
              type: 'ONE_OF_LIST',
              values: [
                { userEnteredValue: '5\'6"' }, { userEnteredValue: '5\'7"' }, { userEnteredValue: '5\'8"' },
                { userEnteredValue: '5\'9"' }, { userEnteredValue: '5\'10"' }, { userEnteredValue: '5\'11"' },
                { userEnteredValue: '6\'0"' }, { userEnteredValue: '6\'1"' }, { userEnteredValue: '6\'2"' },
                { userEnteredValue: '6\'3"' }, { userEnteredValue: '6\'4"' }, { userEnteredValue: '6\'5"' },
                { userEnteredValue: '6\'6"' }, { userEnteredValue: '6\'7"' }, { userEnteredValue: '6\'8"' },
                { userEnteredValue: '6\'9"' }, { userEnteredValue: '6\'10"' }
              ]
            },
            showCustomUi: true,
            strict: false  // Allow typing for flexibility
          }
        }
      },
      // Add data validation dropdown for State column in Roster (K2:K86)
      {
        setDataValidation: {
          range: {
            sheetId: rosterSheetId,
            startRowIndex: 1,
            endRowIndex: 86,
            startColumnIndex: 10,
            endColumnIndex: 11
          },
          rule: {
            condition: {
              type: 'ONE_OF_LIST',
              values: [
                { userEnteredValue: 'AL' }, { userEnteredValue: 'AK' }, { userEnteredValue: 'AZ' },
                { userEnteredValue: 'AR' }, { userEnteredValue: 'CA' }, { userEnteredValue: 'CO' },
                { userEnteredValue: 'CT' }, { userEnteredValue: 'DE' }, { userEnteredValue: 'FL' },
                { userEnteredValue: 'GA' }, { userEnteredValue: 'HI' }, { userEnteredValue: 'ID' },
                { userEnteredValue: 'IL' }, { userEnteredValue: 'IN' }, { userEnteredValue: 'IA' },
                { userEnteredValue: 'KS' }, { userEnteredValue: 'KY' }, { userEnteredValue: 'LA' },
                { userEnteredValue: 'ME' }, { userEnteredValue: 'MD' }, { userEnteredValue: 'MA' },
                { userEnteredValue: 'MI' }, { userEnteredValue: 'MN' }, { userEnteredValue: 'MS' },
                { userEnteredValue: 'MO' }, { userEnteredValue: 'MT' }, { userEnteredValue: 'NE' },
                { userEnteredValue: 'NV' }, { userEnteredValue: 'NH' }, { userEnteredValue: 'NJ' },
                { userEnteredValue: 'NM' }, { userEnteredValue: 'NY' }, { userEnteredValue: 'NC' },
                { userEnteredValue: 'ND' }, { userEnteredValue: 'OH' }, { userEnteredValue: 'OK' },
                { userEnteredValue: 'OR' }, { userEnteredValue: 'PA' }, { userEnteredValue: 'RI' },
                { userEnteredValue: 'SC' }, { userEnteredValue: 'SD' }, { userEnteredValue: 'TN' },
                { userEnteredValue: 'TX' }, { userEnteredValue: 'UT' }, { userEnteredValue: 'VT' },
                { userEnteredValue: 'VA' }, { userEnteredValue: 'WA' }, { userEnteredValue: 'WV' },
                { userEnteredValue: 'WI' }, { userEnteredValue: 'WY' }, { userEnteredValue: 'DC' }
              ]
            },
            showCustomUi: true,
            strict: true
          }
        }
      },
      // Add data validation dropdown for Recruitment Stars column in Roster (L2:L86)
      {
        setDataValidation: {
          range: {
            sheetId: rosterSheetId,
            startRowIndex: 1,
            endRowIndex: 86,
            startColumnIndex: 11,
            endColumnIndex: 12
          },
          rule: {
            condition: {
              type: 'ONE_OF_LIST',
              values: [
                { userEnteredValue: '☆' },
                { userEnteredValue: '☆☆' },
                { userEnteredValue: '☆☆☆' },
                { userEnteredValue: '☆☆☆☆' },
                { userEnteredValue: '☆☆☆☆☆' }
              ]
            },
            showCustomUi: true,
            strict: true
          }
        }
      }
    ]

    // Add conditional formatting rules for User Team column (column B, index 1)
    const userTeamFormattingRules = generateTeamFormattingRules(scheduleSheetId, 1)
    requests.push(...userTeamFormattingRules)

    // Add conditional formatting rules for CPU Team column (column C, index 2)
    const cpuTeamFormattingRules = generateTeamFormattingRules(scheduleSheetId, 2)
    requests.push(...cpuTeamFormattingRules)

    console.log('Sending batchUpdate with', requests.length, 'requests')

    const response = await fetch(`${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests })
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('BatchUpdate failed:', error)
      throw new Error(`Failed to initialize sheet: ${error.error?.message || 'Unknown error'}`)
    }

    const result = await response.json()
    console.log('✅ Sheet initialization complete:', result)
  } catch (error) {
    console.error('❌ Error initializing headers:', error)
    throw error
  }
}

// Get embed URL for a sheet
export function getSheetEmbedUrl(spreadsheetId, sheetName) {
  // Get the sheet GID (0 for Schedule, 1 for Roster)
  const gid = sheetName === 'Schedule' ? 0 : 1
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${gid}&rm=minimal`
}

// Read schedule data from sheet
export async function readScheduleFromSheet(spreadsheetId) {
  try {
    const user = auth.currentUser
    if (!user) throw new Error('User not authenticated')

    const accessToken = await getAccessToken()

    const response = await fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/Schedule!A2:D100`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      }
    )

    if (!response.ok) {
      throw new Error('Failed to read schedule')
    }

    const data = await response.json()
    const rows = data.values || []

    return rows
      .filter(row => row[2]) // Has CPU Team (opponent)
      .map((row, index) => {
        // Normalize location values: "Road" -> "away", "Home" -> "home", "Neutral" -> "neutral"
        let location = (row[3] || 'Home').toLowerCase()
        if (location === 'road') {
          location = 'away'
        }

        return {
          week: parseInt(row[0]) || index + 1,
          userTeam: (row[1] || '').toUpperCase(), // Convert to uppercase
          opponent: row[2].toUpperCase(), // Convert to uppercase
          location
        }
      })
  } catch (error) {
    console.error('Error reading schedule:', error)
    throw error
  }
}

// Delete a Google Sheet (move to trash)
export async function deleteGoogleSheet(spreadsheetId) {
  try {
    const user = auth.currentUser
    if (!user) throw new Error('User not authenticated')

    const accessToken = await getAccessToken()

    // Use Drive API to trash the file
    const response = await fetch(`${DRIVE_API_BASE}/${spreadsheetId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        trashed: true
      })
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('Failed to delete sheet:', error)
      throw new Error(`Failed to delete sheet: ${error.error?.message || 'Unknown error'}`)
    }

    console.log('✅ Google Sheet moved to trash:', spreadsheetId)
    return true
  } catch (error) {
    console.error('Error deleting Google Sheet:', error)
    throw error
  }
}

// Read roster data from sheet (12 columns)
export async function readRosterFromSheet(spreadsheetId) {
  try {
    const user = auth.currentUser
    if (!user) throw new Error('User not authenticated')

    const accessToken = await getAccessToken()

    const response = await fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/Roster!A2:L100`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      }
    )

    if (!response.ok) {
      throw new Error('Failed to read roster')
    }

    const data = await response.json()
    const rows = data.values || []

    // Helper to convert star symbols to number
    const starsToNumber = (starsStr) => {
      if (!starsStr) return null
      const count = (starsStr.match(/☆/g) || []).length
      return count > 0 ? count : null
    }

    // Helper to normalize height to 6'1" format
    const normalizeHeight = (heightStr) => {
      if (!heightStr) return ''
      let h = heightStr.toString().trim()

      // Replace any smart quotes with standard quotes
      h = h.replace(/['']/g, "'").replace(/[""]/g, '"')

      // Already in correct format (6'1")
      if (/^\d['′']\d{1,2}["″"]$/.test(h)) {
        // Normalize quotes
        return h.replace(/['′']/g, "'").replace(/["″"]/g, '"')
      }

      // Format: 6'1 or 6′1 (missing closing quote)
      const missingQuoteMatch = h.match(/^(\d)['′'](\d{1,2})$/)
      if (missingQuoteMatch) return `${missingQuoteMatch[1]}'${missingQuoteMatch[2]}"`

      // Format: 6-1 or 6-10
      const dashMatch = h.match(/^(\d)-(\d{1,2})$/)
      if (dashMatch) return `${dashMatch[1]}'${dashMatch[2]}"`

      // Format: 61, 62, 510, 511, 610 (no separator)
      if (/^\d{2,3}$/.test(h)) {
        if (h.length === 2) {
          // 61 -> 6'1"
          return `${h[0]}'${h[1]}"`
        } else if (h.length === 3) {
          // 510 -> 5'10", 611 -> 6'11"
          return `${h[0]}'${h.slice(1)}"`
        }
      }

      // Return as-is if we can't parse
      return h
    }

    return rows
      .filter(row => row[0] && row[6]) // Has name (col A) and overall rating (col G)
      .map(row => ({
        name: row[0],                              // A: Name
        position: row[1] || 'QB',                  // B: Position
        year: row[2] || 'Fr',                      // C: Class
        devTrait: row[3] || 'Normal',              // D: Dev Trait
        jerseyNumber: row[4] || '',                // E: Jersey #
        archetype: row[5] || '',                   // F: Archetype
        overall: parseInt(row[6]) || 0,            // G: Overall
        height: normalizeHeight(row[7]),           // H: Height (auto-formats to 6'1")
        weight: row[8] ? parseInt(row[8]) : null,  // I: Weight
        hometown: row[9] || '',                    // J: Hometown
        state: row[10] || '',                      // K: State
        stars: starsToNumber(row[11])              // L: Recruitment Stars (☆ symbols -> number)
      }))
  } catch (error) {
    console.error('Error reading roster:', error)
    throw error
  }
}

// Write existing schedule and roster data to a sheet
export async function writeExistingDataToSheet(spreadsheetId, schedule, players, userTeamAbbr) {
  try {
    const user = auth.currentUser
    if (!user) throw new Error('User not authenticated')

    const accessToken = await getAccessToken()

    // Prepare schedule data (rows 2-13, columns A-D)
    const scheduleValues = []
    for (let i = 0; i < 12; i++) {
      const game = schedule?.[i]
      if (game) {
        // Convert location back to sheet format
        let site = 'Home'
        if (game.location === 'away') site = 'Road'
        else if (game.location === 'neutral') site = 'Neutral'

        scheduleValues.push([
          game.week || i + 1,
          game.userTeam || userTeamAbbr || '',
          game.opponent || '',
          site
        ])
      } else {
        scheduleValues.push([i + 1, userTeamAbbr || '', '', ''])
      }
    }

    // Helper to convert number to star symbols
    const numberToStars = (num) => {
      if (!num || num < 1 || num > 5) return ''
      return '☆'.repeat(num)
    }

    // Helper to normalize height to 6'1" format
    const normalizeHeight = (heightStr) => {
      if (!heightStr) return ''
      let h = heightStr.toString().trim()
      h = h.replace(/['']/g, "'").replace(/[""]/g, '"')
      if (/^\d['′']\d{1,2}["″"]$/.test(h)) {
        return h.replace(/['′']/g, "'").replace(/["″"]/g, '"')
      }
      const missingQuoteMatch = h.match(/^(\d)['′'](\d{1,2})$/)
      if (missingQuoteMatch) return `${missingQuoteMatch[1]}'${missingQuoteMatch[2]}"`
      const dashMatch = h.match(/^(\d)-(\d{1,2})$/)
      if (dashMatch) return `${dashMatch[1]}'${dashMatch[2]}"`
      if (/^\d{2,3}$/.test(h)) {
        if (h.length === 2) return `${h[0]}'${h[1]}"`
        if (h.length === 3) return `${h[0]}'${h.slice(1)}"`
      }
      return h
    }

    // Prepare roster data (rows 2-86, columns A-L, 12 columns)
    const rosterValues = players?.map(player => [
      player.name || '',                    // A: Name
      player.position || '',                // B: Position
      player.year || '',                    // C: Class
      player.devTrait || 'Normal',          // D: Dev Trait
      player.jerseyNumber || '',            // E: Jersey #
      player.archetype || '',               // F: Archetype
      player.overall || '',                 // G: Overall
      normalizeHeight(player.height),       // H: Height (normalized to 6'1" format)
      player.weight || '',                  // I: Weight
      player.hometown || '',                // J: Hometown
      player.state || '',                   // K: State
      numberToStars(player.stars)           // L: Recruitment Stars (number -> ☆ symbols)
    ]) || []

    // Batch update both sheets
    const requests = []

    // Write schedule data
    if (scheduleValues.length > 0) {
      requests.push(
        fetch(`${SHEETS_API_BASE}/${spreadsheetId}/values/Schedule!A2:D13?valueInputOption=RAW`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: scheduleValues
          })
        })
      )
    }

    // Write roster data (12 columns)
    if (rosterValues.length > 0) {
      requests.push(
        fetch(`${SHEETS_API_BASE}/${spreadsheetId}/values/Roster!A2:L${rosterValues.length + 1}?valueInputOption=RAW`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: rosterValues
          })
        })
      )
    }

    const responses = await Promise.all(requests)

    for (const response of responses) {
      if (!response.ok) {
        const error = await response.json()
        console.error('Failed to write data:', error)
        throw new Error(`Failed to write data: ${error.error?.message || 'Unknown error'}`)
      }
    }

    console.log('✅ Existing data written to sheet')
    return true
  } catch (error) {
    console.error('Error writing existing data to sheet:', error)
    throw error
  }
}

// Create a Conference Championship sheet
// excludeConference: optional conference name to exclude (if user already played their CC game)
export async function createConferenceChampionshipSheet(dynastyName, year, excludeConference = null) {
  try {
    const accessToken = await getAccessToken()

    // Conference list for CFB
    let conferences = [
      'SEC',
      'Big Ten',
      'Big 12',
      'ACC',
      'Pac-12',
      'American',
      'Mountain West',
      'Sun Belt',
      'MAC',
      'Conference USA'
    ]

    // Exclude user's conference if they already played their CC game
    if (excludeConference) {
      conferences = conferences.filter(conf =>
        conf.toLowerCase() !== excludeConference.toLowerCase()
      )
    }

    // Create the spreadsheet
    const response = await fetch(SHEETS_API_BASE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: `${dynastyName} - Conference Championships ${year}`
        },
        sheets: [
          {
            properties: {
              title: 'Conference Championships',
              gridProperties: {
                rowCount: conferences.length + 1,
                columnCount: 5,
                frozenRowCount: 1
              }
            }
          }
        ]
      })
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('Sheets API error:', error)
      throw new Error(`Failed to create CC sheet: ${error.error?.message || 'Unknown error'}`)
    }

    const sheet = await response.json()
    const ccSheetId = sheet.sheets[0].properties.sheetId

    // Initialize headers and data
    await initializeConferenceChampionshipSheet(sheet.spreadsheetId, accessToken, ccSheetId, conferences)

    return {
      spreadsheetId: sheet.spreadsheetId,
      spreadsheetUrl: sheet.spreadsheetUrl
    }
  } catch (error) {
    console.error('Error creating conference championship sheet:', error)
    throw error
  }
}

// Generate conditional formatting rules for team colors in CC sheet
function generateCCTeamFormattingRules(sheetId, columnIndex, rowCount) {
  const rules = []

  for (const [abbr, teamData] of Object.entries(teamAbbreviations)) {
    // Add rule for uppercase version
    rules.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [{
            sheetId: sheetId,
            startRowIndex: 1,
            endRowIndex: rowCount + 1,
            startColumnIndex: columnIndex,
            endColumnIndex: columnIndex + 1
          }],
          booleanRule: {
            condition: {
              type: 'TEXT_EQ',
              values: [{ userEnteredValue: abbr }]
            },
            format: {
              backgroundColor: hexToRgb(teamData.backgroundColor),
              textFormat: {
                foregroundColor: hexToRgb(teamData.textColor),
                bold: true,
                italic: true
              }
            }
          }
        },
        index: 0
      }
    })

    // Add rule for lowercase version
    rules.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [{
            sheetId: sheetId,
            startRowIndex: 1,
            endRowIndex: rowCount + 1,
            startColumnIndex: columnIndex,
            endColumnIndex: columnIndex + 1
          }],
          booleanRule: {
            condition: {
              type: 'TEXT_EQ',
              values: [{ userEnteredValue: abbr.toLowerCase() }]
            },
            format: {
              backgroundColor: hexToRgb(teamData.backgroundColor),
              textFormat: {
                foregroundColor: hexToRgb(teamData.textColor),
                bold: true,
                italic: true
              }
            }
          }
        },
        index: 0
      }
    })
  }

  return rules
}

// Initialize the Conference Championship sheet with headers and conference rows
async function initializeConferenceChampionshipSheet(spreadsheetId, accessToken, sheetId, conferences) {
  // Get team abbreviations for dropdown validation
  const teamAbbrs = getTeamAbbreviationsList()
  const rowCount = conferences.length

  const requests = [
    // Set headers
    {
      updateCells: {
        range: {
          sheetId: sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: 5
        },
        rows: [{
          values: [
            { userEnteredValue: { stringValue: 'Conference' } },
            { userEnteredValue: { stringValue: 'Team 1' } },
            { userEnteredValue: { stringValue: 'Team 2' } },
            { userEnteredValue: { stringValue: 'Team 1 Score' } },
            { userEnteredValue: { stringValue: 'Team 2 Score' } }
          ]
        }],
        fields: 'userEnteredValue'
      }
    },
    // Pre-fill conference names
    {
      updateCells: {
        range: {
          sheetId: sheetId,
          startRowIndex: 1,
          endRowIndex: rowCount + 1,
          startColumnIndex: 0,
          endColumnIndex: 1
        },
        rows: conferences.map(conf => ({
          values: [{ userEnteredValue: { stringValue: conf } }]
        })),
        fields: 'userEnteredValue'
      }
    },
    // Format all cells: Bold, Italic, Center, Barlow font, size 10
    {
      repeatCell: {
        range: {
          sheetId: sheetId
        },
        cell: {
          userEnteredFormat: {
            textFormat: {
              bold: true,
              italic: true,
              fontFamily: 'Barlow',
              fontSize: 10
            },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE'
          }
        },
        fields: 'userEnteredFormat(textFormat,horizontalAlignment,verticalAlignment)'
      }
    },
    // Add STRICT team dropdown validation for Team 1 column
    {
      setDataValidation: {
        range: {
          sheetId: sheetId,
          startRowIndex: 1,
          endRowIndex: rowCount + 1,
          startColumnIndex: 1,
          endColumnIndex: 2
        },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: teamAbbrs.map(abbr => ({ userEnteredValue: abbr }))
          },
          showCustomUi: true,
          strict: true
        }
      }
    },
    // Add STRICT team dropdown validation for Team 2 column
    {
      setDataValidation: {
        range: {
          sheetId: sheetId,
          startRowIndex: 1,
          endRowIndex: rowCount + 1,
          startColumnIndex: 2,
          endColumnIndex: 3
        },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: teamAbbrs.map(abbr => ({ userEnteredValue: abbr }))
          },
          showCustomUi: true,
          strict: true
        }
      }
    },
    // Protect header row (not just warning)
    {
      addProtectedRange: {
        protectedRange: {
          range: {
            sheetId: sheetId,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: 5
          },
          description: 'Protected header row',
          warningOnly: false
        }
      }
    },
    // Protect conference column (not just warning)
    {
      addProtectedRange: {
        protectedRange: {
          range: {
            sheetId: sheetId,
            startRowIndex: 1,
            endRowIndex: rowCount + 1,
            startColumnIndex: 0,
            endColumnIndex: 1
          },
          description: 'Protected Conference column',
          warningOnly: false
        }
      }
    },
    // Set column widths
    {
      updateDimensionProperties: {
        range: {
          sheetId: sheetId,
          dimension: 'COLUMNS',
          startIndex: 0,
          endIndex: 1
        },
        properties: { pixelSize: 130 },
        fields: 'pixelSize'
      }
    },
    {
      updateDimensionProperties: {
        range: {
          sheetId: sheetId,
          dimension: 'COLUMNS',
          startIndex: 1,
          endIndex: 3
        },
        properties: { pixelSize: 100 },
        fields: 'pixelSize'
      }
    },
    {
      updateDimensionProperties: {
        range: {
          sheetId: sheetId,
          dimension: 'COLUMNS',
          startIndex: 3,
          endIndex: 5
        },
        properties: { pixelSize: 100 },
        fields: 'pixelSize'
      }
    },
    // Add conditional formatting for team colors (Team 1 column)
    ...generateCCTeamFormattingRules(sheetId, 1, rowCount),
    // Add conditional formatting for team colors (Team 2 column)
    ...generateCCTeamFormattingRules(sheetId, 2, rowCount)
  ]

  // Execute batch update
  const batchResponse = await fetch(`${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests })
  })

  if (!batchResponse.ok) {
    const error = await batchResponse.json()
    console.error('Error initializing CC sheet:', error)
    throw new Error(`Failed to initialize CC sheet: ${error.error?.message || 'Unknown error'}`)
  }
}

// Read Conference Championship data from sheet
export async function readConferenceChampionshipsFromSheet(spreadsheetId) {
  try {
    const accessToken = await getAccessToken()

    const response = await fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/Conference Championships!A2:E11`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to read CC data: ${error.error?.message || 'Unknown error'}`)
    }

    const data = await response.json()
    const rows = data.values || []

    // Parse into structured data
    const championships = rows.map(row => ({
      conference: row[0] || '',
      team1: (row[1] || '').toUpperCase(),
      team2: (row[2] || '').toUpperCase(),
      team1Score: row[3] ? parseInt(row[3]) : null,
      team2Score: row[4] ? parseInt(row[4]) : null,
      winner: null // Calculate based on scores
    })).map(game => ({
      ...game,
      winner: game.team1Score !== null && game.team2Score !== null
        ? (game.team1Score > game.team2Score ? game.team1 : game.team2)
        : null
    }))

    return championships
  } catch (error) {
    console.error('Error reading CC data:', error)
    throw error
  }
}
