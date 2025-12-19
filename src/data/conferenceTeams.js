// Team to Conference mapping for FBS
// Conference assignments as of 2024-2025 season

export const conferenceTeams = {
  "ACC": [
    "BC", "CAL", "CLEM", "DUKE", "FSU", "GT", "LOU", "MIA", "NCST", "UNC", "PITT", "SMU", "SYR", "STAN", "UVA", "VT", "WAKE"
  ],
  "Big Ten": [
    "ILL", "IU", "IOWA", "UMD", "MICH", "MSU", "MINN", "NEB", "NU", "OSU", "ORE", "PSU", "PUR", "RUTG", "UCLA", "USC", "WASH", "WIS"
  ],
  "Big 12": [
    "ARIZ", "ASU", "BU", "BYU", "UC", "COLO", "UH", "ISU", "KU", "KSU", "OKST", "TCU", "TTU", "UCF", "UTAH", "WVU"
  ],
  "SEC": [
    "BAMA", "ARK", "AUB", "FLA", "UGA", "UK", "LSU", "MISS", "MSST", "MIZ", "OU", "SCAR", "UT", "TEX", "TAMU", "VAN"
  ],
  "Pac-12": [
    "ORST", "WSU"
  ],
  "American": [
    "ARMY", "CHAR", "ECU", "FAU", "MEM", "NAVY", "UNT", "RICE", "TEM", "TULN", "TLSA", "UAB", "USF", "UTSA"
  ],
  "Mountain West": [
    "AFA", "BOIS", "CSU", "FRES", "HAW", "NEV", "SDSU", "SJSU", "UNM", "UNLV", "USU", "WYO"
  ],
  "Sun Belt": [
    "APP", "ARST", "CCU", "GASO", "GSU", "JMU", "JKST", "ULM", "UL", "MRSH", "ODU", "USA", "USM", "TXST", "TROY"
  ],
  "MAC": [
    "AKR", "BALL", "BGSU", "BUFF", "CMU", "EMU", "KENT", "M-OH", "NIU", "OHIO", "TOL", "WMU"
  ],
  "Conference USA": [
    "DEL", "FIU", "KENN", "LIB", "LT", "MTSU", "MZST", "NMSU", "SHSU", "UTEP", "WKU"
  ],
  "Independent": [
    "ND", "CONN", "MASS"
  ]
}

// Get conference for a team abbreviation
export function getTeamConference(abbr) {
  for (const [conference, teams] of Object.entries(conferenceTeams)) {
    if (teams.includes(abbr)) {
      return conference
    }
  }
  return null
}

// Get all teams in a conference
export function getConferenceTeamsList(conference) {
  return conferenceTeams[conference] || []
}

// Get all conferences
export function getAllConferences() {
  return Object.keys(conferenceTeams)
}
