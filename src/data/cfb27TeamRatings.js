// CFB 27 launch team ratings (OVR / Offense / Defense), keyed by tid.
//
// Source: "CFB27 Team Ratings - Base Launch.xlsx" (All Teams sheet), parsed once
// and resolved to tids offline so there is no runtime name matching. Covers all
// 138 FBS teams (tids 1-136, 142-143); the five generic FCS placeholders
// (137-141) have no launch rating and are intentionally absent.
//
// Seeded into a CFB 27 dynasty's START YEAR only, at creation
// (teams[tid].byYear[startYear].teamRatings). Because team ratings are
// year-keyed, these display on day one and naturally clear when the season
// advances to the next year (which has no seeded entry) — the user maintains
// ratings themselves from year two on.
export const CFB27_TEAM_RATINGS = {
  1: { ovr: 74, off: 76, def: 72 }, // Air Force Falcons
  2: { ovr: 73, off: 75, def: 72 }, // Akron Zips
  3: { ovr: 73, off: 72, def: 75 }, // Appalachian State Mountaineers
  4: { ovr: 82, off: 82, def: 82 }, // Arizona Wildcats
  5: { ovr: 80, off: 80, def: 81 }, // Arkansas Razorbacks
  6: { ovr: 76, off: 77, def: 75 }, // Army Black Knights
  7: { ovr: 74, off: 77, def: 71 }, // Arkansas State Red Wolves
  8: { ovr: 81, off: 78, def: 83 }, // Arizona State Sun Devils
  9: { ovr: 83, off: 86, def: 80 }, // Auburn Tigers
  10: { ovr: 72, off: 72, def: 73 }, // Ball State Cardinals
  11: { ovr: 86, off: 82, def: 89 }, // Alabama Crimson Tide
  12: { ovr: 77, off: 77, def: 78 }, // Boston College Eagles
  13: { ovr: 72, off: 70, def: 75 }, // Bowling Green Falcons
  14: { ovr: 80, off: 82, def: 78 }, // Boise State Broncos
  15: { ovr: 79, off: 78, def: 80 }, // Baylor Bears
  16: { ovr: 72, off: 71, def: 73 }, // Buffalo Bulls
  17: { ovr: 86, off: 86, def: 86 }, // Brigham Young Cougars
  18: { ovr: 81, off: 85, def: 78 }, // California Golden Bears
  19: { ovr: 72, off: 71, def: 73 }, // Coastal Carolina Chanticleers
  20: { ovr: 72, off: 72, def: 72 }, // Charlotte 49ers
  21: { ovr: 83, off: 80, def: 86 }, // Clemson Tigers
  22: { ovr: 72, off: 73, def: 71 }, // Central Michigan Chippewas
  23: { ovr: 81, off: 81, def: 82 }, // Colorado Buffaloes
  24: { ovr: 74, off: 73, def: 75 }, // Connecticut Huskies
  25: { ovr: 74, off: 73, def: 75 }, // Colorado State Rams
  26: { ovr: 75, off: 77, def: 73 }, // Delaware Fightin' Blue Hens
  27: { ovr: 79, off: 82, def: 77 }, // Duke Blue Devils
  28: { ovr: 74, off: 75, def: 73 }, // East Carolina Pirates
  29: { ovr: 73, off: 75, def: 72 }, // Eastern Michigan Eagles
  30: { ovr: 76, off: 78, def: 75 }, // Florida Atlantic Owls
  31: { ovr: 73, off: 73, def: 75 }, // Florida International Panthers
  32: { ovr: 84, off: 84, def: 83 }, // Florida Gators
  33: { ovr: 76, off: 76, def: 77 }, // Fresno State Bulldogs
  34: { ovr: 82, off: 83, def: 81 }, // Florida State Seminoles
  35: { ovr: 76, off: 76, def: 76 }, // Georgia Southern Eagles
  36: { ovr: 73, off: 75, def: 71 }, // Georgia State Panthers
  37: { ovr: 78, off: 78, def: 78 }, // Georgia Tech Yellow Jackets
  38: { ovr: 76, off: 77, def: 76 }, // Hawaii Rainbow Warriors
  39: { ovr: 79, off: 81, def: 77 }, // Illinois Fighting Illini
  40: { ovr: 80, off: 81, def: 78 }, // Iowa Hawkeyes
  41: { ovr: 77, off: 77, def: 77 }, // Iowa State Cyclones
  42: { ovr: 90, off: 90, def: 90 }, // Indiana Hoosiers
  43: { ovr: 76, off: 76, def: 77 }, // Jacksonville State Gamecocks
  44: { ovr: 77, off: 77, def: 76 }, // James Madison Dukes
  45: { ovr: 75, off: 73, def: 76 }, // Kennesaw State Owls
  46: { ovr: 72, off: 73, def: 70 }, // Kent State Golden Flashes
  47: { ovr: 81, off: 83, def: 80 }, // Kansas State Wildcats
  48: { ovr: 77, off: 77, def: 77 }, // Kansas Jayhawks
  49: { ovr: 76, off: 77, def: 76 }, // Liberty Flames
  50: { ovr: 84, off: 85, def: 82 }, // Louisville Cardinals
  51: { ovr: 88, off: 89, def: 87 }, // LSU Tigers
  52: { ovr: 74, off: 76, def: 72 }, // Louisiana Tech Bulldogs
  53: { ovr: 76, off: 75, def: 77 }, // Miami Redhawks
  54: { ovr: 71, off: 71, def: 72 }, // Massachusetts Minutemen
  55: { ovr: 77, off: 77, def: 77 }, // Memphis Tigers
  56: { ovr: 88, off: 90, def: 86 }, // Miami Hurricanes
  57: { ovr: 85, off: 85, def: 85 }, // Michigan Wolverines
  58: { ovr: 81, off: 82, def: 81 }, // Minnesota Golden Gophers
  59: { ovr: 88, off: 88, def: 87 }, // Ole Miss Rebels
  60: { ovr: 85, off: 88, def: 82 }, // Missouri Tigers
  61: { ovr: 75, off: 78, def: 72 }, // Marshall Thundering Herd
  62: { ovr: 81, off: 81, def: 82 }, // Mississippi State Bulldogs
  63: { ovr: 80, off: 80, def: 81 }, // Michigan State Spartans
  64: { ovr: 72, off: 73, def: 72 }, // Middle Tennessee State Blue Raiders
  65: { ovr: 72, off: 73, def: 72 }, // Missouri State Bears
  66: { ovr: 74, off: 75, def: 73 }, // Navy Midshipmen
  67: { ovr: 79, off: 81, def: 77 }, // North Carolina State Wolfpack
  68: { ovr: 89, off: 88, def: 90 }, // Notre Dame Fighting Irish
  69: { ovr: 83, off: 85, def: 82 }, // Nebraska Cornhuskers
  70: { ovr: 73, off: 73, def: 73 }, // Nevada Wolf Pack
  71: { ovr: 70, off: 72, def: 68 }, // Northern Illinois Huskies
  72: { ovr: 73, off: 71, def: 76 }, // New Mexico State Aggies
  73: { ovr: 79, off: 80, def: 78 }, // Northwestern Wildcats
  74: { ovr: 74, off: 72, def: 77 }, // Old Dominion Monarchs
  75: { ovr: 74, off: 71, def: 77 }, // Ohio Bobcats
  76: { ovr: 83, off: 85, def: 81 }, // Oklahoma State Cowboys
  77: { ovr: 91, off: 91, def: 91 }, // Oregon Ducks
  78: { ovr: 76, off: 76, def: 77 }, // Oregon State Beavers
  79: { ovr: 90, off: 92, def: 88 }, // Ohio State Buckeyes
  80: { ovr: 87, off: 87, def: 88 }, // Oklahoma Sooners
  81: { ovr: 81, off: 81, def: 81 }, // Pittsburgh Panthers
  82: { ovr: 83, off: 86, def: 81 }, // Penn State Nittany Lions
  83: { ovr: 77, off: 78, def: 77 }, // Purdue Boilermakers
  84: { ovr: 72, off: 72, def: 73 }, // Rice Owls
  85: { ovr: 78, off: 80, def: 77 }, // Rutgers Scarlet Knights
  86: { ovr: 82, off: 83, def: 82 }, // South Carolina Gamecocks
  87: { ovr: 77, off: 78, def: 76 }, // San Diego State Aztecs
  88: { ovr: 71, off: 72, def: 71 }, // Sam Houston State Bearkats
  89: { ovr: 72, off: 73, def: 70 }, // San Jose State Spartans
  90: { ovr: 83, off: 87, def: 80 }, // SMU Mustangs
  91: { ovr: 76, off: 75, def: 78 }, // Stanford Cardinal
  92: { ovr: 78, off: 77, def: 80 }, // Syracuse Orange
  93: { ovr: 86, off: 86, def: 86 }, // Texas A&M Aggies
  94: { ovr: 80, off: 81, def: 78 }, // TCU Horned Frogs
  95: { ovr: 76, off: 80, def: 72 }, // Temple Owls
  96: { ovr: 89, off: 90, def: 88 }, // Texas Longhorns
  97: { ovr: 76, off: 75, def: 78 }, // Tulsa Golden Hurricane
  98: { ovr: 73, off: 75, def: 71 }, // Toledo Rockets
  99: { ovr: 73, off: 73, def: 73 }, // Troy Trojans
  100: { ovr: 87, off: 85, def: 90 }, // Texas Tech Red Raiders
  101: { ovr: 76, off: 75, def: 76 }, // Tulane Green Wave
  102: { ovr: 77, off: 78, def: 75 }, // Texas State Bobcats
  103: { ovr: 73, off: 76, def: 71 }, // UAB Blazers
  104: { ovr: 79, off: 80, def: 77 }, // Cincinnati Bearcats
  105: { ovr: 81, off: 82, def: 80 }, // UCF Knights
  106: { ovr: 82, off: 83, def: 81 }, // UCLA Bruins
  107: { ovr: 87, off: 85, def: 89 }, // Georgia Bulldogs
  108: { ovr: 83, off: 85, def: 80 }, // Houston Cougars
  109: { ovr: 81, off: 82, def: 80 }, // Kentucky Wildcats
  110: { ovr: 73, off: 73, def: 72 }, // Lafayette Ragin' Cajuns
  111: { ovr: 69, off: 71, def: 68 }, // Monroe Warhawks
  112: { ovr: 80, off: 81, def: 80 }, // Maryland Terrapins
  113: { ovr: 79, off: 78, def: 80 }, // North Carolina Tar Heels
  114: { ovr: 78, off: 80, def: 77 }, // UNLV Rebels
  115: { ovr: 76, off: 77, def: 76 }, // New Mexico Lobos
  116: { ovr: 77, off: 78, def: 77 }, // North Texas Mean Green
  117: { ovr: 72, off: 73, def: 72 }, // South Alabama Jaguars
  118: { ovr: 86, off: 87, def: 85 }, // USC Trojans
  119: { ovr: 77, off: 77, def: 77 }, // South Florida Bulls
  120: { ovr: 71, off: 71, def: 70 }, // Southern Mississippi Golden Eagles
  121: { ovr: 76, off: 76, def: 77 }, // Utah State Aggies
  122: { ovr: 85, off: 85, def: 85 }, // Tennessee Volunteers
  123: { ovr: 81, off: 83, def: 78 }, // Utah Utes
  124: { ovr: 72, off: 73, def: 71 }, // UTEP Miners
  125: { ovr: 76, off: 80, def: 72 }, // UTSA Roadrunners
  126: { ovr: 83, off: 82, def: 83 }, // Virginia Cavaliers
  127: { ovr: 81, off: 80, def: 82 }, // Vanderbilt Commodores
  128: { ovr: 81, off: 81, def: 81 }, // Virginia Tech Hokies
  129: { ovr: 78, off: 77, def: 80 }, // Wake Forest Demon Deacons
  130: { ovr: 83, off: 85, def: 81 }, // Washington Huskies
  131: { ovr: 79, off: 80, def: 78 }, // Wisconsin Badgers
  132: { ovr: 73, off: 75, def: 71 }, // Western Kentucky Hilltoppers
  133: { ovr: 75, off: 77, def: 73 }, // Western Michigan Broncos
  134: { ovr: 76, off: 78, def: 73 }, // Washington State Cougars
  135: { ovr: 78, off: 81, def: 76 }, // West Virginia Mountaineers
  136: { ovr: 73, off: 73, def: 72 }, // Wyoming Cowboys
  142: { ovr: 75, off: 75, def: 75 }, // North Dakota State Bison
  143: { ovr: 72, off: 73, def: 72 }, // Sacramento State Hornets
}

export default CFB27_TEAM_RATINGS
