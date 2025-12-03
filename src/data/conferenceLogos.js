// ESPN Conference Logo Mapping for College Football
// Data sourced from ESPN API and CDN
// Last updated: 2025-12-03

// Conference IDs used by ESPN API
export const espnConferenceIds = {
  "ACC": 1,
  "American": 151,
  "Big 12": 4,
  "Big Ten": 5,
  "CUSA": 12,
  "MAC": 15,
  "MWC": 17,
  "Pac-12": 9,
  "SEC": 8,
  "Sun Belt": 37
}

// Conference logo slugs for ESPN CDN
const conferenceLogoSlugs = {
  "ACC": "acc",
  "American": "american",
  "Big 12": "big_12",
  "Big Ten": "big_ten",
  "CUSA": "conference_usa",
  "MAC": "mac",
  "MWC": "mountain_west",
  "Pac-12": "pac_12",
  "SEC": "sec",
  "Sun Belt": "sun_belt"
}

// Helper function to get conference logo URL
// ESPN logo URL pattern: https://a.espncdn.com/i/teamlogos/ncaa_conf/500/{slug}.png
export function getConferenceLogo(conferenceName) {
  const slug = conferenceLogoSlugs[conferenceName]
  if (!slug) return null
  return `https://a.espncdn.com/i/teamlogos/ncaa_conf/500/${slug}.png`
}

// Helper function to get conference ID
export function getConferenceId(conferenceName) {
  return espnConferenceIds[conferenceName]
}

// Export list of conference names
export const conferences = Object.keys(espnConferenceIds)
