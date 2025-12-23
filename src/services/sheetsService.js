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
  throw new Error('OAuth access token not found or expired. Try refreshing your session or sign out and sign back in.')
}

// Share a Google Sheet with "anyone with the link can edit"
// This is required for embedding sheets in iframes since iframes can't share auth cookies
async function shareSheetPublicly(spreadsheetId, accessToken) {
  try {
    const response = await fetch(`${DRIVE_API_BASE}/${spreadsheetId}/permissions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'writer',
        type: 'anyone'
      })
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('Failed to share sheet:', error)
      // Don't throw - sheet still works, just won't embed properly
    }
  } catch (error) {
    console.error('Error sharing sheet:', error)
    // Don't throw - sheet still works, just won't embed properly
  }
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
                rowCount: 13,
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
                columnCount: 11,
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

    // Initialize headers with actual sheet IDs and user's team name
    await initializeSheetHeaders(sheet.spreadsheetId, accessToken, scheduleSheetId, rosterSheetId, dynastyName)

    // Share sheet publicly so it can be embedded in iframe
    await shareSheetPublicly(sheet.spreadsheetId, accessToken)

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

// Generate conditional formatting rules for team colors with variable row range
function generateTeamFormattingRulesForRange(sheetId, columnIndex, startRowIndex, endRowIndex) {
  const rules = []

  for (const [abbr, teamData] of Object.entries(teamAbbreviations)) {
    // Add rule for uppercase version
    rules.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [{
            sheetId: sheetId,
            startRowIndex: startRowIndex,
            endRowIndex: endRowIndex,
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
            startRowIndex: startRowIndex,
            endRowIndex: endRowIndex,
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

// Generate team abbreviation dropdown validation for a range
function generateTeamValidation(sheetId, columnIndex, startRowIndex, endRowIndex) {
  return {
    setDataValidation: {
      range: {
        sheetId: sheetId,
        startRowIndex: startRowIndex,
        endRowIndex: endRowIndex,
        startColumnIndex: columnIndex,
        endColumnIndex: columnIndex + 1
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
  }
}

// Position list for validation dropdowns
const POSITION_LIST = [
  'QB', 'HB', 'FB', 'WR', 'TE',
  'LT', 'LG', 'C', 'RG', 'RT',
  'LEDG', 'REDG', 'DT',
  'SAM', 'MIKE', 'WILL',
  'CB', 'FS', 'SS',
  'K', 'P'
]

// Generate position dropdown validation for a range
function generatePositionValidation(sheetId, columnIndex, startRowIndex, endRowIndex) {
  return {
    setDataValidation: {
      range: {
        sheetId: sheetId,
        startRowIndex: startRowIndex,
        endRowIndex: endRowIndex,
        startColumnIndex: columnIndex,
        endColumnIndex: columnIndex + 1
      },
      rule: {
        condition: {
          type: 'ONE_OF_LIST',
          values: POSITION_LIST.map(pos => ({ userEnteredValue: pos }))
        },
        showCustomUi: true,
        strict: true
      }
    }
  }
}

// Class list for validation dropdowns
const CLASS_LIST = ['Fr', 'RS Fr', 'So', 'RS So', 'Jr', 'RS Jr', 'Sr', 'RS Sr']

// Generate class dropdown validation for a range
function generateClassValidation(sheetId, columnIndex, startRowIndex, endRowIndex) {
  return {
    setDataValidation: {
      range: {
        sheetId: sheetId,
        startRowIndex: startRowIndex,
        endRowIndex: endRowIndex,
        startColumnIndex: columnIndex,
        endColumnIndex: columnIndex + 1
      },
      rule: {
        condition: {
          type: 'ONE_OF_LIST',
          values: CLASS_LIST.map(cls => ({ userEnteredValue: cls }))
        },
        showCustomUi: true,
        strict: true
      }
    }
  }
}

// Initialize sheet headers
async function initializeSheetHeaders(spreadsheetId, accessToken, scheduleSheetId, rosterSheetId, userTeamName) {
  try {
    // Get user team abbreviation
    const userTeamAbbr = getAbbreviationFromDisplayName(userTeamName)

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
      // Roster headers (11 columns)
      {
        updateCells: {
          range: {
            sheetId: rosterSheetId, // Roster sheet
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: 11
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
              { userEnteredValue: { stringValue: 'State' } }
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
                { userEnteredValue: '5\'5"' }, { userEnteredValue: '5\'6"' }, { userEnteredValue: '5\'7"' },
                { userEnteredValue: '5\'8"' }, { userEnteredValue: '5\'9"' }, { userEnteredValue: '5\'10"' },
                { userEnteredValue: '5\'11"' }, { userEnteredValue: '6\'0"' }, { userEnteredValue: '6\'1"' },
                { userEnteredValue: '6\'2"' }, { userEnteredValue: '6\'3"' }, { userEnteredValue: '6\'4"' },
                { userEnteredValue: '6\'5"' }, { userEnteredValue: '6\'6"' }, { userEnteredValue: '6\'7"' },
                { userEnteredValue: '6\'8"' }, { userEnteredValue: '6\'9"' }, { userEnteredValue: '6\'10"' },
                { userEnteredValue: '6\'11"' }, { userEnteredValue: '7\'0"' }
              ]
            },
            showCustomUi: true,
            strict: true  // Only accept dropdown values, typing filters options
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
      }
    ]

    // Add conditional formatting rules for User Team column (column B, index 1)
    const userTeamFormattingRules = generateTeamFormattingRules(scheduleSheetId, 1)
    requests.push(...userTeamFormattingRules)

    // Add conditional formatting rules for CPU Team column (column C, index 2)
    const cpuTeamFormattingRules = generateTeamFormattingRules(scheduleSheetId, 2)
    requests.push(...cpuTeamFormattingRules)

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

    await response.json()
  } catch (error) {
    console.error('Error initializing headers:', error)
    throw error
  }
}

// Create a Schedule-only Google Sheet
export async function createScheduleSheet(dynastyName, year, userTeamName) {
  try {
    const user = auth.currentUser
    if (!user) throw new Error('User not authenticated')

    const accessToken = await getAccessToken()

    // Create the spreadsheet with just Schedule tab
    const response = await fetch(SHEETS_API_BASE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: `${dynastyName} Dynasty - ${year} Schedule`
        },
        sheets: [
          {
            properties: {
              title: 'Schedule',
              gridProperties: {
                rowCount: 13,
                columnCount: 4,
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
    const scheduleSheetId = sheet.sheets[0].properties.sheetId

    // Initialize schedule headers
    await initializeScheduleSheetOnly(sheet.spreadsheetId, accessToken, scheduleSheetId, userTeamName)

    // Share sheet publicly so it can be embedded in iframe
    await shareSheetPublicly(sheet.spreadsheetId, accessToken)

    return {
      spreadsheetId: sheet.spreadsheetId,
      spreadsheetUrl: sheet.spreadsheetUrl
    }
  } catch (error) {
    console.error('Error creating schedule sheet:', error)
    throw error
  }
}

// Create a Roster-only Google Sheet
export async function createRosterSheet(dynastyName, year) {
  try {
    const user = auth.currentUser
    if (!user) throw new Error('User not authenticated')

    const accessToken = await getAccessToken()

    // Create the spreadsheet with just Roster tab
    const response = await fetch(SHEETS_API_BASE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: `${dynastyName} Dynasty - ${year} Roster`
        },
        sheets: [
          {
            properties: {
              title: 'Roster',
              gridProperties: {
                rowCount: 86,
                columnCount: 11,
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
    const rosterSheetId = sheet.sheets[0].properties.sheetId

    // Initialize roster headers
    await initializeRosterSheetOnly(sheet.spreadsheetId, accessToken, rosterSheetId)

    // Share sheet publicly so it can be embedded in iframe
    await shareSheetPublicly(sheet.spreadsheetId, accessToken)

    return {
      spreadsheetId: sheet.spreadsheetId,
      spreadsheetUrl: sheet.spreadsheetUrl
    }
  } catch (error) {
    console.error('Error creating roster sheet:', error)
    throw error
  }
}

// Initialize Schedule-only sheet headers and formatting
async function initializeScheduleSheetOnly(spreadsheetId, accessToken, scheduleSheetId, userTeamName) {
  try {
    const userTeamAbbr = getAbbreviationFromDisplayName(userTeamName)

    const requests = [
      // Schedule headers
      {
        updateCells: {
          range: {
            sheetId: scheduleSheetId,
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
      }
    ]

    // Add conditional formatting rules for User Team column (column B, index 1)
    const userTeamFormattingRules = generateTeamFormattingRules(scheduleSheetId, 1)
    requests.push(...userTeamFormattingRules)

    // Add conditional formatting rules for CPU Team column (column C, index 2)
    const cpuTeamFormattingRules = generateTeamFormattingRules(scheduleSheetId, 2)
    requests.push(...cpuTeamFormattingRules)

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

    await response.json()
  } catch (error) {
    console.error('Error initializing schedule headers:', error)
    throw error
  }
}

// Initialize Roster-only sheet headers and formatting
async function initializeRosterSheetOnly(spreadsheetId, accessToken, rosterSheetId) {
  try {

    const requests = [
      // Roster headers (11 columns)
      {
        updateCells: {
          range: {
            sheetId: rosterSheetId,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: 11
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
              { userEnteredValue: { stringValue: 'State' } }
            ]
          }],
          fields: 'userEnteredValue'
        }
      },
      // Bold headers
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
                { userEnteredValue: '5\'5"' }, { userEnteredValue: '5\'6"' }, { userEnteredValue: '5\'7"' },
                { userEnteredValue: '5\'8"' }, { userEnteredValue: '5\'9"' }, { userEnteredValue: '5\'10"' },
                { userEnteredValue: '5\'11"' }, { userEnteredValue: '6\'0"' }, { userEnteredValue: '6\'1"' },
                { userEnteredValue: '6\'2"' }, { userEnteredValue: '6\'3"' }, { userEnteredValue: '6\'4"' },
                { userEnteredValue: '6\'5"' }, { userEnteredValue: '6\'6"' }, { userEnteredValue: '6\'7"' },
                { userEnteredValue: '6\'8"' }, { userEnteredValue: '6\'9"' }, { userEnteredValue: '6\'10"' },
                { userEnteredValue: '6\'11"' }, { userEnteredValue: '7\'0"' }
              ]
            },
            showCustomUi: true,
            strict: true  // Only accept dropdown values, typing filters options
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
      }
    ]

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

    await response.json()
  } catch (error) {
    console.error('Error initializing roster headers:', error)
    throw error
  }
}

// Read schedule data from a Schedule-only sheet
export async function readScheduleFromScheduleSheet(spreadsheetId) {
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
        let location = (row[3] || 'Home').toLowerCase()
        if (location === 'road') {
          location = 'away'
        }

        return {
          week: parseInt(row[0]) || index + 1,
          userTeam: (row[1] || '').toUpperCase(),
          opponent: row[2].toUpperCase(),
          location
        }
      })
  } catch (error) {
    console.error('Error reading schedule:', error)
    throw error
  }
}

// Read roster data from a Roster-only sheet
export async function readRosterFromRosterSheet(spreadsheetId) {
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

    return rows
      .filter(row => row[0] && row[6]) // Has name (col A) and overall rating (col G)
      .map(row => ({
        name: row[0],
        position: row[1] || 'QB',
        year: row[2] || 'Fr',
        devTrait: row[3] || 'Normal',
        jerseyNumber: row[4] || '',
        archetype: row[5] || '',
        overall: parseInt(row[6]) || 0,
        height: normalizeHeight(row[7]),
        weight: row[8] ? parseInt(row[8]) : null,
        hometown: row[9] || '',
        state: row[10] || '',
        stars: starsToNumber(row[11])
      }))
  } catch (error) {
    console.error('Error reading roster:', error)
    throw error
  }
}

// Pre-fill roster data into a Roster-only sheet
export async function prefillRosterSheet(spreadsheetId, players) {
  try {
    const user = auth.currentUser
    if (!user) throw new Error('User not authenticated')

    const accessToken = await getAccessToken()

    // Prepare roster data
    // Columns: Name | Position | Class | Dev Trait | Jersey # | Archetype | Overall | Height | Weight | Hometown | State
    const rosterValues = players.map(p => [
      p.name || '',
      p.position || '',
      p.year || '',
      p.devTrait || 'Normal',
      p.jerseyNumber || '',
      p.archetype || '',
      p.overall || '',
      p.height || '',
      p.weight || '',
      p.hometown || '',
      p.state || ''
    ])

    if (rosterValues.length === 0) return

    // Write roster data starting at row 2 (after header)
    const response = await fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/Roster!A2:K${rosterValues.length + 1}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: rosterValues
        })
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to prefill roster: ${error.error?.message || 'Unknown error'}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error prefilling roster:', error)
    throw error
  }
}

// Get embed URL for a sheet
// Using usp=sharing to tell Google to treat this as a shared link access
// The sheet is shared publicly ("anyone with link can edit")
export function getSheetEmbedUrl(spreadsheetId, sheetName) {
  // Get the sheet GID (0 for Schedule, 1 for Roster in combined sheet)
  // For single-tab sheets, always use 0
  const gid = sheetName === 'Roster' ? 1 : 0
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit?usp=sharing&rm=minimal&gid=${gid}`
}

// Get embed URL for a single-tab sheet (always gid=0)
export function getSingleSheetEmbedUrl(spreadsheetId) {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit?usp=sharing&rm=minimal&gid=0`
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
    if (!spreadsheetId) {
      throw new Error('No spreadsheet ID provided')
    }

    const user = auth.currentUser
    if (!user) throw new Error('User not authenticated')

    const accessToken = await getAccessToken()

    // Use Drive API to trash the file
    const url = `${DRIVE_API_BASE}/${spreadsheetId}`

    const response = await fetch(url, {
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
      const errorText = await response.text()
      let errorMessage = 'Unknown error'
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.error?.message || errorText
      } catch {
        errorMessage = errorText
      }
      throw new Error(`Failed to delete sheet: ${errorMessage}`)
    }

    await response.json()
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

    // Conference list for CFB (alphabetical order)
    let conferences = [
      'ACC',
      'American',
      'Big 12',
      'Big Ten',
      'Conference USA',
      'MAC',
      'Mountain West',
      'Pac-12',
      'SEC',
      'Sun Belt'
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

    // Share sheet publicly so it can be embedded in iframe
    await shareSheetPublicly(sheet.spreadsheetId, accessToken)

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

// Bowl games list for Bowl Week 1 (26 regular bowls + 4 CFP First Round = 30 games)
const BOWL_GAMES_WEEK_1 = [
  '68 Ventures Bowl',
  'Alamo Bowl',
  'Arizona Bowl',
  'Armed Forces Bowl',
  'Birmingham Bowl',
  'Boca Raton Bowl',
  'CFP First Round (#5 vs #12)',
  'CFP First Round (#6 vs #11)',
  'CFP First Round (#7 vs #10)',
  'CFP First Round (#8 vs #9)',
  'Cure Bowl',
  'Famous Idaho Potato Bowl',
  'Fenway Bowl',
  'Frisco Bowl',
  'GameAbove Sports Bowl',
  'Gasparilla Bowl',
  'Hawaii Bowl',
  'Holiday Bowl',
  'Independence Bowl',
  'LA Bowl',
  'Las Vegas Bowl',
  'Liberty Bowl',
  'Military Bowl',
  'Music City Bowl',
  'Myrtle Beach Bowl',
  'New Mexico Bowl',
  'New Orleans Bowl',
  'Pop-Tarts Bowl',
  'Rate Bowl',
  'Salute to Veterans Bowl'
]

// CFP First Round matchups (seed pairs)
const CFP_FIRST_ROUND_MATCHUPS = [
  { game: 'CFP First Round (#5 vs #12)', seed1: 5, seed2: 12 },
  { game: 'CFP First Round (#6 vs #11)', seed1: 6, seed2: 11 },
  { game: 'CFP First Round (#7 vs #10)', seed1: 7, seed2: 10 },
  { game: 'CFP First Round (#8 vs #9)', seed1: 8, seed2: 9 }
]

// Bowl games list for Bowl Week 2 (12 games - 4 are CFP Quarterfinals)
const BOWL_GAMES_WEEK_2 = [
  'Citrus Bowl',
  'Cotton Bowl (CFP QF)',
  "Duke's Mayo Bowl",
  'First Responder Bowl',
  'Gator Bowl',
  'Orange Bowl (CFP QF)',
  'Reliaquest Bowl',
  'Rose Bowl (CFP QF)',
  'Sugar Bowl (CFP QF)',
  'Sun Bowl',
  'Texas Bowl',
  'Xbox Bowl'
]

// CFP Quarterfinal matchup definitions
// Sugar Bowl: 12/5 winner vs #4
// Orange Bowl: 9/8 winner vs #1
// Rose Bowl: 11/6 winner vs #3
// Cotton Bowl: 10/7 winner vs #2
const CFP_QF_MATCHUPS = {
  'Sugar Bowl (CFP QF)': { firstRoundSeeds: [5, 12], topSeed: 4 },
  'Orange Bowl (CFP QF)': { firstRoundSeeds: [8, 9], topSeed: 1 },
  'Rose Bowl (CFP QF)': { firstRoundSeeds: [6, 11], topSeed: 3 },
  'Cotton Bowl (CFP QF)': { firstRoundSeeds: [7, 10], topSeed: 2 }
}

// All bowl games combined (for dropdown selection)
const ALL_BOWL_GAMES = [...BOWL_GAMES_WEEK_1, ...BOWL_GAMES_WEEK_2]

// Create Bowl Week 1 sheet with all bowl games (including CFP First Round with pre-filled teams)
// excludeGames: array of game names to exclude (user's CFP First Round game, user's bowl game)
export async function createBowlWeek1Sheet(dynastyName, year, cfpSeeds = [], excludeGames = []) {
  try {
    const accessToken = await getAccessToken()

    // Filter out games that the user is playing in (they enter those separately)
    const bowlGames = BOWL_GAMES_WEEK_1.filter(game => !excludeGames.includes(game))
    const rowCount = bowlGames.length

    // Create the spreadsheet
    const response = await fetch(SHEETS_API_BASE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: `${dynastyName} - Bowl Games ${year}`
        },
        sheets: [
          {
            properties: {
              title: 'Bowl Games',
              gridProperties: {
                rowCount: rowCount + 1,
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
      throw new Error(`Failed to create bowl sheet: ${error.error?.message || 'Unknown error'}`)
    }

    const sheet = await response.json()
    const bowlSheetId = sheet.sheets[0].properties.sheetId

    // Initialize headers and data (pass cfpSeeds to pre-fill CFP First Round teams)
    await initializeBowlWeek1Sheet(sheet.spreadsheetId, accessToken, bowlSheetId, bowlGames, cfpSeeds)

    // Share sheet publicly so it can be embedded in iframe
    await shareSheetPublicly(sheet.spreadsheetId, accessToken)

    return {
      spreadsheetId: sheet.spreadsheetId,
      spreadsheetUrl: sheet.spreadsheetUrl
    }
  } catch (error) {
    console.error('Error creating bowl week 1 sheet:', error)
    throw error
  }
}

// Generate conditional formatting rules for team colors in bowl sheet
function generateBowlTeamFormattingRules(sheetId, columnIndex, rowCount) {
  const rules = []

  for (const [abbr, teamData] of Object.entries(teamAbbreviations)) {
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
  }

  return rules
}

// Initialize the Bowl Week 1 sheet with headers and bowl game rows
async function initializeBowlWeek1Sheet(spreadsheetId, accessToken, sheetId, bowlGames, cfpSeeds = []) {
  const teamAbbrs = getTeamAbbreviationsList()
  const rowCount = bowlGames.length

  // Build pre-filled team data for CFP First Round games
  const getTeamBySeed = (seed) => {
    const seedData = cfpSeeds.find(s => s.seed === seed)
    return seedData?.team || ''
  }

  // Create rows with bowl names and pre-filled CFP teams
  const bowlRows = bowlGames.map(bowl => {
    const matchup = CFP_FIRST_ROUND_MATCHUPS.find(m => m.game === bowl)
    if (matchup && cfpSeeds.length > 0) {
      // This is a CFP First Round game - pre-fill teams based on seeds
      return {
        values: [
          { userEnteredValue: { stringValue: bowl } },
          { userEnteredValue: { stringValue: getTeamBySeed(matchup.seed1) } },
          { userEnteredValue: { stringValue: getTeamBySeed(matchup.seed2) } }
        ]
      }
    }
    // Regular bowl game - just the name
    return {
      values: [
        { userEnteredValue: { stringValue: bowl } },
        { userEnteredValue: { stringValue: '' } },
        { userEnteredValue: { stringValue: '' } }
      ]
    }
  })

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
            { userEnteredValue: { stringValue: 'Bowl Game' } },
            { userEnteredValue: { stringValue: 'Team 1' } },
            { userEnteredValue: { stringValue: 'Team 2' } },
            { userEnteredValue: { stringValue: 'Team 1 Score' } },
            { userEnteredValue: { stringValue: 'Team 2 Score' } }
          ]
        }],
        fields: 'userEnteredValue'
      }
    },
    // Pre-fill bowl game names and CFP teams
    {
      updateCells: {
        range: {
          sheetId: sheetId,
          startRowIndex: 1,
          endRowIndex: rowCount + 1,
          startColumnIndex: 0,
          endColumnIndex: 3
        },
        rows: bowlRows,
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
    // Protect header row
    {
      addProtectedRange: {
        protectedRange: {
          range: {
            sheetId: sheetId,
            startRowIndex: 0,
            endRowIndex: 1
          },
          description: 'Header row - do not edit',
          warningOnly: true
        }
      }
    },
    // Protect bowl names column
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
          description: 'Bowl names - do not edit',
          warningOnly: true
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
        properties: { pixelSize: 180 },
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
    ...generateBowlTeamFormattingRules(sheetId, 1, rowCount),
    // Add conditional formatting for team colors (Team 2 column)
    ...generateBowlTeamFormattingRules(sheetId, 2, rowCount)
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
    console.error('Error initializing bowl sheet:', error)
    throw new Error(`Failed to initialize bowl sheet: ${error.error?.message || 'Unknown error'}`)
  }
}

// Read Bowl Games data from sheet
export async function readBowlGamesFromSheet(spreadsheetId) {
  try {
    const accessToken = await getAccessToken()

    const rowCount = BOWL_GAMES_WEEK_1.length
    const response = await fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/Bowl Games!A2:E${rowCount + 1}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to read bowl data: ${error.error?.message || 'Unknown error'}`)
    }

    const data = await response.json()
    const rows = data.values || []

    // Parse into structured data
    const bowlGames = rows.map(row => ({
      bowlName: row[0] || '',
      team1: (row[1] || '').toUpperCase(),
      team2: (row[2] || '').toUpperCase(),
      team1Score: row[3] ? parseInt(row[3]) : null,
      team2Score: row[4] ? parseInt(row[4]) : null,
      winner: null
    })).map(game => ({
      ...game,
      winner: game.team1Score !== null && game.team2Score !== null
        ? (game.team1Score > game.team2Score ? game.team1 : game.team2)
        : null
    }))

    return bowlGames
  } catch (error) {
    console.error('Error reading bowl data:', error)
    throw error
  }
}

// Get list of bowl games for reference
export function getBowlGamesList() {
  return [...BOWL_GAMES_WEEK_1]
}

// Get list of Week 1 bowl games (without CFP First Round for selection dropdown)
export function getWeek1BowlGamesList() {
  return BOWL_GAMES_WEEK_1.filter(b => b !== 'CFP First Round')
}

// Get list of Week 2 bowl games
export function getWeek2BowlGamesList() {
  return [...BOWL_GAMES_WEEK_2]
}

// Get all bowl games (for dropdown selection, no CFP games)
export function getAllBowlGamesList() {
  return ALL_BOWL_GAMES.filter(b => !b.includes('CFP'))
}

// Check if a bowl game is in Week 1
export function isBowlInWeek1(bowlName) {
  return BOWL_GAMES_WEEK_1.some(b => b === bowlName)
}

// Check if a bowl game is in Week 2
export function isBowlInWeek2(bowlName) {
  return BOWL_GAMES_WEEK_2.some(b => b === bowlName)
}

// Get CFP First Round game name based on seed (for seeds 5-12)
export function getCFPFirstRoundGameName(seed) {
  if (seed < 5 || seed > 12) return null
  const matchup = CFP_FIRST_ROUND_MATCHUPS.find(m => m.seed1 === seed || m.seed2 === seed)
  return matchup?.game || null
}

// Get CFP Quarterfinal bowl name based on seed (for seeds 1-4 or First Round winners)
export function getCFPQuarterfinalGameName(seed, firstRoundResults = []) {
  // Seeds 1-4 have byes and play in specific bowls
  // #1 plays in Orange Bowl, #2 in Cotton Bowl, #3 in Rose Bowl, #4 in Sugar Bowl
  if (seed >= 1 && seed <= 4) {
    const bowlBySeed = {
      1: 'Orange Bowl (CFP QF)',
      2: 'Cotton Bowl (CFP QF)',
      3: 'Rose Bowl (CFP QF)',
      4: 'Sugar Bowl (CFP QF)'
    }
    return bowlBySeed[seed]
  }

  // For seeds 5-12, check if they won their First Round game
  if (seed >= 5 && seed <= 12 && firstRoundResults.length > 0) {
    // Find which QF bowl the winner of this seed's First Round game goes to
    for (const [bowlName, matchup] of Object.entries(CFP_QF_MATCHUPS)) {
      if (matchup.firstRoundSeeds.includes(seed)) {
        return bowlName
      }
    }
  }

  return null
}

// Create Bowl Week 2 sheet with CFP Quarterfinals teams pre-filled
// excludeGames: array of game names to exclude (user's QF game, user's Week 2 bowl game)
export async function createBowlWeek2Sheet(dynastyName, year, cfpSeeds = [], firstRoundResults = [], excludeGames = []) {
  try {
    const accessToken = await getAccessToken()

    // Filter out games that the user is playing in (they enter those separately)
    const bowlGames = BOWL_GAMES_WEEK_2.filter(game => !excludeGames.includes(game))
    const rowCount = bowlGames.length

    // Create the spreadsheet
    const response = await fetch(SHEETS_API_BASE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: `${dynastyName} - Bowl Week 2 ${year}`
        },
        sheets: [
          {
            properties: {
              title: 'Bowl Games',
              gridProperties: {
                rowCount: rowCount + 1,
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
      throw new Error(`Failed to create bowl week 2 sheet: ${error.error?.message || 'Unknown error'}`)
    }

    const sheet = await response.json()
    const bowlSheetId = sheet.sheets[0].properties.sheetId

    // Initialize headers and data with CFP teams pre-filled
    await initializeBowlWeek2Sheet(sheet.spreadsheetId, accessToken, bowlSheetId, bowlGames, cfpSeeds, firstRoundResults)

    // Share sheet publicly so it can be embedded in iframe
    await shareSheetPublicly(sheet.spreadsheetId, accessToken)

    return {
      spreadsheetId: sheet.spreadsheetId,
      spreadsheetUrl: sheet.spreadsheetUrl
    }
  } catch (error) {
    console.error('Error creating bowl week 2 sheet:', error)
    throw error
  }
}

// Initialize the Bowl Week 2 sheet with headers and bowl game rows
async function initializeBowlWeek2Sheet(spreadsheetId, accessToken, sheetId, bowlGames, cfpSeeds = [], firstRoundResults = []) {
  const teamAbbrs = getTeamAbbreviationsList()
  const rowCount = bowlGames.length

  // Helper to get team by seed
  const getTeamBySeed = (seed) => cfpSeeds?.find(s => s.seed === seed)?.team || ''

  // Helper to get First Round winner
  const getFirstRoundWinner = (seedA, seedB) => {
    if (!firstRoundResults || firstRoundResults.length === 0) return ''
    const game = firstRoundResults.find(g =>
      (g.seed1 === seedA && g.seed2 === seedB) ||
      (g.seed1 === seedB && g.seed2 === seedA)
    )
    return game?.winner || ''
  }

  // Build row data with teams pre-filled for CFP QF games
  // Team 1 = higher seed (1-4), Team 2 = lower seed (First Round winner)
  const rowData = bowlGames.map(bowl => {
    const matchup = CFP_QF_MATCHUPS[bowl]
    if (matchup && cfpSeeds.length > 0) {
      // This is a CFP QF game - pre-fill teams
      const [seed1, seed2] = matchup.firstRoundSeeds
      const firstRoundWinner = getFirstRoundWinner(seed1, seed2)
      const topSeedTeam = getTeamBySeed(matchup.topSeed)
      return {
        bowl,
        team1: topSeedTeam,        // Higher seed (1-4)
        team2: firstRoundWinner    // Lower seed (First Round winner)
      }
    }
    return { bowl, team1: '', team2: '' }
  })

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
            { userEnteredValue: { stringValue: 'Bowl Game' } },
            { userEnteredValue: { stringValue: 'Team 1' } },
            { userEnteredValue: { stringValue: 'Team 2' } },
            { userEnteredValue: { stringValue: 'Team 1 Score' } },
            { userEnteredValue: { stringValue: 'Team 2 Score' } }
          ]
        }],
        fields: 'userEnteredValue'
      }
    },
    // Pre-fill bowl game names and CFP QF teams
    {
      updateCells: {
        range: {
          sheetId: sheetId,
          startRowIndex: 1,
          endRowIndex: rowCount + 1,
          startColumnIndex: 0,
          endColumnIndex: 3
        },
        rows: rowData.map(row => ({
          values: [
            { userEnteredValue: { stringValue: row.bowl } },
            { userEnteredValue: { stringValue: row.team1 } },
            { userEnteredValue: { stringValue: row.team2 } }
          ]
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
    // Protect header row
    {
      addProtectedRange: {
        protectedRange: {
          range: {
            sheetId: sheetId,
            startRowIndex: 0,
            endRowIndex: 1
          },
          description: 'Header row - do not edit',
          warningOnly: true
        }
      }
    },
    // Protect bowl names column
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
          description: 'Bowl names - do not edit',
          warningOnly: true
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
        properties: { pixelSize: 180 },
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
    ...generateBowlTeamFormattingRules(sheetId, 1, rowCount),
    // Add conditional formatting for team colors (Team 2 column)
    ...generateBowlTeamFormattingRules(sheetId, 2, rowCount)
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
    console.error('Error initializing bowl week 2 sheet:', error)
    throw new Error(`Failed to initialize bowl week 2 sheet: ${error.error?.message || 'Unknown error'}`)
  }
}

// Read Bowl Week 2 Games data from sheet
export async function readBowlWeek2GamesFromSheet(spreadsheetId) {
  try {
    const accessToken = await getAccessToken()

    const rowCount = BOWL_GAMES_WEEK_2.length
    const response = await fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/Bowl Games!A2:E${rowCount + 1}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to read bowl week 2 data: ${error.error?.message || 'Unknown error'}`)
    }

    const data = await response.json()
    const rows = data.values || []

    // Parse into structured data
    const bowlGames = rows.map(row => ({
      bowlName: row[0] || '',
      team1: (row[1] || '').toUpperCase(),
      team2: (row[2] || '').toUpperCase(),
      team1Score: row[3] ? parseInt(row[3]) : null,
      team2Score: row[4] ? parseInt(row[4]) : null,
      winner: null
    })).map(game => ({
      ...game,
      winner: game.team1Score !== null && game.team2Score !== null
        ? (game.team1Score > game.team2Score ? game.team1 : game.team2)
        : null
    }))

    return bowlGames
  } catch (error) {
    console.error('Error reading bowl week 2 data:', error)
    throw error
  }
}

// ==================== CFP SHEETS ====================

// Create CFP Seeds sheet (for entering seeds 1-12)
export async function createCFPSeedsSheet(dynastyName, year) {
  try {
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
          title: `${dynastyName} - CFP Seeds ${year}`
        },
        sheets: [
          {
            properties: {
              title: 'CFP Seeds',
              gridProperties: {
                rowCount: 13,
                columnCount: 2,
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
      throw new Error(`Failed to create CFP seeds sheet: ${error.error?.message || 'Unknown error'}`)
    }

    const sheet = await response.json()
    const cfpSheetId = sheet.sheets[0].properties.sheetId

    // Initialize headers and data
    await initializeCFPSeedsSheet(sheet.spreadsheetId, accessToken, cfpSheetId)

    // Share sheet publicly so it can be embedded in iframe
    await shareSheetPublicly(sheet.spreadsheetId, accessToken)

    return {
      spreadsheetId: sheet.spreadsheetId,
      spreadsheetUrl: sheet.spreadsheetUrl
    }
  } catch (error) {
    console.error('Error creating CFP seeds sheet:', error)
    throw error
  }
}

// Initialize CFP Seeds sheet
async function initializeCFPSeedsSheet(spreadsheetId, accessToken, sheetId) {
  const teamList = getTeamAbbreviationsList()

  // Generate team color formatting rules for the Team column (column B / index 1)
  const teamFormattingRules = generateTeamFormattingRules(sheetId, 1)

  const requests = [
    // Headers
    {
      updateCells: {
        range: {
          sheetId: sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: 2
        },
        rows: [{
          values: [
            { userEnteredValue: { stringValue: 'Seed' } },
            { userEnteredValue: { stringValue: 'Team' } }
          ]
        }],
        fields: 'userEnteredValue'
      }
    },
    // Pre-fill seed numbers 1-12
    {
      updateCells: {
        range: {
          sheetId: sheetId,
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
    // Team dropdown validation (strict - only accepts values from list)
    {
      setDataValidation: {
        range: {
          sheetId: sheetId,
          startRowIndex: 1,
          endRowIndex: 13,
          startColumnIndex: 1,
          endColumnIndex: 2
        },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: teamList.map(team => ({ userEnteredValue: team }))
          },
          strict: true,
          showCustomUi: true
        }
      }
    },
    // Format all cells
    {
      repeatCell: {
        range: {
          sheetId: sheetId,
          startRowIndex: 0,
          endRowIndex: 14,
          startColumnIndex: 0,
          endColumnIndex: 2
        },
        cell: {
          userEnteredFormat: {
            textFormat: {
              fontFamily: 'Barlow',
              fontSize: 10,
              bold: true
            },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE'
          }
        },
        fields: 'userEnteredFormat(textFormat,horizontalAlignment,verticalAlignment)'
      }
    },
    // Freeze header row
    {
      updateSheetProperties: {
        properties: {
          sheetId: sheetId,
          gridProperties: {
            frozenRowCount: 1
          }
        },
        fields: 'gridProperties.frozenRowCount'
      }
    },
    // Protect header row
    {
      addProtectedRange: {
        protectedRange: {
          range: {
            sheetId: sheetId,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: 2
          },
          description: 'Header row',
          warningOnly: true
        }
      }
    },
    // Protect seed column
    {
      addProtectedRange: {
        protectedRange: {
          range: {
            sheetId: sheetId,
            startRowIndex: 1,
            endRowIndex: 13,
            startColumnIndex: 0,
            endColumnIndex: 1
          },
          description: 'Seed numbers',
          warningOnly: true
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
        properties: { pixelSize: 60 },
        fields: 'pixelSize'
      }
    },
    {
      updateDimensionProperties: {
        range: {
          sheetId: sheetId,
          dimension: 'COLUMNS',
          startIndex: 1,
          endIndex: 2
        },
        properties: { pixelSize: 150 },
        fields: 'pixelSize'
      }
    },
    // Add team color conditional formatting
    ...teamFormattingRules
  ]

  await fetch(`${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests })
  })
}

// Read CFP Seeds from sheet
export async function readCFPSeedsFromSheet(spreadsheetId) {
  try {
    const accessToken = await getAccessToken()

    const response = await fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/CFP Seeds!A2:B13`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to read CFP seeds: ${error.error?.message || 'Unknown error'}`)
    }

    const data = await response.json()
    const rows = data.values || []

    // Parse into structured data
    const seeds = rows.map(row => ({
      seed: row[0] ? parseInt(row[0]) : null,
      team: (row[1] || '').toUpperCase()
    })).filter(s => s.seed && s.team)

    return seeds
  } catch (error) {
    console.error('Error reading CFP seeds:', error)
    throw error
  }
}

// Create CFP First Round sheet (4 games - seeds 5-12 play)
export async function createCFPFirstRoundSheet(dynastyName, year) {
  try {
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
          title: `${dynastyName} - CFP First Round ${year}`
        },
        sheets: [
          {
            properties: {
              title: 'CFP First Round',
              gridProperties: {
                rowCount: 5,
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
      throw new Error(`Failed to create CFP First Round sheet: ${error.error?.message || 'Unknown error'}`)
    }

    const sheet = await response.json()
    const cfpSheetId = sheet.sheets[0].properties.sheetId

    // Initialize headers and data
    await initializeCFPFirstRoundSheet(sheet.spreadsheetId, accessToken, cfpSheetId)

    // Share sheet publicly so it can be embedded in iframe
    await shareSheetPublicly(sheet.spreadsheetId, accessToken)

    return {
      spreadsheetId: sheet.spreadsheetId,
      spreadsheetUrl: sheet.spreadsheetUrl
    }
  } catch (error) {
    console.error('Error creating CFP First Round sheet:', error)
    throw error
  }
}

// Initialize CFP First Round sheet
async function initializeCFPFirstRoundSheet(spreadsheetId, accessToken, sheetId) {
  const teamList = getTeamAbbreviationsList()

  // CFP First Round matchups (seeds play each other: 5v12, 6v11, 7v10, 8v9)
  const games = [
    'Game 1 (5 vs 12)',
    'Game 2 (6 vs 11)',
    'Game 3 (7 vs 10)',
    'Game 4 (8 vs 9)'
  ]

  const requests = [
    // Headers
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
            { userEnteredValue: { stringValue: 'Game' } },
            { userEnteredValue: { stringValue: 'Higher Seed' } },
            { userEnteredValue: { stringValue: 'Lower Seed' } },
            { userEnteredValue: { stringValue: 'Higher Score' } },
            { userEnteredValue: { stringValue: 'Lower Score' } }
          ]
        }],
        fields: 'userEnteredValue'
      }
    },
    // Pre-fill game names
    {
      updateCells: {
        range: {
          sheetId: sheetId,
          startRowIndex: 1,
          endRowIndex: 5,
          startColumnIndex: 0,
          endColumnIndex: 1
        },
        rows: games.map(game => ({
          values: [{ userEnteredValue: { stringValue: game } }]
        })),
        fields: 'userEnteredValue'
      }
    },
    // Team dropdown validation for columns B and C
    {
      setDataValidation: {
        range: {
          sheetId: sheetId,
          startRowIndex: 1,
          endRowIndex: 5,
          startColumnIndex: 1,
          endColumnIndex: 3
        },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: teamList.map(team => ({ userEnteredValue: team }))
          },
          strict: true,
          showCustomUi: true
        }
      }
    },
    // Format all cells
    {
      repeatCell: {
        range: {
          sheetId: sheetId,
          startRowIndex: 0,
          endRowIndex: 5,
          startColumnIndex: 0,
          endColumnIndex: 5
        },
        cell: {
          userEnteredFormat: {
            textFormat: {
              fontFamily: 'Barlow',
              fontSize: 10,
              bold: true,
              italic: true
            },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE'
          }
        },
        fields: 'userEnteredFormat(textFormat,horizontalAlignment,verticalAlignment)'
      }
    },
    // Protect header row
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
          description: 'Header row',
          warningOnly: true
        }
      }
    },
    // Protect game column
    {
      addProtectedRange: {
        protectedRange: {
          range: {
            sheetId: sheetId,
            startRowIndex: 1,
            endRowIndex: 5,
            startColumnIndex: 0,
            endColumnIndex: 1
          },
          description: 'Game names',
          warningOnly: true
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
        properties: { pixelSize: 120 },
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
    // Add conditional formatting for team colors (Higher Seed column - column B)
    ...generateBowlTeamFormattingRules(sheetId, 1, 4),
    // Add conditional formatting for team colors (Lower Seed column - column C)
    ...generateBowlTeamFormattingRules(sheetId, 2, 4)
  ]

  await fetch(`${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests })
  })
}

// Read CFP First Round results from sheet
export async function readCFPFirstRoundFromSheet(spreadsheetId) {
  try {
    const accessToken = await getAccessToken()

    const response = await fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/CFP First Round!A2:E5`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to read CFP First Round: ${error.error?.message || 'Unknown error'}`)
    }

    const data = await response.json()
    const rows = data.values || []

    // Parse into structured data
    const games = rows.map(row => ({
      game: row[0] || '',
      higherSeed: (row[1] || '').toUpperCase(),
      lowerSeed: (row[2] || '').toUpperCase(),
      higherSeedScore: row[3] ? parseInt(row[3]) : null,
      lowerSeedScore: row[4] ? parseInt(row[4]) : null,
      winner: null
    })).map(game => ({
      ...game,
      winner: game.higherSeedScore !== null && game.lowerSeedScore !== null
        ? (game.higherSeedScore > game.lowerSeedScore ? game.higherSeed : game.lowerSeed)
        : null
    }))

    return games
  } catch (error) {
    console.error('Error reading CFP First Round:', error)
    throw error
  }
}

// Create CFP Quarterfinals sheet with auto-filled teams
export async function createCFPQuarterfinalsSheet(dynastyName, year, cfpSeeds, firstRoundResults) {
  try {
    const accessToken = await getAccessToken()

    // Create the spreadsheet
    const response = await fetch(SHEETS_API_BASE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          title: `${dynastyName} - CFP Quarterfinals ${year}`
        },
        sheets: [
          {
            properties: {
              title: 'CFP Quarterfinals',
              gridProperties: {
                rowCount: 6,
                columnCount: 6
              }
            }
          }
        ]
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to create CFP Quarterfinals sheet: ${error.error?.message || 'Unknown error'}`)
    }

    const sheet = await response.json()
    const cfpSheetId = sheet.sheets[0].properties.sheetId

    // Initialize sheet with headers and auto-filled teams
    await initializeCFPQuarterfinalsSheet(sheet.spreadsheetId, accessToken, cfpSheetId, cfpSeeds, firstRoundResults)

    // Share sheet publicly so it can be embedded in iframe
    await shareSheetPublicly(sheet.spreadsheetId, accessToken)

    return {
      spreadsheetId: sheet.spreadsheetId,
      spreadsheetUrl: sheet.spreadsheetUrl
    }
  } catch (error) {
    console.error('Error creating CFP Quarterfinals sheet:', error)
    throw error
  }
}

// Initialize CFP Quarterfinals sheet with teams
async function initializeCFPQuarterfinalsSheet(spreadsheetId, accessToken, sheetId, cfpSeeds, firstRoundResults) {
  // Get seed teams
  const getTeamBySeed = (seed) => cfpSeeds?.find(s => s.seed === seed)?.team || ''

  // Get First Round winner by seed numbers
  const getFirstRoundWinner = (seedA, seedB) => {
    if (!firstRoundResults || firstRoundResults.length === 0) return ''
    const game = firstRoundResults.find(g =>
      (g.seed1 === seedA && g.seed2 === seedB) ||
      (g.seed1 === seedB && g.seed2 === seedA)
    )
    return game?.winner || ''
  }

  // Quarterfinal matchups with bowl games
  // Team 1 = higher seed (1-4), Team 2 = lower seed (First Round winner)
  // Sugar Bowl: #4 vs 5/12 winner
  // Orange Bowl: #1 vs 8/9 winner
  // Rose Bowl: #3 vs 6/11 winner
  // Cotton Bowl: #2 vs 7/10 winner
  const quarterfinals = [
    {
      bowl: 'Sugar Bowl',
      team1: getTeamBySeed(4),
      team2: getFirstRoundWinner(5, 12)
    },
    {
      bowl: 'Orange Bowl',
      team1: getTeamBySeed(1),
      team2: getFirstRoundWinner(8, 9)
    },
    {
      bowl: 'Rose Bowl',
      team1: getTeamBySeed(3),
      team2: getFirstRoundWinner(6, 11)
    },
    {
      bowl: 'Cotton Bowl',
      team1: getTeamBySeed(2),
      team2: getFirstRoundWinner(7, 10)
    }
  ]

  // Build the data rows
  const headers = ['Bowl Game', 'Team 1', 'Team 2', 'Team 1 Score', 'Team 2 Score', 'Winner']
  const dataRows = quarterfinals.map(qf => [qf.bowl, qf.team1, qf.team2, '', '', ''])

  // Update values
  const updateResponse = await fetch(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/CFP Quarterfinals!A1:F5?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [headers, ...dataRows]
      })
    }
  )

  if (!updateResponse.ok) {
    console.error('Failed to set CFP Quarterfinals data')
  }

  // Format the sheet
  await fetch(
    `${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: [
          // Freeze header row
          {
            updateSheetProperties: {
              properties: {
                sheetId: sheetId,
                gridProperties: { frozenRowCount: 1 }
              },
              fields: 'gridProperties.frozenRowCount'
            }
          },
          // Bold header row
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
              cell: {
                userEnteredFormat: {
                  textFormat: { bold: true },
                  backgroundColor: { red: 0.2, green: 0.2, blue: 0.2 },
                  horizontalAlignment: 'CENTER'
                }
              },
              fields: 'userEnteredFormat(textFormat,backgroundColor,horizontalAlignment)'
            }
          },
          // White text for header
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
              cell: {
                userEnteredFormat: {
                  textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } }
                }
              },
              fields: 'userEnteredFormat.textFormat'
            }
          },
          // Center all cells
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 1, endRowIndex: 5 },
              cell: {
                userEnteredFormat: { horizontalAlignment: 'CENTER' }
              },
              fields: 'userEnteredFormat.horizontalAlignment'
            }
          },
          // Auto-resize columns
          {
            autoResizeDimensions: {
              dimensions: {
                sheetId: sheetId,
                dimension: 'COLUMNS',
                startIndex: 0,
                endIndex: 6
              }
            }
          }
        ]
      })
    }
  )
}

// Read CFP Quarterfinals results from sheet
export async function readCFPQuarterfinalsFromSheet(spreadsheetId) {
  try {
    const accessToken = await getAccessToken()

    const response = await fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/CFP Quarterfinals!A2:F5`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to read CFP Quarterfinals: ${error.error?.message || 'Unknown error'}`)
    }

    const data = await response.json()
    const rows = data.values || []

    // Parse rows into games
    const games = rows.map(row => {
      const team1Score = row[3] ? parseInt(row[3]) : null
      const team2Score = row[4] ? parseInt(row[4]) : null
      let winner = row[5] || null

      // Auto-determine winner from scores if not specified
      if (!winner && team1Score !== null && team2Score !== null) {
        winner = team1Score > team2Score ? row[1] : row[2]
      }

      return {
        bowl: row[0] || '',
        team1: row[1]?.toUpperCase() || '',
        team2: row[2]?.toUpperCase() || '',
        team1Score,
        team2Score,
        winner: winner?.toUpperCase() || null
      }
    }).filter(game => game.team1 && game.team2)

    return games
  } catch (error) {
    console.error('Error reading CFP Quarterfinals:', error)
    throw error
  }
}

// ==================== CUSTOM CONFERENCES SHEET ====================

// Default EA CFB 26 conference alignment
const DEFAULT_CONFERENCES = {
  "ACC": ["BC", "CAL", "CLEM", "DUKE", "FSU", "GT", "LOU", "MIA", "NCST", "UNC", "PITT", "SMU", "SYR", "STAN", "UVA", "VT", "WAKE"],
  "American": ["ARMY", "CHAR", "ECU", "FAU", "MEM", "NAVY", "UNT", "RICE", "TULN", "TLSA", "UAB", "USF", "UTSA"],
  "Big 12": ["ARIZ", "ASU", "BU", "BYU", "UC", "COLO", "UH", "ISU", "KU", "KSU", "OKST", "TCU", "TTU", "UCF", "UTAH", "WVU"],
  "Big Ten": ["ILL", "IU", "IOWA", "UMD", "MICH", "MSU", "MINN", "NEB", "NU", "OSU", "ORE", "PSU", "PUR", "RUTG", "UCLA", "USC", "WASH", "WIS"],
  "Conference USA": ["FIU", "KENN", "LIB", "LT", "MTSU", "NMSU", "SHSU", "UTEP", "WKU"],
  "Independent": ["ND", "CONN", "MASS"],
  "MAC": ["AKR", "BALL", "BGSU", "BUFF", "CMU", "EMU", "KENT", "M-OH", "NIU", "OHIO", "TOL", "WMU"],
  "Mountain West": ["AFA", "BOIS", "CSU", "FRES", "HAW", "NEV", "SDSU", "SJSU", "UNLV", "USU", "WYO"],
  "Pac-12": ["ORST", "WSU"],
  "SEC": ["BAMA", "ARK", "AUB", "FLA", "UGA", "UK", "LSU", "MISS", "MSST", "MIZ", "OU", "SCAR", "UT", "TEX", "TAMU", "VAN"],
  "Sun Belt": ["APP", "ARST", "CCU", "GASO", "GSU", "JMU", "JKST", "ULM", "UL", "MRSH", "ODU", "USA", "TXST", "TROY"]
}

// Get default conferences
export function getDefaultConferences() {
  return DEFAULT_CONFERENCES
}

// Create Custom Conferences sheet
export async function createConferencesSheet(dynastyName, year) {
  try {
    const accessToken = await getAccessToken()

    // Sort conferences alphabetically
    const sortedConferences = Object.keys(DEFAULT_CONFERENCES).sort()
    const columnCount = sortedConferences.length

    // Find max teams in any conference (for row count)
    const maxTeams = Math.max(...Object.values(DEFAULT_CONFERENCES).map(teams => teams.length))
    const rowCount = maxTeams + 1 // +1 for header

    // Create the spreadsheet
    const response = await fetch(SHEETS_API_BASE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: `${dynastyName} - Conference Alignment ${year}`
        },
        sheets: [
          {
            properties: {
              title: 'Conferences',
              gridProperties: {
                rowCount: rowCount,
                columnCount: columnCount,
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
      throw new Error(`Failed to create conferences sheet: ${error.error?.message || 'Unknown error'}`)
    }

    const sheet = await response.json()
    const conferencesSheetId = sheet.sheets[0].properties.sheetId

    // Initialize headers and data
    await initializeConferencesSheet(sheet.spreadsheetId, accessToken, conferencesSheetId, sortedConferences, maxTeams)

    // Share sheet publicly so it can be embedded in iframe
    await shareSheetPublicly(sheet.spreadsheetId, accessToken)

    return {
      spreadsheetId: sheet.spreadsheetId,
      spreadsheetUrl: sheet.spreadsheetUrl
    }
  } catch (error) {
    console.error('Error creating conferences sheet:', error)
    throw error
  }
}

// Generate conditional formatting rules for team colors in conferences sheet
function generateConferencesTeamFormattingRules(sheetId, columnIndex, rowCount) {
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

// Initialize the Conferences sheet with headers and default team data
async function initializeConferencesSheet(spreadsheetId, accessToken, sheetId, sortedConferences, maxTeams) {
  const teamAbbrs = getTeamAbbreviationsList()

  const requests = [
    // Set conference headers
    {
      updateCells: {
        range: {
          sheetId: sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: sortedConferences.length
        },
        rows: [{
          values: sortedConferences.map(conf => ({
            userEnteredValue: { stringValue: conf }
          }))
        }],
        fields: 'userEnteredValue'
      }
    },
    // Pre-fill default teams for each conference
    ...sortedConferences.map((conf, colIndex) => {
      const teams = DEFAULT_CONFERENCES[conf]
      return {
        updateCells: {
          range: {
            sheetId: sheetId,
            startRowIndex: 1,
            endRowIndex: teams.length + 1,
            startColumnIndex: colIndex,
            endColumnIndex: colIndex + 1
          },
          rows: teams.map(team => ({
            values: [{ userEnteredValue: { stringValue: team } }]
          })),
          fields: 'userEnteredValue'
        }
      }
    }),
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
    // Bold headers with different background
    {
      repeatCell: {
        range: {
          sheetId: sheetId,
          startRowIndex: 0,
          endRowIndex: 1
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: hexToRgb('#333333'),
            textFormat: {
              foregroundColor: hexToRgb('#FFFFFF'),
              bold: true,
              fontFamily: 'Barlow',
              fontSize: 11
            }
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)'
      }
    },
    // Add STRICT team dropdown validation for all columns
    ...sortedConferences.map((conf, colIndex) => ({
      setDataValidation: {
        range: {
          sheetId: sheetId,
          startRowIndex: 1,
          endRowIndex: maxTeams + 1,
          startColumnIndex: colIndex,
          endColumnIndex: colIndex + 1
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
    })),
    // Protect header row
    {
      addProtectedRange: {
        protectedRange: {
          range: {
            sheetId: sheetId,
            startRowIndex: 0,
            endRowIndex: 1
          },
          description: 'Conference headers - do not edit',
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
          endIndex: sortedConferences.length
        },
        properties: { pixelSize: 100 },
        fields: 'pixelSize'
      }
    },
    // Add conditional formatting for team colors for each column
    ...sortedConferences.flatMap((conf, colIndex) =>
      generateConferencesTeamFormattingRules(sheetId, colIndex, maxTeams)
    )
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
    console.error('Error initializing conferences sheet:', error)
    throw new Error(`Failed to initialize conferences sheet: ${error.error?.message || 'Unknown error'}`)
  }
}

// Read conferences data from sheet
// Get all expected FBS teams from default conferences
function getAllExpectedTeams() {
  const allTeams = new Set()
  Object.values(DEFAULT_CONFERENCES).forEach(teams => {
    teams.forEach(team => allTeams.add(team))
  })
  return allTeams
}

export async function readConferencesFromSheet(spreadsheetId) {
  try {
    const accessToken = await getAccessToken()

    // Get all data from the Conferences sheet
    const response = await fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/Conferences!A1:K19`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to read conferences: ${error.error?.message || 'Unknown error'}`)
    }

    const data = await response.json()
    const rows = data.values || []

    if (rows.length === 0) return {}

    // First row is headers (conference names)
    const headers = rows[0]
    const conferences = {}

    // Build conference object
    headers.forEach((confName, colIndex) => {
      if (!confName) return

      const teams = []
      for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
        const team = rows[rowIndex]?.[colIndex]
        if (team && team.trim()) {
          teams.push(team.toUpperCase())
        }
      }
      conferences[confName] = teams
    })

    // Validation: Check for duplicates and missing teams
    const allTeamsInSheet = []
    const teamToConference = {}

    Object.entries(conferences).forEach(([confName, teams]) => {
      teams.forEach(team => {
        allTeamsInSheet.push(team)
        if (teamToConference[team]) {
          teamToConference[team].push(confName)
        } else {
          teamToConference[team] = [confName]
        }
      })
    })

    // Check for duplicates
    const duplicates = Object.entries(teamToConference)
      .filter(([team, confs]) => confs.length > 1)
      .map(([team, confs]) => `${team} (in ${confs.join(', ')})`)

    if (duplicates.length > 0) {
      throw new Error(`Duplicate teams found: ${duplicates.join('; ')}. Each team can only be in one conference.`)
    }

    // Check for missing teams
    const expectedTeams = getAllExpectedTeams()
    const teamsInSheet = new Set(allTeamsInSheet)
    const missingTeams = [...expectedTeams].filter(team => !teamsInSheet.has(team))

    if (missingTeams.length > 0) {
      throw new Error(`Missing teams: ${missingTeams.join(', ')}. All FBS teams must be assigned to a conference.`)
    }

    return conferences
  } catch (error) {
    console.error('Error reading conferences:', error)
    throw error
  }
}

// ============================================
// STATS ENTRY SHEET
// ============================================

/**
 * Create a Stats Entry sheet for end of season player statistics
 * Columns: Player, Position, Class, Dev Trait, Overall Rating (before game one), Games Played, Snaps Played
 * Pre-fills player info from roster data
 */
export async function createStatsEntrySheet(dynastyName, year, players = []) {
  try {
    const user = auth.currentUser
    if (!user) throw new Error('User not authenticated')

    const accessToken = await getAccessToken()

    // Create the spreadsheet with Stats tab
    const response = await fetch(SHEETS_API_BASE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: `${dynastyName} Dynasty - ${year} Season Stats`
        },
        sheets: [
          {
            properties: {
              title: 'Player Stats',
              gridProperties: {
                rowCount: Math.max(players.length + 1, 86),
                columnCount: 8, // PID + Player + Position + Class + Dev Trait + Overall + GP + Snaps
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
    const statsSheetId = sheet.sheets[0].properties.sheetId

    // Initialize headers and pre-fill player data
    await initializeStatsEntrySheet(sheet.spreadsheetId, accessToken, statsSheetId, players)

    // Share sheet publicly so it can be embedded in iframe
    await shareSheetPublicly(sheet.spreadsheetId, accessToken)

    return {
      spreadsheetId: sheet.spreadsheetId,
      spreadsheetUrl: sheet.spreadsheetUrl
    }
  } catch (error) {
    console.error('Error creating stats entry sheet:', error)
    throw error
  }
}

// Initialize the Stats Entry sheet with headers and player data
async function initializeStatsEntrySheet(spreadsheetId, accessToken, sheetId, players) {
  const requests = [
    // Set headers
    {
      updateCells: {
        range: {
          sheetId: sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: 8
        },
        rows: [{
          values: [
            { userEnteredValue: { stringValue: 'PID' } },
            { userEnteredValue: { stringValue: 'Player' } },
            { userEnteredValue: { stringValue: 'Position' } },
            { userEnteredValue: { stringValue: 'Class' } },
            { userEnteredValue: { stringValue: 'Dev Trait' } },
            { userEnteredValue: { stringValue: 'Overall Rating\n(before game one)' } },
            { userEnteredValue: { stringValue: 'Games Played' } },
            { userEnteredValue: { stringValue: 'Snaps Played' } }
          ]
        }],
        fields: 'userEnteredValue'
      }
    },
    // Bold and center headers
    {
      repeatCell: {
        range: {
          sheetId: sheetId,
          startRowIndex: 0,
          endRowIndex: 1
        },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            wrapStrategy: 'WRAP'
          }
        },
        fields: 'userEnteredFormat(textFormat.bold,horizontalAlignment,verticalAlignment,wrapStrategy)'
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
        properties: { pixelSize: 50 }, // PID column
        fields: 'pixelSize'
      }
    },
    {
      updateDimensionProperties: {
        range: {
          sheetId: sheetId,
          dimension: 'COLUMNS',
          startIndex: 1,
          endIndex: 2
        },
        properties: { pixelSize: 180 }, // Player name
        fields: 'pixelSize'
      }
    },
    {
      updateDimensionProperties: {
        range: {
          sheetId: sheetId,
          dimension: 'COLUMNS',
          startIndex: 2,
          endIndex: 3
        },
        properties: { pixelSize: 80 }, // Position
        fields: 'pixelSize'
      }
    },
    {
      updateDimensionProperties: {
        range: {
          sheetId: sheetId,
          dimension: 'COLUMNS',
          startIndex: 3,
          endIndex: 4
        },
        properties: { pixelSize: 70 }, // Class
        fields: 'pixelSize'
      }
    },
    {
      updateDimensionProperties: {
        range: {
          sheetId: sheetId,
          dimension: 'COLUMNS',
          startIndex: 4,
          endIndex: 5
        },
        properties: { pixelSize: 80 }, // Dev Trait
        fields: 'pixelSize'
      }
    },
    {
      updateDimensionProperties: {
        range: {
          sheetId: sheetId,
          dimension: 'COLUMNS',
          startIndex: 5,
          endIndex: 6
        },
        properties: { pixelSize: 100 }, // Overall Rating
        fields: 'pixelSize'
      }
    },
    {
      updateDimensionProperties: {
        range: {
          sheetId: sheetId,
          dimension: 'COLUMNS',
          startIndex: 6,
          endIndex: 8
        },
        properties: { pixelSize: 90 }, // GP, Snaps
        fields: 'pixelSize'
      }
    },
    // Protect header row
    {
      addProtectedRange: {
        protectedRange: {
          range: {
            sheetId: sheetId,
            startRowIndex: 0,
            endRowIndex: 1
          },
          description: 'Protected header row',
          warningOnly: false
        }
      }
    },
    // Protect columns A-F (pre-filled data: PID, Player, Position, Class, Dev Trait, Overall)
    {
      addProtectedRange: {
        protectedRange: {
          range: {
            sheetId: sheetId,
            startRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: 6
          },
          description: 'Protected player info columns',
          warningOnly: false
        }
      }
    }
  ]

  // Pre-fill player data if available
  if (players.length > 0) {
    // Sort players by position order and then by overall rating
    const positionOrder = ['QB', 'HB', 'FB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT', 'LEDG', 'REDG', 'DT', 'SAM', 'MIKE', 'WILL', 'CB', 'FS', 'SS', 'K', 'P']
    const sortedPlayers = [...players].sort((a, b) => {
      const posA = positionOrder.indexOf(a.position) !== -1 ? positionOrder.indexOf(a.position) : 999
      const posB = positionOrder.indexOf(b.position) !== -1 ? positionOrder.indexOf(b.position) : 999
      if (posA !== posB) return posA - posB
      return (b.overall || 0) - (a.overall || 0)
    })

    requests.push({
      updateCells: {
        range: {
          sheetId: sheetId,
          startRowIndex: 1,
          endRowIndex: sortedPlayers.length + 1,
          startColumnIndex: 0,
          endColumnIndex: 8
        },
        rows: sortedPlayers.map(player => ({
          values: [
            { userEnteredValue: { numberValue: player.pid || 0 } },
            { userEnteredValue: { stringValue: player.name || '' } },
            { userEnteredValue: { stringValue: player.position || '' } },
            { userEnteredValue: { stringValue: player.year || '' } },
            { userEnteredValue: { stringValue: player.devTrait || '' } },
            { userEnteredValue: { numberValue: player.overall || 0 } },
            // Pre-fill existing gamesPlayed/snapsPlayed (overrides previous data when resubmitted)
            { userEnteredValue: { numberValue: player.gamesPlayed || 0 } },
            { userEnteredValue: { numberValue: player.snapsPlayed || 0 } }
          ]
        })),
        fields: 'userEnteredValue'
      }
    })

    // Center all data cells (columns B-I, skipping PID column A which is already numeric)
    requests.push({
      repeatCell: {
        range: {
          sheetId: sheetId,
          startRowIndex: 1,
          endRowIndex: sortedPlayers.length + 1,
          startColumnIndex: 1,
          endColumnIndex: 9
        },
        cell: {
          userEnteredFormat: {
            horizontalAlignment: 'CENTER'
          }
        },
        fields: 'userEnteredFormat.horizontalAlignment'
      }
    })

    // Add auto-filter to header row
    requests.push({
      setBasicFilter: {
        filter: {
          range: {
            sheetId: sheetId,
            startRowIndex: 0,
            endRowIndex: sortedPlayers.length + 1,
            startColumnIndex: 0,
            endColumnIndex: 9
          }
        }
      }
    })
  }

  // Execute all requests
  const batchResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests })
    }
  )

  if (!batchResponse.ok) {
    const error = await batchResponse.json()
    console.error('Error initializing stats sheet:', error)
    throw new Error(`Failed to initialize sheet: ${error.error?.message || 'Unknown error'}`)
  }
}

/**
 * Read stats data from the stats entry sheet
 */
export async function readStatsFromSheet(spreadsheetId) {
  try {
    const accessToken = await getAccessToken()

    // Read all data from the Player Stats sheet (A-H: PID, Player, Position, Class, Dev Trait, Overall, GP, Snaps)
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Player Stats'!A2:H200`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to read stats: ${error.error?.message || 'Unknown error'}`)
    }

    const data = await response.json()
    const rows = data.values || []

    return rows.map(row => ({
      pid: parseInt(row[0]) || 0,
      name: row[1] || '',
      position: row[2] || '',
      year: row[3] || '',
      devTrait: row[4] || '',
      overall: parseInt(row[5]) || 0,
      gamesPlayed: parseInt(row[6]) || 0,
      snapsPlayed: parseInt(row[7]) || 0
    })).filter(player => player.pid > 0) // Filter by PID instead of name for robustness
  } catch (error) {
    console.error('Error reading stats from sheet:', error)
    throw error
  }
}

// ============================================
// DETAILED STATS SHEET (9 TABS)
// ============================================

// Define columns for each stat category
const DETAILED_STATS_TABS = {
  'Passing': [
    'Completions', 'Attempts', 'Yards', 'Touchdowns', 'Interceptions',
    'Net Yards/Attempt', 'Adjusted Net Yards/Attempt', 'Passing Long', 'Sacks Taken'
  ],
  'Rushing': [
    'Carries', 'Yards', 'Touchdowns', '20+ Yard Runs', 'Broken Tackles',
    'Yards After Contact', 'Rushing Long', 'Fumbles'
  ],
  'Receiving': [
    'Receptions', 'Yards', 'Touchdowns', 'Receiving Long', 'Run After Catch', 'Drops'
  ],
  'Blocking': [
    'Sacks Allowed'
  ],
  'Defensive': [
    'Solo Tackles', 'Assisted Tackles', 'Tackles for Loss', 'Sacks', 'Interceptions',
    'INT Return Yards', 'INT Long', 'Defensive TDs', 'Deflections', 'Catches Allowed',
    'Forced Fumbles', 'Fumble Recoveries', 'Fumble Return Yards', 'Blocks', 'Safeties'
  ],
  'Kicking': [
    'FG Made', 'FG Attempted', 'FG Long', 'XP Made', 'XP Attempted',
    'FG Made (0-29)', 'FG Att (0-29)', 'FG Made (30-39)', 'FG Att (30-39)',
    'FG Made (40-49)', 'FG Att (40-49)', 'FG Made (50+)', 'FG Att (50+)',
    'Kickoffs', 'Touchbacks', 'FG Blocked', 'XP Blocked'
  ],
  'Punting': [
    'Punts', 'Punting Yards', 'Net Punting Yards', 'Punts Inside 20',
    'Touchbacks', 'Punt Long', 'Punts Blocked'
  ],
  'Kick Return': [
    'Kickoff Returns', 'KR Yardage', 'KR Touchdowns', 'KR Long'
  ],
  'Punt Return': [
    'Punt Returns', 'PR Yardage', 'PR Touchdowns', 'PR Long'
  ]
}

/**
 * Create a Detailed Stats sheet with 9 tabs for all football statistics
 * Each tab has: Name, Snaps Played (pre-filled), then stat-specific columns
 */
export async function createDetailedStatsSheet(dynastyName, year, playerStats = []) {
  try {
    const user = auth.currentUser
    if (!user) throw new Error('User not authenticated')

    const accessToken = await getAccessToken()

    const tabNames = Object.keys(DETAILED_STATS_TABS)
    const rowCount = Math.max(playerStats.length + 1, 86)

    // Create the spreadsheet with all 9 tabs
    const response = await fetch(SHEETS_API_BASE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: `${dynastyName} Dynasty - ${year} Detailed Stats`
        },
        sheets: tabNames.map((tabName, index) => ({
          properties: {
            title: tabName,
            index: index,
            gridProperties: {
              rowCount: rowCount,
              columnCount: DETAILED_STATS_TABS[tabName].length + 4, // +4 for PID, Name, Position, and Snaps
              frozenRowCount: 1
            }
          }
        }))
      })
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('Sheets API error:', error)
      throw new Error(`Failed to create sheet: ${error.error?.message || 'Unknown error'}`)
    }

    const sheet = await response.json()

    // Initialize each tab with headers and player data
    for (let i = 0; i < tabNames.length; i++) {
      const tabName = tabNames[i]
      const sheetId = sheet.sheets[i].properties.sheetId
      await initializeDetailedStatsTab(sheet.spreadsheetId, accessToken, sheetId, tabName, playerStats)
    }

    // Share sheet publicly so it can be embedded in iframe
    await shareSheetPublicly(sheet.spreadsheetId, accessToken)

    return {
      spreadsheetId: sheet.spreadsheetId,
      spreadsheetUrl: sheet.spreadsheetUrl
    }
  } catch (error) {
    console.error('Error creating detailed stats sheet:', error)
    throw error
  }
}

// Position filters for each detailed stats tab
const TAB_POSITION_FILTERS = {
  'Passing': ['QB'],
  'Rushing': ['QB', 'HB', 'FB', 'WR', 'TE'],
  'Receiving': ['HB', 'FB', 'WR', 'TE'],
  'Blocking': ['LT', 'LG', 'C', 'RG', 'RT'],
  'Defensive': ['LEDG', 'REDG', 'DT', 'SAM', 'MIKE', 'WILL', 'CB', 'FS', 'SS'],
  'Kicking': ['K', 'P'],
  'Punting': ['K', 'P'],
  'Kick Return': ['HB', 'FB', 'WR', 'CB', 'FS', 'SS'],
  'Punt Return': ['HB', 'FB', 'WR', 'CB', 'FS', 'SS']
}

// Initialize a single tab of the detailed stats sheet
async function initializeDetailedStatsTab(spreadsheetId, accessToken, sheetId, tabName, playerStats) {
  const statColumns = DETAILED_STATS_TABS[tabName]
  const totalColumns = statColumns.length + 4 // PID + Name + Position + Snaps + stat columns

  // Filter players by positions relevant to this tab
  const allowedPositions = TAB_POSITION_FILTERS[tabName] || []
  const filteredPlayers = playerStats.filter(p => allowedPositions.includes(p.position))

  // Sort by snaps played (highest to lowest)
  const sortedPlayers = [...filteredPlayers].sort((a, b) => {
    return (b.snapsPlayed || 0) - (a.snapsPlayed || 0)
  })

  const requests = [
    // Set headers
    {
      updateCells: {
        range: {
          sheetId: sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: totalColumns
        },
        rows: [{
          values: [
            { userEnteredValue: { stringValue: 'PID' } },
            { userEnteredValue: { stringValue: 'Name' } },
            { userEnteredValue: { stringValue: 'Pos' } },
            { userEnteredValue: { stringValue: 'Snaps' } },
            ...statColumns.map(col => ({ userEnteredValue: { stringValue: col } }))
          ]
        }],
        fields: 'userEnteredValue'
      }
    },
    // Bold and center headers
    {
      repeatCell: {
        range: {
          sheetId: sheetId,
          startRowIndex: 0,
          endRowIndex: 1
        },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            wrapStrategy: 'WRAP'
          }
        },
        fields: 'userEnteredFormat(textFormat.bold,horizontalAlignment,verticalAlignment,wrapStrategy)'
      }
    },
    // Set PID column width
    {
      updateDimensionProperties: {
        range: {
          sheetId: sheetId,
          dimension: 'COLUMNS',
          startIndex: 0,
          endIndex: 1
        },
        properties: { pixelSize: 50 },
        fields: 'pixelSize'
      }
    },
    // Set Name column width
    {
      updateDimensionProperties: {
        range: {
          sheetId: sheetId,
          dimension: 'COLUMNS',
          startIndex: 1,
          endIndex: 2
        },
        properties: { pixelSize: 180 },
        fields: 'pixelSize'
      }
    },
    // Set Position column width
    {
      updateDimensionProperties: {
        range: {
          sheetId: sheetId,
          dimension: 'COLUMNS',
          startIndex: 2,
          endIndex: 3
        },
        properties: { pixelSize: 50 },
        fields: 'pixelSize'
      }
    },
    // Set Snaps column width
    {
      updateDimensionProperties: {
        range: {
          sheetId: sheetId,
          dimension: 'COLUMNS',
          startIndex: 3,
          endIndex: 4
        },
        properties: { pixelSize: 60 },
        fields: 'pixelSize'
      }
    },
    // Set stat columns width
    {
      updateDimensionProperties: {
        range: {
          sheetId: sheetId,
          dimension: 'COLUMNS',
          startIndex: 4,
          endIndex: totalColumns
        },
        properties: { pixelSize: 85 },
        fields: 'pixelSize'
      }
    },
    // Protect header row
    {
      addProtectedRange: {
        protectedRange: {
          range: {
            sheetId: sheetId,
            startRowIndex: 0,
            endRowIndex: 1
          },
          description: 'Protected header row',
          warningOnly: false
        }
      }
    },
    // Protect PID, Name, Position and Snaps columns (pre-filled data)
    {
      addProtectedRange: {
        protectedRange: {
          range: {
            sheetId: sheetId,
            startRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: 4
          },
          description: 'Protected player info columns',
          warningOnly: false
        }
      }
    }
  ]

  // Pre-fill player data if available
  if (sortedPlayers.length > 0) {
    requests.push({
      updateCells: {
        range: {
          sheetId: sheetId,
          startRowIndex: 1,
          endRowIndex: sortedPlayers.length + 1,
          startColumnIndex: 0,
          endColumnIndex: 4
        },
        rows: sortedPlayers.map(player => ({
          values: [
            { userEnteredValue: { numberValue: player.pid || 0 } },
            { userEnteredValue: { stringValue: player.name || '' } },
            { userEnteredValue: { stringValue: player.position || '' } },
            { userEnteredValue: { numberValue: player.snapsPlayed || 0 } }
          ]
        })),
        fields: 'userEnteredValue'
      }
    })

    // Center all data cells (except Name column)
    requests.push({
      repeatCell: {
        range: {
          sheetId: sheetId,
          startRowIndex: 1,
          endRowIndex: sortedPlayers.length + 1,
          startColumnIndex: 0,
          endColumnIndex: 1
        },
        cell: {
          userEnteredFormat: {
            horizontalAlignment: 'CENTER'
          }
        },
        fields: 'userEnteredFormat.horizontalAlignment'
      }
    })

    // Center Position, Snaps and stat columns
    requests.push({
      repeatCell: {
        range: {
          sheetId: sheetId,
          startRowIndex: 1,
          endRowIndex: sortedPlayers.length + 1,
          startColumnIndex: 2,
          endColumnIndex: totalColumns
        },
        cell: {
          userEnteredFormat: {
            horizontalAlignment: 'CENTER'
          }
        },
        fields: 'userEnteredFormat.horizontalAlignment'
      }
    })

    // Add auto-filter to header row
    requests.push({
      setBasicFilter: {
        filter: {
          range: {
            sheetId: sheetId,
            startRowIndex: 0,
            endRowIndex: sortedPlayers.length + 1,
            startColumnIndex: 0,
            endColumnIndex: totalColumns
          }
        }
      }
    })
  }

  // Execute all requests
  const batchResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests })
    }
  )

  if (!batchResponse.ok) {
    const error = await batchResponse.json()
    console.error(`Error initializing ${tabName} tab:`, error)
    throw new Error(`Failed to initialize ${tabName} tab: ${error.error?.message || 'Unknown error'}`)
  }
}

/**
 * Read detailed stats data from all tabs
 */
export async function readDetailedStatsFromSheet(spreadsheetId) {
  try {
    const accessToken = await getAccessToken()
    const result = {}

    for (const tabName of Object.keys(DETAILED_STATS_TABS)) {
      const statColumns = DETAILED_STATS_TABS[tabName]
      const lastColumn = String.fromCharCode(65 + statColumns.length + 3) // A=65, +4 for PID/Name/Pos/Snaps

      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodeURIComponent(tabName)}'!A2:${lastColumn}200`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      )

      if (!response.ok) {
        const error = await response.json()
        console.error(`Failed to read ${tabName}:`, error)
        continue
      }

      const data = await response.json()
      const rows = data.values || []

      result[tabName] = rows.map(row => {
        const player = {
          pid: parseInt(row[0]) || 0,
          name: row[1] || '',
          position: row[2] || '',
          snapsPlayed: parseInt(row[3]) || 0
        }
        // Map stat columns (starting at column index 4)
        statColumns.forEach((col, i) => {
          const value = row[i + 4]
          // Try to parse as number, otherwise keep as string
          player[col] = value !== undefined && value !== '' ? (isNaN(parseFloat(value)) ? value : parseFloat(value)) : null
        })
        return player
      }).filter(player => player.pid > 0) // Filter out empty rows (check for valid PID)
    }

    return result
  } catch (error) {
    console.error('Error reading detailed stats from sheet:', error)
    throw error
  }
}

// Conference order for standings sheet
const CONFERENCE_ORDER = [
  'ACC', 'American', 'Big 12', 'Big Ten', 'C-USA', 'MAC', 'MWC', 'Pac-12', 'SEC', 'Sun Belt'
]

const TEAMS_PER_CONFERENCE = 20

/**
 * Create a Google Sheet for conference standings entry
 * All conferences stacked with 20 team slots each
 */
export async function createConferenceStandingsSheet(year) {
  try {
    const accessToken = await getAccessToken()

    // Calculate total rows: header row + (20 teams * 10 conferences) + 9 spacer rows between conferences
    const totalTeamRows = CONFERENCE_ORDER.length * TEAMS_PER_CONFERENCE
    const spacerRows = CONFERENCE_ORDER.length - 1
    const totalRows = 1 + totalTeamRows + spacerRows // 1 header + 200 team rows + 9 spacers = 210

    // Create spreadsheet
    const createResponse = await fetch(SHEETS_API_BASE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: `${year} Conference Standings`
        },
        sheets: [{
          properties: {
            title: 'Standings',
            gridProperties: {
              rowCount: totalRows + 10, // Extra padding
              columnCount: 7,
              frozenRowCount: 1
            }
          }
        }]
      })
    })

    if (!createResponse.ok) {
      const error = await createResponse.json()
      throw new Error(`Failed to create sheet: ${error.error?.message || 'Unknown error'}`)
    }

    const spreadsheet = await createResponse.json()
    const spreadsheetId = spreadsheet.spreadsheetId
    const sheetId = spreadsheet.sheets[0].properties.sheetId

    // Share publicly for embedding
    await shareSheetPublicly(spreadsheetId, accessToken)

    // Build requests for formatting and data
    const requests = []

    // Column headers
    const headers = ['Conference', 'Conf. Rank', 'Team', 'Wins', 'Losses', 'Points For', 'Points Against']

    // Set header row
    requests.push({
      updateCells: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: 7
        },
        rows: [{
          values: headers.map(h => ({
            userEnteredValue: { stringValue: h },
            userEnteredFormat: {
              backgroundColor: { red: 0.2, green: 0.2, blue: 0.2 },
              textFormat: {
                bold: true,
                foregroundColor: { red: 1, green: 1, blue: 1 },
                fontSize: 10
              },
              horizontalAlignment: 'CENTER',
              verticalAlignment: 'MIDDLE'
            }
          }))
        }],
        fields: 'userEnteredValue,userEnteredFormat'
      }
    })

    // Protect header row
    requests.push({
      addProtectedRange: {
        protectedRange: {
          range: {
            sheetId,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: 7
          },
          description: 'Header row - do not edit',
          warningOnly: true
        }
      }
    })

    // Pre-fill conference names and rank numbers for each conference section
    let currentRow = 1 // Start after header
    const cellUpdates = []

    CONFERENCE_ORDER.forEach((conference, confIndex) => {
      // Pre-fill 20 rows for this conference
      for (let teamRank = 1; teamRank <= TEAMS_PER_CONFERENCE; teamRank++) {
        cellUpdates.push({
          range: {
            sheetId,
            startRowIndex: currentRow,
            endRowIndex: currentRow + 1,
            startColumnIndex: 0,
            endColumnIndex: 2
          },
          rows: [{
            values: [
              {
                userEnteredValue: { stringValue: conference },
                userEnteredFormat: {
                  backgroundColor: { red: 0.95, green: 0.95, blue: 0.95 },
                  textFormat: { bold: true, fontSize: 10 },
                  horizontalAlignment: 'CENTER'
                }
              },
              {
                userEnteredValue: { numberValue: teamRank },
                userEnteredFormat: {
                  backgroundColor: { red: 0.95, green: 0.95, blue: 0.95 },
                  textFormat: { fontSize: 10 },
                  horizontalAlignment: 'CENTER'
                }
              }
            ]
          }],
          fields: 'userEnteredValue,userEnteredFormat'
        })
        currentRow++
      }

      // Add a spacer row between conferences (except after the last one)
      if (confIndex < CONFERENCE_ORDER.length - 1) {
        cellUpdates.push({
          range: {
            sheetId,
            startRowIndex: currentRow,
            endRowIndex: currentRow + 1,
            startColumnIndex: 0,
            endColumnIndex: 7
          },
          rows: [{
            values: Array(7).fill({
              userEnteredFormat: {
                backgroundColor: { red: 0.3, green: 0.3, blue: 0.3 }
              }
            })
          }],
          fields: 'userEnteredFormat'
        })
        currentRow++
      }
    })

    // Add cell updates in batches to avoid hitting API limits
    const batchSize = 50
    for (let i = 0; i < cellUpdates.length; i += batchSize) {
      const batch = cellUpdates.slice(i, i + batchSize)
      requests.push(...batch.map(update => ({ updateCells: update })))
    }

    // Set column widths
    const columnWidths = [100, 80, 200, 60, 60, 90, 110]
    columnWidths.forEach((width, index) => {
      requests.push({
        updateDimensionProperties: {
          range: {
            sheetId,
            dimension: 'COLUMNS',
            startIndex: index,
            endIndex: index + 1
          },
          properties: { pixelSize: width },
          fields: 'pixelSize'
        }
      })
    })

    // Center align all data cells
    requests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 1,
          endRowIndex: totalRows,
          startColumnIndex: 2,
          endColumnIndex: 7
        },
        cell: {
          userEnteredFormat: {
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE'
          }
        },
        fields: 'userEnteredFormat.horizontalAlignment,userEnteredFormat.verticalAlignment'
      }
    })

    // Add team dropdown validation for Team column (column C, index 2)
    requests.push(generateTeamValidation(sheetId, 2, 1, totalRows))

    // Add conditional formatting for team colors in Team column
    requests.push(...generateTeamFormattingRulesForRange(sheetId, 2, 1, totalRows))

    // Execute all requests
    const batchResponse = await fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests })
      }
    )

    if (!batchResponse.ok) {
      const error = await batchResponse.json()
      console.error('Error setting up conference standings sheet:', error)
      throw new Error(`Failed to setup sheet: ${error.error?.message || 'Unknown error'}`)
    }

    return {
      sheetId: spreadsheetId,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
    }
  } catch (error) {
    console.error('Error creating conference standings sheet:', error)
    throw error
  }
}

/**
 * Read conference standings from Google Sheet
 */
export async function readConferenceStandingsFromSheet(spreadsheetId) {
  try {
    const accessToken = await getAccessToken()

    // Read all data from the Standings tab
    const response = await fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/Standings!A2:G250`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to read standings: ${error.error?.message || 'Unknown error'}`)
    }

    const data = await response.json()
    const rows = data.values || []

    // Parse rows into standings by conference
    const standings = {}

    rows.forEach(row => {
      const conference = row[0]?.trim()
      const rank = parseInt(row[1]) || 0
      const team = row[2]?.trim().toUpperCase() // Normalize to uppercase abbreviation
      const wins = parseInt(row[3]) || 0
      const losses = parseInt(row[4]) || 0
      const pointsFor = parseInt(row[5]) || 0
      const pointsAgainst = parseInt(row[6]) || 0

      // Skip empty rows, spacer rows, or rows without a team
      if (!conference || !team || team === '') return

      if (!standings[conference]) {
        standings[conference] = []
      }

      standings[conference].push({
        rank,
        team,
        wins,
        losses,
        pointsFor,
        pointsAgainst
      })
    })

    // Sort each conference by rank
    Object.keys(standings).forEach(conf => {
      standings[conf].sort((a, b) => a.rank - b.rank)
    })

    return standings
  } catch (error) {
    console.error('Error reading conference standings:', error)
    throw error
  }
}

/**
 * Create a Google Sheet for final Top 25 polls entry
 * Three columns: # | Media | Coaches with 25 rows
 */
export async function createFinalPollsSheet(year) {
  try {
    const accessToken = await getAccessToken()

    // Create spreadsheet with 26 rows (1 header + 25 teams)
    const createResponse = await fetch(SHEETS_API_BASE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: `${year} Final Top 25 Polls`
        },
        sheets: [{
          properties: {
            title: 'Polls',
            gridProperties: {
              rowCount: 26,
              columnCount: 3,
              frozenRowCount: 1
            }
          }
        }]
      })
    })

    if (!createResponse.ok) {
      const error = await createResponse.json()
      throw new Error(`Failed to create sheet: ${error.error?.message || 'Unknown error'}`)
    }

    const spreadsheet = await createResponse.json()
    const spreadsheetId = spreadsheet.spreadsheetId
    const sheetId = spreadsheet.sheets[0].properties.sheetId

    // Share publicly for embedding
    await shareSheetPublicly(spreadsheetId, accessToken)

    // Build requests for formatting and data
    const requests = []

    // Column headers
    const headers = ['#', 'Media', 'Coaches']

    // Set header row
    requests.push({
      updateCells: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: 3
        },
        rows: [{
          values: headers.map(h => ({
            userEnteredValue: { stringValue: h },
            userEnteredFormat: {
              backgroundColor: { red: 0.2, green: 0.2, blue: 0.2 },
              textFormat: {
                bold: true,
                foregroundColor: { red: 1, green: 1, blue: 1 },
                fontSize: 11
              },
              horizontalAlignment: 'CENTER',
              verticalAlignment: 'MIDDLE'
            }
          }))
        }],
        fields: 'userEnteredValue,userEnteredFormat'
      }
    })

    // Protect header row
    requests.push({
      addProtectedRange: {
        protectedRange: {
          range: {
            sheetId,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: 3
          },
          description: 'Header row - do not edit',
          warningOnly: true
        }
      }
    })

    // Pre-fill rank numbers 1-25
    const rankRows = []
    for (let rank = 1; rank <= 25; rank++) {
      rankRows.push({
        values: [{
          userEnteredValue: { numberValue: rank },
          userEnteredFormat: {
            backgroundColor: { red: 0.95, green: 0.95, blue: 0.95 },
            textFormat: { bold: true, fontSize: 11 },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE'
          }
        }]
      })
    }

    requests.push({
      updateCells: {
        range: {
          sheetId,
          startRowIndex: 1,
          endRowIndex: 26,
          startColumnIndex: 0,
          endColumnIndex: 1
        },
        rows: rankRows,
        fields: 'userEnteredValue,userEnteredFormat'
      }
    })

    // Set column widths
    const columnWidths = [50, 150, 150]
    columnWidths.forEach((width, index) => {
      requests.push({
        updateDimensionProperties: {
          range: {
            sheetId,
            dimension: 'COLUMNS',
            startIndex: index,
            endIndex: index + 1
          },
          properties: { pixelSize: width },
          fields: 'pixelSize'
        }
      })
    })

    // Set row height for all rows
    requests.push({
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: 'ROWS',
          startIndex: 0,
          endIndex: 26
        },
        properties: { pixelSize: 30 },
        fields: 'pixelSize'
      }
    })

    // Center align team columns
    requests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 1,
          endRowIndex: 26,
          startColumnIndex: 1,
          endColumnIndex: 3
        },
        cell: {
          userEnteredFormat: {
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            textFormat: { fontSize: 11 }
          }
        },
        fields: 'userEnteredFormat.horizontalAlignment,userEnteredFormat.verticalAlignment,userEnteredFormat.textFormat.fontSize'
      }
    })

    // Add team dropdown validation for Media column (column B, index 1)
    requests.push(generateTeamValidation(sheetId, 1, 1, 26))

    // Add team dropdown validation for Coaches column (column C, index 2)
    requests.push(generateTeamValidation(sheetId, 2, 1, 26))

    // Add conditional formatting for team colors in Media column
    requests.push(...generateTeamFormattingRulesForRange(sheetId, 1, 1, 26))

    // Add conditional formatting for team colors in Coaches column
    requests.push(...generateTeamFormattingRulesForRange(sheetId, 2, 1, 26))

    // Execute all requests
    const batchResponse = await fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests })
      }
    )

    if (!batchResponse.ok) {
      const error = await batchResponse.json()
      console.error('Error setting up final polls sheet:', error)
      throw new Error(`Failed to setup sheet: ${error.error?.message || 'Unknown error'}`)
    }

    return {
      sheetId: spreadsheetId,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
    }
  } catch (error) {
    console.error('Error creating final polls sheet:', error)
    throw error
  }
}

/**
 * Read final polls from Google Sheet
 */
export async function readFinalPollsFromSheet(spreadsheetId) {
  try {
    const accessToken = await getAccessToken()

    // Read all data from the Polls tab
    const response = await fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/Polls!A2:C26`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to read polls: ${error.error?.message || 'Unknown error'}`)
    }

    const data = await response.json()
    const rows = data.values || []

    // Parse rows into media and coaches polls
    const media = []
    const coaches = []

    rows.forEach(row => {
      const rank = parseInt(row[0]) || 0
      const mediaTeam = row[1]?.trim().toUpperCase() || ''
      const coachesTeam = row[2]?.trim().toUpperCase() || ''

      if (rank >= 1 && rank <= 25) {
        if (mediaTeam) {
          media.push({ rank, team: mediaTeam })
        }
        if (coachesTeam) {
          coaches.push({ rank, team: coachesTeam })
        }
      }
    })

    // Sort by rank
    media.sort((a, b) => a.rank - b.rank)
    coaches.sort((a, b) => a.rank - b.rank)

    return { media, coaches }
  } catch (error) {
    console.error('Error reading final polls:', error)
    throw error
  }
}

// Team stats columns
const TEAM_STATS_COLUMNS = [
  'First Downs',
  'Rush Yards Allowed',
  'Pass Yards Allowed',
  'Red Zone Attempts',
  'Red Zone TDs',
  'Def. RZ Attempts',
  'Def. RZ TDs',
  '3rd Down Conversions',
  '3rd Down Attempts',
  '4th Down Conversions',
  '4th Down Attempts',
  '2pt Conversions',
  '2pt Attempts',
  'Penalties',
  'Penalty Yardage'
]

/**
 * Create a Google Sheet for team stats entry
 * Vertical two-column layout: Column A = stat names, Column B = values
 */
export async function createTeamStatsSheet(year, teamName) {
  try {
    const accessToken = await getAccessToken()

    const numStats = TEAM_STATS_COLUMNS.length

    // Create spreadsheet with 2 columns and rows for each stat
    const createResponse = await fetch(SHEETS_API_BASE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: `${year} ${teamName} Team Stats`
        },
        sheets: [{
          properties: {
            title: 'Team Stats',
            gridProperties: {
              rowCount: numStats,
              columnCount: 2,
              frozenColumnCount: 1
            }
          }
        }]
      })
    })

    if (!createResponse.ok) {
      const error = await createResponse.json()
      throw new Error(`Failed to create sheet: ${error.error?.message || 'Unknown error'}`)
    }

    const spreadsheet = await createResponse.json()
    const spreadsheetId = spreadsheet.spreadsheetId
    const sheetId = spreadsheet.sheets[0].properties.sheetId

    // Share publicly for embedding
    await shareSheetPublicly(spreadsheetId, accessToken)

    // Build requests for formatting and data
    const requests = []

    // Set Column A with stat names (protected)
    requests.push({
      updateCells: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: numStats,
          startColumnIndex: 0,
          endColumnIndex: 1
        },
        rows: TEAM_STATS_COLUMNS.map(stat => ({
          values: [{
            userEnteredValue: { stringValue: stat },
            userEnteredFormat: {
              backgroundColor: { red: 0.2, green: 0.2, blue: 0.2 },
              textFormat: {
                bold: true,
                foregroundColor: { red: 1, green: 1, blue: 1 },
                fontSize: 11
              },
              horizontalAlignment: 'LEFT',
              verticalAlignment: 'MIDDLE',
              padding: { left: 8 }
            }
          }]
        })),
        fields: 'userEnteredValue,userEnteredFormat'
      }
    })

    // Protect Column A (stat names)
    requests.push({
      addProtectedRange: {
        protectedRange: {
          range: {
            sheetId,
            startRowIndex: 0,
            endRowIndex: numStats,
            startColumnIndex: 0,
            endColumnIndex: 1
          },
          description: 'Stat names - do not edit',
          warningOnly: true
        }
      }
    })

    // Set Column A width (wider for stat names)
    requests.push({
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: 'COLUMNS',
          startIndex: 0,
          endIndex: 1
        },
        properties: { pixelSize: 180 },
        fields: 'pixelSize'
      }
    })

    // Set Column B width (for numbers)
    requests.push({
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: 'COLUMNS',
          startIndex: 1,
          endIndex: 2
        },
        properties: { pixelSize: 100 },
        fields: 'pixelSize'
      }
    })

    // Set row height for all rows
    requests.push({
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: 'ROWS',
          startIndex: 0,
          endIndex: numStats
        },
        properties: { pixelSize: 32 },
        fields: 'pixelSize'
      }
    })

    // Format Column B (value entry cells)
    requests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: numStats,
          startColumnIndex: 1,
          endColumnIndex: 2
        },
        cell: {
          userEnteredFormat: {
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            textFormat: { fontSize: 12, bold: true },
            backgroundColor: { red: 0.95, green: 0.95, blue: 0.95 }
          }
        },
        fields: 'userEnteredFormat'
      }
    })

    // Execute all requests
    const batchResponse = await fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests })
      }
    )

    if (!batchResponse.ok) {
      const error = await batchResponse.json()
      console.error('Error setting up team stats sheet:', error)
      throw new Error(`Failed to setup sheet: ${error.error?.message || 'Unknown error'}`)
    }

    return {
      sheetId: spreadsheetId,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
    }
  } catch (error) {
    console.error('Error creating team stats sheet:', error)
    throw error
  }
}

/**
 * Read team stats from Google Sheet
 * Reads values from Column B (vertical layout)
 */
export async function readTeamStatsFromSheet(spreadsheetId) {
  try {
    const accessToken = await getAccessToken()

    const numStats = TEAM_STATS_COLUMNS.length

    // Read Column B (values) for all stat rows
    const response = await fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/'Team Stats'!B1:B${numStats}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to read team stats: ${error.error?.message || 'Unknown error'}`)
    }

    const data = await response.json()
    const rows = data.values || []

    // Map rows to stat object
    const stats = {}

    // Special key mappings for stats that start with numbers
    const keyMappings = {
      '3rd Down Conversions': 'thirdDownConversions',
      '3rd Down Attempts': 'thirdDownAttempts',
      '4th Down Conversions': 'fourthDownConversions',
      '4th Down Attempts': 'fourthDownAttempts',
      '2pt Conversions': 'twoptConversions',
      '2pt Attempts': 'twoptAttempts'
    }

    TEAM_STATS_COLUMNS.forEach((col, index) => {
      const value = rows[index]?.[0]

      // Use special mapping if available, otherwise convert to camelCase
      let key = keyMappings[col]
      if (!key) {
        key = col
          .toLowerCase()
          .replace(/[^a-z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
          .replace(/^./, str => str.toLowerCase())
      }

      stats[key] = value !== undefined && value !== '' ? parseInt(value) || 0 : 0
    })

    return stats
  } catch (error) {
    console.error('Error reading team stats:', error)
    throw error
  }
}

// Awards columns and list
const AWARDS_COLUMNS = ['Award', 'Player', 'Position', 'Team', 'Class']

const AWARDS_LIST = [
  'Heisman',
  'Maxwell',
  'Walter Camp',
  'Bear Bryant Coach of the Year',
  'Davey O\'Brien',
  'Chuck Bednarik',
  'Bronco Nagurski',
  'Jim Thorpe',
  'Doak Walker',
  'Fred Biletnikoff',
  'Lombardi',
  'Unitas Golden Arm',
  'Edge Rusher of the Year',
  'Outland',
  'John Mackey',
  'Broyles',
  'Dick Butkus',
  'Rimington',
  'Lou Groza',
  'Ray Guy',
  'Returner of the Year'
]

/**
 * Create Awards Google Sheet for End of Season Recap
 */
export async function createAwardsSheet(year) {
  try {
    const accessToken = await getAccessToken()

    // Create the spreadsheet
    const createResponse = await fetch(`${SHEETS_API_BASE}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          title: `${year} Season Awards`
        },
        sheets: [
          {
            properties: {
              title: 'Awards',
              gridProperties: {
                rowCount: AWARDS_LIST.length + 1,
                columnCount: AWARDS_COLUMNS.length,
                frozenRowCount: 1
              }
            }
          }
        ]
      })
    })

    if (!createResponse.ok) {
      const error = await createResponse.json()
      throw new Error(`Failed to create spreadsheet: ${error.error?.message || 'Unknown error'}`)
    }

    const spreadsheet = await createResponse.json()
    const spreadsheetId = spreadsheet.spreadsheetId
    const sheetId = spreadsheet.sheets[0].properties.sheetId

    // Prepare batch update requests
    const requests = []

    // Set column widths
    const columnWidths = [200, 200, 80, 80, 80] // Award, Player, Position, Team, Class
    columnWidths.forEach((width, index) => {
      requests.push({
        updateDimensionProperties: {
          range: {
            sheetId: sheetId,
            dimension: 'COLUMNS',
            startIndex: index,
            endIndex: index + 1
          },
          properties: { pixelSize: width },
          fields: 'pixelSize'
        }
      })
    })

    // Set row height
    requests.push({
      updateDimensionProperties: {
        range: {
          sheetId: sheetId,
          dimension: 'ROWS',
          startIndex: 0,
          endIndex: AWARDS_LIST.length + 1
        },
        properties: { pixelSize: 28 },
        fields: 'pixelSize'
      }
    })

    // Header row formatting
    requests.push({
      repeatCell: {
        range: {
          sheetId: sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: AWARDS_COLUMNS.length
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.2, green: 0.2, blue: 0.2 },
            textFormat: {
              foregroundColor: { red: 1, green: 1, blue: 1 },
              bold: true,
              italic: true,
              fontFamily: 'Barlow',
              fontSize: 10
            },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE'
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)'
      }
    })

    // Data rows formatting
    requests.push({
      repeatCell: {
        range: {
          sheetId: sheetId,
          startRowIndex: 1,
          endRowIndex: AWARDS_LIST.length + 1,
          startColumnIndex: 0,
          endColumnIndex: AWARDS_COLUMNS.length
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
    })

    // Award name column left-aligned
    requests.push({
      repeatCell: {
        range: {
          sheetId: sheetId,
          startRowIndex: 1,
          endRowIndex: AWARDS_LIST.length + 1,
          startColumnIndex: 0,
          endColumnIndex: 1
        },
        cell: {
          userEnteredFormat: {
            textFormat: {
              bold: true,
              italic: true,
              fontFamily: 'Barlow',
              fontSize: 10
            },
            horizontalAlignment: 'LEFT',
            verticalAlignment: 'MIDDLE',
            backgroundColor: { red: 0.95, green: 0.95, blue: 0.95 }
          }
        },
        fields: 'userEnteredFormat(textFormat,horizontalAlignment,verticalAlignment,backgroundColor)'
      }
    })

    // Protect header row
    requests.push({
      addProtectedRange: {
        protectedRange: {
          range: {
            sheetId: sheetId,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: AWARDS_COLUMNS.length
          },
          description: 'Header row - do not edit',
          warningOnly: false
        }
      }
    })

    // Protect award names column
    requests.push({
      addProtectedRange: {
        protectedRange: {
          range: {
            sheetId: sheetId,
            startRowIndex: 1,
            endRowIndex: AWARDS_LIST.length + 1,
            startColumnIndex: 0,
            endColumnIndex: 1
          },
          description: 'Award names - do not edit',
          warningOnly: false
        }
      }
    })

    // Coach awards indices (these get merged Position/Team/Class into just Team)
    const coachAwardIndices = [
      AWARDS_LIST.indexOf('Bear Bryant Coach of the Year'),
      AWARDS_LIST.indexOf('Broyles')
    ].filter(i => i !== -1)

    // Merge Position, Team, Class columns (C, D, E = indices 2, 3, 4) for coach awards
    coachAwardIndices.forEach(awardIndex => {
      const rowIndex = awardIndex + 1 // +1 for header row
      requests.push({
        mergeCells: {
          range: {
            sheetId,
            startRowIndex: rowIndex,
            endRowIndex: rowIndex + 1,
            startColumnIndex: 2,
            endColumnIndex: 5
          },
          mergeType: 'MERGE_ALL'
        }
      })
    })

    // Add position dropdown validation for Position column - skip coach award rows
    // Rows before first coach award
    if (coachAwardIndices[0] > 0) {
      requests.push(generatePositionValidation(sheetId, 2, 1, coachAwardIndices[0] + 1))
    }
    // Rows between coach awards
    if (coachAwardIndices.length > 1 && coachAwardIndices[1] > coachAwardIndices[0] + 1) {
      requests.push(generatePositionValidation(sheetId, 2, coachAwardIndices[0] + 2, coachAwardIndices[1] + 1))
    }
    // Rows after last coach award
    const lastCoachIdx = coachAwardIndices[coachAwardIndices.length - 1]
    if (lastCoachIdx < AWARDS_LIST.length - 1) {
      requests.push(generatePositionValidation(sheetId, 2, lastCoachIdx + 2, AWARDS_LIST.length + 1))
    }

    // Add class dropdown validation for Class column - skip coach award rows
    // Rows before first coach award
    if (coachAwardIndices[0] > 0) {
      requests.push(generateClassValidation(sheetId, 4, 1, coachAwardIndices[0] + 1))
    }
    // Rows between coach awards
    if (coachAwardIndices.length > 1 && coachAwardIndices[1] > coachAwardIndices[0] + 1) {
      requests.push(generateClassValidation(sheetId, 4, coachAwardIndices[0] + 2, coachAwardIndices[1] + 1))
    }
    // Rows after last coach award
    if (lastCoachIdx < AWARDS_LIST.length - 1) {
      requests.push(generateClassValidation(sheetId, 4, lastCoachIdx + 2, AWARDS_LIST.length + 1))
    }

    // Add team dropdown validation for Team column (column D, index 3) - all rows
    requests.push(generateTeamValidation(sheetId, 3, 1, AWARDS_LIST.length + 1))

    // Add conditional formatting for team colors in Team column
    requests.push(...generateTeamFormattingRulesForRange(sheetId, 3, 1, AWARDS_LIST.length + 1))

    // Also add team validation and formatting to merged coach award cells (column C which is now part of merged)
    coachAwardIndices.forEach(awardIndex => {
      const rowIndex = awardIndex + 1
      requests.push(generateTeamValidation(sheetId, 2, rowIndex, rowIndex + 1))
      requests.push(...generateTeamFormattingRulesForRange(sheetId, 2, rowIndex, rowIndex + 1))
    })

    // Execute batch update for formatting
    const batchResponse = await fetch(`${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ requests })
    })

    if (!batchResponse.ok) {
      const error = await batchResponse.json()
      console.error('Error setting up awards sheet:', error)
      throw new Error(`Failed to setup sheet: ${error.error?.message || 'Unknown error'}`)
    }

    // Prepare values to write
    const values = [
      AWARDS_COLUMNS, // Header row
      ...AWARDS_LIST.map(award => [award, '', '', '', '']) // Award names in first column
    ]

    // Write headers and award names
    const lastCol = String.fromCharCode(65 + AWARDS_COLUMNS.length - 1)
    const valuesResponse = await fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/Awards!A1:${lastCol}${AWARDS_LIST.length + 1}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values })
      }
    )

    if (!valuesResponse.ok) {
      const error = await valuesResponse.json()
      throw new Error(`Failed to write values: ${error.error?.message || 'Unknown error'}`)
    }

    return {
      sheetId: spreadsheetId,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
    }
  } catch (error) {
    console.error('Error creating awards sheet:', error)
    throw error
  }
}

/**
 * Read awards from Google Sheet
 */
export async function readAwardsFromSheet(spreadsheetId) {
  try {
    const accessToken = await getAccessToken()

    const lastCol = String.fromCharCode(65 + AWARDS_COLUMNS.length - 1)

    // Read all data rows
    const response = await fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/Awards!A2:${lastCol}${AWARDS_LIST.length + 1}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to read awards: ${error.error?.message || 'Unknown error'}`)
    }

    const data = await response.json()
    const rows = data.values || []

    // Map to awards object
    const awards = {}
    rows.forEach((row) => {
      const award = row[0]
      const player = row[1] || ''
      const position = row[2] || ''
      const team = (row[3] || '').toUpperCase()
      const playerClass = row[4] || ''

      if (award && player) {
        // Convert award name to camelCase key
        const key = award
          .toLowerCase()
          .replace(/['']/g, '')
          .replace(/[^a-z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
          .replace(/^./, str => str.toLowerCase())

        awards[key] = {
          player,
          position,
          team,
          class: playerClass
        }
      }
    })

    return awards
  } catch (error) {
    console.error('Error reading awards:', error)
    throw error
  }
}

// All-Americans/All-Conference positions list
const ALL_AMERICAN_POSITIONS = [
  'QB', 'HB', 'HB', 'WR', 'WR', 'WR', 'TE',
  'LT', 'LG', 'C', 'RG', 'RT',
  'LEDG', 'REDG', 'DT', 'DT',
  'SAM', 'MIKE', 'WILL',
  'CB', 'CB', 'FS', 'SS',
  'K', 'P'
]

/**
 * Create All-Americans & All-Conference Google Sheet
 * Structure: 12 columns (3 teams × 4 cols each: Position, Player, Team, Class)
 * Two tables: All-Americans on top, All-Conference below
 */
export async function createAllAmericansSheet(year) {
  try {
    const accessToken = await getAccessToken()

    const numPositions = ALL_AMERICAN_POSITIONS.length // 25
    // Row layout:
    // Row 1: "All-Americans" header (merged)
    // Row 2: "First-Team" | "Second-Team" | "Freshman Team" (each merged over 4 cols)
    // Row 3: Position | Player | Team | Class (repeated 3x)
    // Rows 4-28: Position data rows (25 positions)
    // Row 29: Empty separator
    // Row 30: "All-Conference" header (merged)
    // Row 31: "First-Team" | "Second-Team" | "Freshman Team"
    // Row 32: Position | Player | Team | Class (repeated 3x)
    // Rows 33-57: Position data rows (25 positions)
    const totalRows = 3 + numPositions + 1 + 3 + numPositions // 57 rows

    // Create the spreadsheet
    const createResponse = await fetch(`${SHEETS_API_BASE}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          title: `${year} All-Americans & All-Conference`
        },
        sheets: [
          {
            properties: {
              title: 'Selections',
              gridProperties: {
                rowCount: totalRows,
                columnCount: 12,
                frozenRowCount: 3
              }
            }
          }
        ]
      })
    })

    if (!createResponse.ok) {
      const error = await createResponse.json()
      throw new Error(`Failed to create spreadsheet: ${error.error?.message || 'Unknown error'}`)
    }

    const spreadsheet = await createResponse.json()
    const spreadsheetId = spreadsheet.spreadsheetId
    const sheetId = spreadsheet.sheets[0].properties.sheetId

    // Prepare batch update requests
    const requests = []

    // Set column widths: Position(60), Player(150), Team(60), Class(60) × 3
    const colWidths = [60, 150, 60, 60, 60, 150, 60, 60, 60, 150, 60, 60]
    colWidths.forEach((width, index) => {
      requests.push({
        updateDimensionProperties: {
          range: {
            sheetId: sheetId,
            dimension: 'COLUMNS',
            startIndex: index,
            endIndex: index + 1
          },
          properties: { pixelSize: width },
          fields: 'pixelSize'
        }
      })
    })

    // Set row heights
    requests.push({
      updateDimensionProperties: {
        range: {
          sheetId: sheetId,
          dimension: 'ROWS',
          startIndex: 0,
          endIndex: totalRows
        },
        properties: { pixelSize: 24 },
        fields: 'pixelSize'
      }
    })

    // Main header rows (All-Americans row 1, All-Conference row 30) - taller
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 32 },
        fields: 'pixelSize'
      }
    })
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'ROWS', startIndex: 29, endIndex: 30 },
        properties: { pixelSize: 32 },
        fields: 'pixelSize'
      }
    })

    // === MERGE CELLS ===

    // Row 1: "All-Americans" merged across all 12 columns
    requests.push({
      mergeCells: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 12 },
        mergeType: 'MERGE_ALL'
      }
    })

    // Row 2: Team headers merged (First-Team: 0-3, Second-Team: 4-7, Freshman Team: 8-11)
    requests.push({
      mergeCells: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 4 },
        mergeType: 'MERGE_ALL'
      }
    })
    requests.push({
      mergeCells: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 4, endColumnIndex: 8 },
        mergeType: 'MERGE_ALL'
      }
    })
    requests.push({
      mergeCells: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 8, endColumnIndex: 12 },
        mergeType: 'MERGE_ALL'
      }
    })

    // Row 30: "All-Conference" merged across all 12 columns (index 29)
    requests.push({
      mergeCells: {
        range: { sheetId, startRowIndex: 29, endRowIndex: 30, startColumnIndex: 0, endColumnIndex: 12 },
        mergeType: 'MERGE_ALL'
      }
    })

    // Row 31: Team headers for All-Conference (index 30)
    requests.push({
      mergeCells: {
        range: { sheetId, startRowIndex: 30, endRowIndex: 31, startColumnIndex: 0, endColumnIndex: 4 },
        mergeType: 'MERGE_ALL'
      }
    })
    requests.push({
      mergeCells: {
        range: { sheetId, startRowIndex: 30, endRowIndex: 31, startColumnIndex: 4, endColumnIndex: 8 },
        mergeType: 'MERGE_ALL'
      }
    })
    requests.push({
      mergeCells: {
        range: { sheetId, startRowIndex: 30, endRowIndex: 31, startColumnIndex: 8, endColumnIndex: 12 },
        mergeType: 'MERGE_ALL'
      }
    })

    // === FORMATTING ===

    // Main headers (All-Americans & All-Conference) - dark background, white text
    const mainHeaderFormat = {
      backgroundColor: { red: 0.1, green: 0.1, blue: 0.1 },
      textFormat: {
        foregroundColor: { red: 1, green: 1, blue: 1 },
        bold: true,
        fontSize: 14,
        fontFamily: 'Barlow'
      },
      horizontalAlignment: 'CENTER',
      verticalAlignment: 'MIDDLE'
    }

    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 12 },
        cell: { userEnteredFormat: mainHeaderFormat },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)'
      }
    })
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 29, endRowIndex: 30, startColumnIndex: 0, endColumnIndex: 12 },
        cell: { userEnteredFormat: mainHeaderFormat },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)'
      }
    })

    // Team headers (First-Team, Second-Team, Freshman Team) - medium gray
    const teamHeaderFormat = {
      backgroundColor: { red: 0.3, green: 0.3, blue: 0.3 },
      textFormat: {
        foregroundColor: { red: 1, green: 1, blue: 1 },
        bold: true,
        fontSize: 11,
        fontFamily: 'Barlow'
      },
      horizontalAlignment: 'CENTER',
      verticalAlignment: 'MIDDLE'
    }

    // All-Americans team headers (row 2)
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 12 },
        cell: { userEnteredFormat: teamHeaderFormat },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)'
      }
    })
    // All-Conference team headers (row 31)
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 30, endRowIndex: 31, startColumnIndex: 0, endColumnIndex: 12 },
        cell: { userEnteredFormat: teamHeaderFormat },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)'
      }
    })

    // Column headers (Position, Player, Team, Class) - light gray
    const colHeaderFormat = {
      backgroundColor: { red: 0.85, green: 0.85, blue: 0.85 },
      textFormat: {
        foregroundColor: { red: 0.1, green: 0.1, blue: 0.1 },
        bold: true,
        fontSize: 10,
        fontFamily: 'Barlow'
      },
      horizontalAlignment: 'CENTER',
      verticalAlignment: 'MIDDLE'
    }

    // All-Americans column headers (row 3)
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 12 },
        cell: { userEnteredFormat: colHeaderFormat },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)'
      }
    })
    // All-Conference column headers (row 32)
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 31, endRowIndex: 32, startColumnIndex: 0, endColumnIndex: 12 },
        cell: { userEnteredFormat: colHeaderFormat },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)'
      }
    })

    // Data rows formatting
    const dataFormat = {
      textFormat: {
        bold: true,
        italic: true,
        fontSize: 10,
        fontFamily: 'Barlow'
      },
      horizontalAlignment: 'CENTER',
      verticalAlignment: 'MIDDLE'
    }

    // All-Americans data rows (rows 4-28, indices 3-27)
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 3, endRowIndex: 3 + numPositions, startColumnIndex: 0, endColumnIndex: 12 },
        cell: { userEnteredFormat: dataFormat },
        fields: 'userEnteredFormat(textFormat,horizontalAlignment,verticalAlignment)'
      }
    })
    // All-Conference data rows (rows 33-57, indices 32-56)
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 32, endRowIndex: 32 + numPositions, startColumnIndex: 0, endColumnIndex: 12 },
        cell: { userEnteredFormat: dataFormat },
        fields: 'userEnteredFormat(textFormat,horizontalAlignment,verticalAlignment)'
      }
    })

    // Position columns background (light gray for visual distinction)
    const positionColFormat = {
      backgroundColor: { red: 0.95, green: 0.95, blue: 0.95 },
      textFormat: {
        bold: true,
        italic: true,
        fontSize: 10,
        fontFamily: 'Barlow'
      },
      horizontalAlignment: 'CENTER',
      verticalAlignment: 'MIDDLE'
    }

    // All-Americans position columns (cols 0, 4, 8)
    ;[0, 4, 8].forEach(col => {
      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: 3, endRowIndex: 3 + numPositions, startColumnIndex: col, endColumnIndex: col + 1 },
          cell: { userEnteredFormat: positionColFormat },
          fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)'
        }
      })
    })
    // All-Conference position columns
    ;[0, 4, 8].forEach(col => {
      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: 32, endRowIndex: 32 + numPositions, startColumnIndex: col, endColumnIndex: col + 1 },
          cell: { userEnteredFormat: positionColFormat },
          fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)'
        }
      })
    })

    // Separator row (row 29, index 28) - empty with light background
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 28, endRowIndex: 29, startColumnIndex: 0, endColumnIndex: 12 },
        cell: { userEnteredFormat: { backgroundColor: { red: 0.97, green: 0.97, blue: 0.97 } } },
        fields: 'userEnteredFormat(backgroundColor)'
      }
    })

    // === PROTECT HEADERS AND POSITION COLUMNS ===

    // Protect All-Americans headers (rows 1-3)
    requests.push({
      addProtectedRange: {
        protectedRange: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 12 },
          description: 'All-Americans headers - do not edit',
          warningOnly: false
        }
      }
    })

    // Protect All-Conference headers (rows 30-32)
    requests.push({
      addProtectedRange: {
        protectedRange: {
          range: { sheetId, startRowIndex: 29, endRowIndex: 32, startColumnIndex: 0, endColumnIndex: 12 },
          description: 'All-Conference headers - do not edit',
          warningOnly: false
        }
      }
    })

    // Protect position columns (cols 0, 4, 8) for All-Americans
    ;[0, 4, 8].forEach(col => {
      requests.push({
        addProtectedRange: {
          protectedRange: {
            range: { sheetId, startRowIndex: 3, endRowIndex: 3 + numPositions, startColumnIndex: col, endColumnIndex: col + 1 },
            description: 'Position column - do not edit',
            warningOnly: false
          }
        }
      })
    })

    // Protect position columns for All-Conference
    ;[0, 4, 8].forEach(col => {
      requests.push({
        addProtectedRange: {
          protectedRange: {
            range: { sheetId, startRowIndex: 32, endRowIndex: 32 + numPositions, startColumnIndex: col, endColumnIndex: col + 1 },
            description: 'Position column - do not edit',
            warningOnly: false
          }
        }
      })
    })

    // Protect separator row
    requests.push({
      addProtectedRange: {
        protectedRange: {
          range: { sheetId, startRowIndex: 28, endRowIndex: 29, startColumnIndex: 0, endColumnIndex: 12 },
          description: 'Separator row - do not edit',
          warningOnly: false
        }
      }
    })

    // Add team dropdown validation and conditional formatting for Team columns (indices 2, 6, 10)
    // All-Americans section: rows 3-28 (indices 3 to 3 + numPositions)
    // All-Conference section: rows 32-57 (indices 32 to 32 + numPositions)
    const teamColumnIndices = [2, 6, 10]

    teamColumnIndices.forEach(colIndex => {
      // All-Americans section
      requests.push(generateTeamValidation(sheetId, colIndex, 3, 3 + numPositions))
      requests.push(...generateTeamFormattingRulesForRange(sheetId, colIndex, 3, 3 + numPositions))

      // All-Conference section
      requests.push(generateTeamValidation(sheetId, colIndex, 32, 32 + numPositions))
      requests.push(...generateTeamFormattingRulesForRange(sheetId, colIndex, 32, 32 + numPositions))
    })

    // Add class dropdown validation for Class columns (indices 3, 7, 11)
    const classColumnIndices = [3, 7, 11]

    classColumnIndices.forEach(colIndex => {
      // All-Americans section
      requests.push(generateClassValidation(sheetId, colIndex, 3, 3 + numPositions))

      // All-Conference section
      requests.push(generateClassValidation(sheetId, colIndex, 32, 32 + numPositions))
    })

    // Execute batch update for formatting
    const batchResponse = await fetch(`${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ requests })
    })

    if (!batchResponse.ok) {
      const error = await batchResponse.json()
      console.error('Error setting up all-americans sheet:', error)
      throw new Error(`Failed to setup sheet: ${error.error?.message || 'Unknown error'}`)
    }

    // Prepare values to write
    const colHeaders = ['Position', 'Player', 'Team', 'Class']
    const teamHeaders = ['First-Team', 'Second-Team', 'Freshman Team']

    // Build the values array
    const values = []

    // Row 1: All-Americans header
    values.push(['All-Americans', '', '', '', '', '', '', '', '', '', '', ''])

    // Row 2: Team headers (merged cells will show first value)
    values.push(['First-Team', '', '', '', 'Second-Team', '', '', '', 'Freshman Team', '', '', ''])

    // Row 3: Column headers
    values.push([...colHeaders, ...colHeaders, ...colHeaders])

    // Rows 4-28: Position data for All-Americans
    ALL_AMERICAN_POSITIONS.forEach(pos => {
      values.push([pos, '', '', '', pos, '', '', '', pos, '', '', ''])
    })

    // Row 29: Empty separator
    values.push(['', '', '', '', '', '', '', '', '', '', '', ''])

    // Row 30: All-Conference header
    values.push(['All-Conference', '', '', '', '', '', '', '', '', '', '', ''])

    // Row 31: Team headers
    values.push(['First-Team', '', '', '', 'Second-Team', '', '', '', 'Freshman Team', '', '', ''])

    // Row 32: Column headers
    values.push([...colHeaders, ...colHeaders, ...colHeaders])

    // Rows 33-57: Position data for All-Conference
    ALL_AMERICAN_POSITIONS.forEach(pos => {
      values.push([pos, '', '', '', pos, '', '', '', pos, '', '', ''])
    })

    // Write all values
    const valuesResponse = await fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/Selections!A1:L${totalRows}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values })
      }
    )

    if (!valuesResponse.ok) {
      const error = await valuesResponse.json()
      throw new Error(`Failed to write values: ${error.error?.message || 'Unknown error'}`)
    }

    return {
      sheetId: spreadsheetId,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
    }
  } catch (error) {
    console.error('Error creating all-americans sheet:', error)
    throw error
  }
}

/**
 * Read All-Americans & All-Conference data from Google Sheet
 */
export async function readAllAmericansFromSheet(spreadsheetId) {
  try {
    const accessToken = await getAccessToken()

    const numPositions = ALL_AMERICAN_POSITIONS.length

    // Read all data
    const response = await fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/Selections!A1:L57`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to read data: ${error.error?.message || 'Unknown error'}`)
    }

    const data = await response.json()
    const rows = data.values || []

    // Helper to extract team data from rows
    const extractTeamData = (startRow, teamLabel) => {
      const result = []
      for (let i = 0; i < numPositions; i++) {
        const row = rows[startRow + i] || []

        // First-Team (cols 0-3)
        if (row[1]) { // Player name exists
          result.push({
            team: teamLabel,
            designation: 'first',
            position: row[0] || ALL_AMERICAN_POSITIONS[i],
            player: row[1],
            school: (row[2] || '').toUpperCase(),
            class: row[3] || ''
          })
        }

        // Second-Team (cols 4-7)
        if (row[5]) {
          result.push({
            team: teamLabel,
            designation: 'second',
            position: row[4] || ALL_AMERICAN_POSITIONS[i],
            player: row[5],
            school: (row[6] || '').toUpperCase(),
            class: row[7] || ''
          })
        }

        // Freshman Team (cols 8-11)
        if (row[9]) {
          result.push({
            team: teamLabel,
            designation: 'freshman',
            position: row[8] || ALL_AMERICAN_POSITIONS[i],
            player: row[9],
            school: (row[10] || '').toUpperCase(),
            class: row[11] || ''
          })
        }
      }
      return result
    }

    // All-Americans data starts at row 4 (index 3)
    const allAmericans = extractTeamData(3, 'all-american')

    // All-Conference data starts at row 33 (index 32)
    const allConference = extractTeamData(32, 'all-conference')

    return {
      allAmericans,
      allConference
    }
  } catch (error) {
    console.error('Error reading all-americans data:', error)
    throw error
  }
}

// Transfer/Leaving reasons for Players Leaving sheet
const LEAVING_REASONS = [
  'Graduating',
  'Pro Draft',
  'Playing Style',
  'Proximity to Home',
  'Championship Contender',
  'Program Tradition',
  'Campus Lifestyle',
  'Stadium Atmosphere',
  'Pro Potential',
  'Brand Exposure',
  'Academic Prestige',
  'Conference Prestige',
  'Coach Stability',
  'Coach Prestige',
  'Athletic Facilities',
  'Playing Time'
]

// Create Players Leaving sheet for offseason
// Auto-fills seniors (Sr/RS Sr) who played 5+ games with "Graduating"
export async function createPlayersLeavingSheet(dynastyName, year, players, playerStatsByYear) {
  try {
    const accessToken = await getAccessToken()

    // Get player names for dropdown
    const playerNames = players.map(p => p.name).sort()

    // Find seniors who played 5+ games (auto-graduate)
    const currentYearStats = playerStatsByYear?.[year] || []
    const seniorsGraduating = players.filter(player => {
      const isSenior = player.year === 'Sr' || player.year === 'RS Sr'
      if (!isSenior) return false

      // Find their stats to check games played
      const stats = currentYearStats.find(s => s.pid === player.pid)
      const gamesPlayed = stats?.gamesPlayed || 0
      return gamesPlayed >= 5
    }).sort((a, b) => a.name.localeCompare(b.name))

    // We'll pre-fill graduating seniors, then leave room for more entries
    const prefilledRows = seniorsGraduating.length
    const totalRows = Math.max(prefilledRows + 20, 60) // At least 60 rows for additional entries

    // Create the spreadsheet
    const response = await fetch(SHEETS_API_BASE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: `${dynastyName} - Players Leaving ${year}`
        },
        sheets: [
          {
            properties: {
              title: 'Players Leaving',
              gridProperties: {
                rowCount: totalRows + 1,
                columnCount: 2,
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
      throw new Error(`Failed to create players leaving sheet: ${error.error?.message || 'Unknown error'}`)
    }

    const sheet = await response.json()
    const sheetId = sheet.sheets[0].properties.sheetId

    // Initialize the sheet with headers and pre-filled data
    await initializePlayersLeavingSheet(
      sheet.spreadsheetId,
      accessToken,
      sheetId,
      playerNames,
      seniorsGraduating,
      totalRows
    )

    // Share sheet publicly so it can be embedded in iframe
    await shareSheetPublicly(sheet.spreadsheetId, accessToken)

    return {
      spreadsheetId: sheet.spreadsheetId,
      spreadsheetUrl: sheet.spreadsheetUrl
    }
  } catch (error) {
    console.error('Error creating players leaving sheet:', error)
    throw error
  }
}

// Initialize the Players Leaving sheet with headers, validation, and pre-filled data
async function initializePlayersLeavingSheet(spreadsheetId, accessToken, sheetId, playerNames, seniorsGraduating, totalRows) {
  // Build pre-filled rows for graduating seniors
  const prefilledRows = seniorsGraduating.map(player => ({
    values: [
      { userEnteredValue: { stringValue: player.name } },
      { userEnteredValue: { stringValue: 'Graduating' } }
    ]
  }))

  const requests = [
    // Set headers
    {
      updateCells: {
        range: {
          sheetId: sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: 2
        },
        rows: [{
          values: [
            { userEnteredValue: { stringValue: 'Player' } },
            { userEnteredValue: { stringValue: 'Transfer Reason' } }
          ]
        }],
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
    // Add player name dropdown validation for Player column
    {
      setDataValidation: {
        range: {
          sheetId: sheetId,
          startRowIndex: 1,
          endRowIndex: totalRows + 1,
          startColumnIndex: 0,
          endColumnIndex: 1
        },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: playerNames.map(name => ({ userEnteredValue: name }))
          },
          showCustomUi: true,
          strict: true
        }
      }
    },
    // Add leaving reason dropdown validation for Transfer Reason column
    {
      setDataValidation: {
        range: {
          sheetId: sheetId,
          startRowIndex: 1,
          endRowIndex: totalRows + 1,
          startColumnIndex: 1,
          endColumnIndex: 2
        },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: LEAVING_REASONS.map(reason => ({ userEnteredValue: reason }))
          },
          showCustomUi: true,
          strict: true
        }
      }
    },
    // Protect header row
    {
      addProtectedRange: {
        protectedRange: {
          range: {
            sheetId: sheetId,
            startRowIndex: 0,
            endRowIndex: 1
          },
          description: 'Header row - do not edit',
          warningOnly: true
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
        properties: { pixelSize: 200 },
        fields: 'pixelSize'
      }
    },
    {
      updateDimensionProperties: {
        range: {
          sheetId: sheetId,
          dimension: 'COLUMNS',
          startIndex: 1,
          endIndex: 2
        },
        properties: { pixelSize: 150 },
        fields: 'pixelSize'
      }
    }
  ]

  // Add pre-filled graduating seniors if any
  if (prefilledRows.length > 0) {
    requests.push({
      updateCells: {
        range: {
          sheetId: sheetId,
          startRowIndex: 1,
          endRowIndex: 1 + prefilledRows.length,
          startColumnIndex: 0,
          endColumnIndex: 2
        },
        rows: prefilledRows,
        fields: 'userEnteredValue'
      }
    })
  }

  // Execute all requests
  await fetch(`${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests })
  })
}

// Read players leaving data from Google Sheet
export async function readPlayersLeavingFromSheet(spreadsheetId) {
  try {
    const accessToken = await getAccessToken()

    const response = await fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/Players Leaving!A2:B100`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to read players leaving data: ${error.error?.message || 'Unknown error'}`)
    }

    const data = await response.json()
    const rows = data.values || []

    // Parse rows into player leaving objects
    const playersLeaving = rows
      .filter(row => row[0] && row[0].trim()) // Must have player name
      .map(row => ({
        playerName: row[0]?.trim() || '',
        reason: row[1]?.trim() || ''
      }))
      .filter(entry => entry.playerName && entry.reason) // Must have both values

    return playersLeaving
  } catch (error) {
    console.error('Error reading players leaving data:', error)
    throw error
  }
}

// Draft round options
const DRAFT_ROUNDS = [
  '1st Round',
  '2nd Round',
  '3rd Round',
  '4th Round',
  '5th Round',
  '6th Round',
  '7th Round',
  'Undrafted'
]

// Create Draft Results sheet for recruiting week 1
// Pre-fills players who declared for the draft (reason = 'Pro Draft')
export async function createDraftResultsSheet(dynastyName, year, playersLeavingThisYear, allPlayers) {
  try {
    const accessToken = await getAccessToken()

    // Filter players who declared for the draft
    const draftDeclarees = playersLeavingThisYear
      .filter(p => p.reason === 'Pro Draft')
      .map(leaving => {
        // Find the full player info
        const player = allPlayers.find(p => p.name === leaving.playerName || p.pid === leaving.pid)
        return {
          name: leaving.playerName,
          pid: leaving.pid || player?.pid,
          position: player?.position || '',
          overall: player?.overall || ''
        }
      })
      .sort((a, b) => (b.overall || 0) - (a.overall || 0)) // Sort by overall desc

    const totalRows = Math.max(draftDeclarees.length + 5, 20)

    // Create the spreadsheet
    const response = await fetch(SHEETS_API_BASE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: `${dynastyName} - ${year} Draft Results`
        },
        sheets: [
          {
            properties: {
              title: 'Draft Results',
              gridProperties: {
                rowCount: totalRows + 1,
                columnCount: 4,
                frozenRowCount: 1
              }
            }
          }
        ]
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to create draft results sheet: ${error.error?.message || 'Unknown error'}`)
    }

    const spreadsheet = await response.json()
    const spreadsheetId = spreadsheet.spreadsheetId
    const sheetId = spreadsheet.sheets[0].properties.sheetId

    // Get player names for validation (only draft declarees)
    const playerNames = draftDeclarees.map(p => p.name)

    // Build batch update requests
    const requests = []

    // Set header row
    requests.push({
      updateCells: {
        range: {
          sheetId: sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: 4
        },
        rows: [{
          values: [
            { userEnteredValue: { stringValue: 'Player' }, userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.2, green: 0.2, blue: 0.2 }, horizontalAlignment: 'CENTER' } },
            { userEnteredValue: { stringValue: 'Position' }, userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.2, green: 0.2, blue: 0.2 }, horizontalAlignment: 'CENTER' } },
            { userEnteredValue: { stringValue: 'Overall' }, userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.2, green: 0.2, blue: 0.2 }, horizontalAlignment: 'CENTER' } },
            { userEnteredValue: { stringValue: 'Draft Round' }, userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.2, green: 0.2, blue: 0.2 }, horizontalAlignment: 'CENTER' } }
          ]
        }],
        fields: 'userEnteredValue,userEnteredFormat'
      }
    })

    // Set column widths
    requests.push({
      updateDimensionProperties: {
        range: { sheetId: sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 200 },
        fields: 'pixelSize'
      }
    })
    requests.push({
      updateDimensionProperties: {
        range: { sheetId: sheetId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 },
        properties: { pixelSize: 80 },
        fields: 'pixelSize'
      }
    })
    requests.push({
      updateDimensionProperties: {
        range: { sheetId: sheetId, dimension: 'COLUMNS', startIndex: 2, endIndex: 3 },
        properties: { pixelSize: 80 },
        fields: 'pixelSize'
      }
    })
    requests.push({
      updateDimensionProperties: {
        range: { sheetId: sheetId, dimension: 'COLUMNS', startIndex: 3, endIndex: 4 },
        properties: { pixelSize: 120 },
        fields: 'pixelSize'
      }
    })

    // Add data validation for Draft Round column (dropdown)
    requests.push({
      setDataValidation: {
        range: {
          sheetId: sheetId,
          startRowIndex: 1,
          endRowIndex: totalRows + 1,
          startColumnIndex: 3,
          endColumnIndex: 4
        },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: DRAFT_ROUNDS.map(round => ({ userEnteredValue: round }))
          },
          showCustomUi: true,
          strict: true
        }
      }
    })

    // Pre-fill draft declarees
    if (draftDeclarees.length > 0) {
      const prefilledRows = draftDeclarees.map(player => ({
        values: [
          { userEnteredValue: { stringValue: player.name } },
          { userEnteredValue: { stringValue: player.position } },
          { userEnteredValue: { numberValue: player.overall || 0 } },
          { userEnteredValue: { stringValue: '' } } // Draft round to be filled in
        ]
      }))

      requests.push({
        updateCells: {
          range: {
            sheetId: sheetId,
            startRowIndex: 1,
            endRowIndex: 1 + draftDeclarees.length,
            startColumnIndex: 0,
            endColumnIndex: 4
          },
          rows: prefilledRows,
          fields: 'userEnteredValue'
        }
      })
    }

    // Protect header row
    requests.push({
      addProtectedRange: {
        protectedRange: {
          range: {
            sheetId: sheetId,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: 4
          },
          description: 'Header row - do not edit',
          warningOnly: true
        }
      }
    })

    // Execute all requests
    await fetch(`${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests })
    })

    return {
      spreadsheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
    }
  } catch (error) {
    console.error('Error creating draft results sheet:', error)
    throw error
  }
}

// Read draft results from Google Sheet
export async function readDraftResultsFromSheet(spreadsheetId) {
  try {
    const accessToken = await getAccessToken()

    const response = await fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/Draft Results!A2:D100`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to read draft results: ${error.error?.message || 'Unknown error'}`)
    }

    const data = await response.json()
    const rows = data.values || []

    // Parse rows into draft result objects
    const draftResults = rows
      .filter(row => row[0] && row[0].trim() && row[3] && row[3].trim()) // Must have player name and draft round
      .map(row => ({
        playerName: row[0]?.trim() || '',
        position: row[1]?.trim() || '',
        overall: parseInt(row[2]) || 0,
        draftRound: row[3]?.trim() || ''
      }))

    return draftResults
  } catch (error) {
    console.error('Error reading draft results:', error)
    throw error
  }
}

// Recruiting class options
const RECRUIT_CLASSES = ['HS', 'Fr', 'RS Fr', 'So', 'RS So', 'Jr', 'RS Jr']

const RECRUIT_POSITIONS = [
  'QB', 'HB', 'FB', 'WR', 'TE', 'OT', 'OG', 'C',
  'EDGE', 'DT', 'OLB', 'MIKE', 'CB', 'FS', 'SS', 'K', 'P', 'ATH'
]

const RECRUIT_ARCHETYPES = [
  'Backfield Creator', 'Dual Threat', 'Pocket Passer', 'Pure Runner',
  'Backfield Threat', 'East/West Playmaker', 'Elusive Bruiser', 'North/South Receiver', 'North/South Blocker',
  'Blocking', 'Utility',
  'Contested Specialist', 'Elusive Route Runner', 'Gadget', 'Gritty Possession', 'Physical Route Runner', 'Route Artist', 'Speedster',
  'Possession', 'Pure Blocker', 'Vertical Threat',
  'Agile', 'Pass Protector', 'Raw Strength', 'Ground and Pound', 'Well Rounded',
  'Edge Setter', 'Gap Specialist', 'Power Rusher', 'Pure Power', 'Speed Rusher',
  'Lurker', 'Signal Caller', 'Thumper',
  'Boundary', 'Field', 'Zone',
  'Box Specialist', 'Coverage Specialist', 'Hybrid',
  'Accurate', 'Power'
]

const STAR_RATINGS = ['☆', '☆☆', '☆☆☆', '☆☆☆☆', '☆☆☆☆☆']

const HEIGHTS = [
  '5\'5"', '5\'6"', '5\'7"', '5\'8"', '5\'9"', '5\'10"', '5\'11"',
  '6\'0"', '6\'1"', '6\'2"', '6\'3"', '6\'4"', '6\'5"', '6\'6"', '6\'7"', '6\'8"', '6\'9"', '6\'10"', '6\'11"',
  '7\'0"'
]

const US_STATES = [
  'AK', 'AL', 'AR', 'AZ', 'CA', 'CO', 'CT', 'DC', 'DE', 'FL',
  'GA', 'HI', 'IA', 'ID', 'IL', 'IN', 'KS', 'KY', 'LA', 'MA',
  'MD', 'ME', 'MI', 'MN', 'MO', 'MS', 'MT', 'NC', 'ND', 'NE',
  'NH', 'NJ', 'NM', 'NV', 'NY', 'OH', 'OK', 'OR', 'PA', 'RI',
  'SC', 'SD', 'TN', 'TX', 'UT', 'VA', 'VT', 'WA', 'WI', 'WV', 'WY'
]

const GEM_BUST_OPTIONS = ['Gem', 'Bust']
const DEV_TRAITS = ['Elite', 'Star', 'Impact', 'Normal']

// Convert stars number to symbols
function starsNumberToSymbol(num) {
  if (!num || num <= 0) return ''
  return '☆'.repeat(Math.min(num, 5))
}

// Create Recruiting Commitments sheet
export async function createRecruitingSheet(dynastyName, year, teamAbbreviationsData, existingCommitments = []) {
  try {
    const accessToken = await getAccessToken()

    // Get all team abbreviations for Previous Team dropdown
    const teamAbbrs = Object.keys(teamAbbreviationsData).filter(key =>
      typeof teamAbbreviationsData[key] === 'object' && teamAbbreviationsData[key].name
    ).sort()

    const totalRows = Math.max(30, existingCommitments.length + 15) // Room for existing + new recruits

    // Create the spreadsheet
    const response = await fetch(SHEETS_API_BASE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: `${dynastyName} - ${year} Recruiting Class`
        },
        sheets: [
          {
            properties: {
              title: 'Commitments',
              gridProperties: {
                rowCount: totalRows + 1,
                columnCount: 15,
                frozenRowCount: 1
              }
            }
          }
        ]
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to create recruiting sheet: ${error.error?.message || 'Unknown error'}`)
    }

    const spreadsheet = await response.json()
    const spreadsheetId = spreadsheet.spreadsheetId
    const sheetId = spreadsheet.sheets[0].properties.sheetId

    // Build batch update requests
    const requests = []

    // Set header row with dark background
    const headerStyle = { textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } }, backgroundColor: { red: 0.2, green: 0.2, blue: 0.2 }, horizontalAlignment: 'CENTER' }
    requests.push({
      updateCells: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 15 },
        rows: [{
          values: [
            { userEnteredValue: { stringValue: 'Player' }, userEnteredFormat: headerStyle },
            { userEnteredValue: { stringValue: 'Class' }, userEnteredFormat: headerStyle },
            { userEnteredValue: { stringValue: 'Position' }, userEnteredFormat: headerStyle },
            { userEnteredValue: { stringValue: 'Archetype' }, userEnteredFormat: headerStyle },
            { userEnteredValue: { stringValue: 'Stars' }, userEnteredFormat: headerStyle },
            { userEnteredValue: { stringValue: 'Nat. Rank' }, userEnteredFormat: headerStyle },
            { userEnteredValue: { stringValue: 'State Rank' }, userEnteredFormat: headerStyle },
            { userEnteredValue: { stringValue: 'Pos. Rank' }, userEnteredFormat: headerStyle },
            { userEnteredValue: { stringValue: 'Height' }, userEnteredFormat: headerStyle },
            { userEnteredValue: { stringValue: 'Weight' }, userEnteredFormat: headerStyle },
            { userEnteredValue: { stringValue: 'Hometown' }, userEnteredFormat: headerStyle },
            { userEnteredValue: { stringValue: 'State' }, userEnteredFormat: headerStyle },
            { userEnteredValue: { stringValue: 'Gem/Bust' }, userEnteredFormat: headerStyle },
            { userEnteredValue: { stringValue: 'Dev Trait' }, userEnteredFormat: headerStyle },
            { userEnteredValue: { stringValue: 'Prev Team' }, userEnteredFormat: headerStyle }
          ]
        }],
        fields: 'userEnteredValue,userEnteredFormat'
      }
    })

    // Set column widths
    const columnWidths = [150, 70, 70, 140, 80, 70, 70, 70, 60, 60, 120, 50, 70, 70, 80]
    columnWidths.forEach((width, idx) => {
      requests.push({
        updateDimensionProperties: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: idx, endIndex: idx + 1 },
          properties: { pixelSize: width },
          fields: 'pixelSize'
        }
      })
    })

    // Column B: Class dropdown
    requests.push({
      setDataValidation: {
        range: { sheetId, startRowIndex: 1, endRowIndex: totalRows + 1, startColumnIndex: 1, endColumnIndex: 2 },
        rule: {
          condition: { type: 'ONE_OF_LIST', values: RECRUIT_CLASSES.map(v => ({ userEnteredValue: v })) },
          showCustomUi: true, strict: true
        }
      }
    })

    // Column C: Position dropdown
    requests.push({
      setDataValidation: {
        range: { sheetId, startRowIndex: 1, endRowIndex: totalRows + 1, startColumnIndex: 2, endColumnIndex: 3 },
        rule: {
          condition: { type: 'ONE_OF_LIST', values: RECRUIT_POSITIONS.map(v => ({ userEnteredValue: v })) },
          showCustomUi: true, strict: true
        }
      }
    })

    // Column D: Archetype dropdown
    requests.push({
      setDataValidation: {
        range: { sheetId, startRowIndex: 1, endRowIndex: totalRows + 1, startColumnIndex: 3, endColumnIndex: 4 },
        rule: {
          condition: { type: 'ONE_OF_LIST', values: RECRUIT_ARCHETYPES.map(v => ({ userEnteredValue: v })) },
          showCustomUi: true, strict: true
        }
      }
    })

    // Column E: Stars dropdown
    requests.push({
      setDataValidation: {
        range: { sheetId, startRowIndex: 1, endRowIndex: totalRows + 1, startColumnIndex: 4, endColumnIndex: 5 },
        rule: {
          condition: { type: 'ONE_OF_LIST', values: STAR_RATINGS.map(v => ({ userEnteredValue: v })) },
          showCustomUi: true, strict: true
        }
      }
    })

    // Column I: Height dropdown
    requests.push({
      setDataValidation: {
        range: { sheetId, startRowIndex: 1, endRowIndex: totalRows + 1, startColumnIndex: 8, endColumnIndex: 9 },
        rule: {
          condition: { type: 'ONE_OF_LIST', values: HEIGHTS.map(v => ({ userEnteredValue: v })) },
          showCustomUi: true, strict: true
        }
      }
    })

    // Column L: State dropdown
    requests.push({
      setDataValidation: {
        range: { sheetId, startRowIndex: 1, endRowIndex: totalRows + 1, startColumnIndex: 11, endColumnIndex: 12 },
        rule: {
          condition: { type: 'ONE_OF_LIST', values: US_STATES.map(v => ({ userEnteredValue: v })) },
          showCustomUi: true, strict: true
        }
      }
    })

    // Column M: Gem/Bust dropdown
    requests.push({
      setDataValidation: {
        range: { sheetId, startRowIndex: 1, endRowIndex: totalRows + 1, startColumnIndex: 12, endColumnIndex: 13 },
        rule: {
          condition: { type: 'ONE_OF_LIST', values: GEM_BUST_OPTIONS.map(v => ({ userEnteredValue: v })) },
          showCustomUi: true, strict: true
        }
      }
    })

    // Column N: Dev Trait dropdown
    requests.push({
      setDataValidation: {
        range: { sheetId, startRowIndex: 1, endRowIndex: totalRows + 1, startColumnIndex: 13, endColumnIndex: 14 },
        rule: {
          condition: { type: 'ONE_OF_LIST', values: DEV_TRAITS.map(v => ({ userEnteredValue: v })) },
          showCustomUi: true, strict: true
        }
      }
    })

    // Column O: Previous Team dropdown with team abbreviations
    requests.push({
      setDataValidation: {
        range: { sheetId, startRowIndex: 1, endRowIndex: totalRows + 1, startColumnIndex: 14, endColumnIndex: 15 },
        rule: {
          condition: { type: 'ONE_OF_LIST', values: ['', ...teamAbbrs].map(v => ({ userEnteredValue: v })) },
          showCustomUi: true, strict: false // Allow empty for non-transfers
        }
      }
    })

    // Add conditional formatting for Previous Team column (team colors)
    for (const abbr of teamAbbrs) {
      const teamData = teamAbbreviationsData[abbr]
      if (!teamData?.backgroundColor || !teamData?.textColor) continue

      const bgColor = hexToRgb(teamData.backgroundColor)
      const textColor = hexToRgb(teamData.textColor)

      requests.push({
        addConditionalFormatRule: {
          rule: {
            ranges: [{ sheetId, startRowIndex: 1, endRowIndex: totalRows + 1, startColumnIndex: 14, endColumnIndex: 15 }],
            booleanRule: {
              condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: abbr }] },
              format: {
                backgroundColor: { red: bgColor.r / 255, green: bgColor.g / 255, blue: bgColor.b / 255 },
                textFormat: { foregroundColor: { red: textColor.r / 255, green: textColor.g / 255, blue: textColor.b / 255 }, bold: true }
              }
            }
          },
          index: 0
        }
      })
    }

    // Pre-fill existing commitments if any
    if (existingCommitments && existingCommitments.length > 0) {
      const dataRows = existingCommitments.map(recruit => ({
        values: [
          { userEnteredValue: { stringValue: recruit.name || '' } },
          { userEnteredValue: { stringValue: recruit.class || 'HS' } },
          { userEnteredValue: { stringValue: recruit.position || '' } },
          { userEnteredValue: { stringValue: recruit.archetype || '' } },
          { userEnteredValue: { stringValue: starsNumberToSymbol(recruit.stars) } },
          { userEnteredValue: recruit.nationalRank ? { numberValue: recruit.nationalRank } : { stringValue: '' } },
          { userEnteredValue: recruit.stateRank ? { numberValue: recruit.stateRank } : { stringValue: '' } },
          { userEnteredValue: recruit.positionRank ? { numberValue: recruit.positionRank } : { stringValue: '' } },
          { userEnteredValue: { stringValue: recruit.height || '' } },
          { userEnteredValue: recruit.weight ? { numberValue: recruit.weight } : { stringValue: '' } },
          { userEnteredValue: { stringValue: recruit.hometown || '' } },
          { userEnteredValue: { stringValue: recruit.state || '' } },
          { userEnteredValue: { stringValue: recruit.gemBust || '' } },
          { userEnteredValue: { stringValue: recruit.devTrait || 'Normal' } },
          { userEnteredValue: { stringValue: recruit.previousTeam || '' } }
        ]
      }))

      requests.push({
        updateCells: {
          range: { sheetId, startRowIndex: 1, endRowIndex: 1 + existingCommitments.length, startColumnIndex: 0, endColumnIndex: 15 },
          rows: dataRows,
          fields: 'userEnteredValue'
        }
      })
    }

    // Protect header row
    requests.push({
      addProtectedRange: {
        protectedRange: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 15 },
          description: 'Header row - do not edit',
          warningOnly: true
        }
      }
    })

    // Execute all requests
    await fetch(`${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests })
    })

    return {
      spreadsheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
    }
  } catch (error) {
    console.error('Error creating recruiting sheet:', error)
    throw error
  }
}

// Convert star symbols to number
function starsSymbolToNumber(starsStr) {
  if (!starsStr) return 0
  return (starsStr.match(/☆/g) || []).length
}

// Read recruiting commitments from Google Sheet
export async function readRecruitingFromSheet(spreadsheetId) {
  try {
    const accessToken = await getAccessToken()

    const response = await fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/Commitments!A2:O100`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to read recruiting data: ${error.error?.message || 'Unknown error'}`)
    }

    const data = await response.json()
    const rows = data.values || []

    // Parse rows into recruit objects
    const recruits = rows
      .filter(row => row[0] && row[0].trim()) // Must have player name
      .map(row => ({
        name: row[0]?.trim() || '',
        class: row[1]?.trim() || 'HS',
        position: row[2]?.trim() || '',
        archetype: row[3]?.trim() || '',
        stars: starsSymbolToNumber(row[4]),
        nationalRank: row[5] ? parseInt(row[5]) : null,
        stateRank: row[6] ? parseInt(row[6]) : null,
        positionRank: row[7] ? parseInt(row[7]) : null,
        height: row[8]?.trim() || '',
        weight: row[9] ? parseInt(row[9]) : null,
        hometown: row[10]?.trim() || '',
        state: row[11]?.trim() || '',
        gemBust: row[12]?.trim() || '',
        devTrait: row[13]?.trim() || 'Normal',
        previousTeam: row[14]?.trim() || ''
      }))

    return recruits
  } catch (error) {
    console.error('Error reading recruiting data:', error)
    throw error
  }
}
