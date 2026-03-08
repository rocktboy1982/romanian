/**
 * Profanity filter for Romanian and English content.
 * Checks text against blocklists with leet-speak normalization.
 */

// Normalize leet speak and common obfuscation
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/8/g, 'b')
    .replace(/\$/g, 's')
    .replace(/@/g, 'a')
    .replace(/\*/g, '')
    .replace(/[_\-\.]/g, '')
    // Strip diacritics for matching (keep original for display)
    .replace(/[ăâ]/g, 'a')
    .replace(/[îì]/g, 'i')
    .replace(/[șş]/g, 's')
    .replace(/[țţ]/g, 't')
}

// English profanity list (common slurs, vulgarities)
const ENGLISH_BLOCKLIST: string[] = [
  // Strong profanity
  'fuck', 'fucker', 'fucking', 'fucked', 'motherfucker', 'motherfucking',
  'shit', 'shitty', 'bullshit', 'horseshit', 'dipshit', 'shithead',
  'ass', 'asshole', 'arsehole', 'dumbass', 'jackass', 'fatass', 'badass',
  'bitch', 'bitchy', 'bitches', 'sonofabitch',
  'damn', 'damned', 'goddamn', 'goddamned',
  'dick', 'dickhead',
  'cock', 'cocksucker',
  'cunt',
  'bastard', 'bastards',
  'whore', 'slut', 'skank', 'tramp',
  'piss', 'pissed', 'pissing',
  'crap', 'crappy',
  'twat', 'wanker', 'tosser', 'bellend',
  'retard', 'retarded',
  'nigger', 'nigga', 'negro',
  'faggot', 'fag', 'dyke',
  'spic', 'chink', 'gook', 'kike', 'wetback',
  'nazi', 'hitler',
  // Milder but still filtered for a food platform
  'stfu', 'gtfo', 'lmfao',
  'boob', 'boobs', 'tits', 'titties',
  'penis', 'vagina', 'dildo',
  'porn', 'pornography', 'hentai',
]

// Romanian profanity list
const ROMANIAN_BLOCKLIST: string[] = [
  // Strong Romanian profanity (all diacritics variants handled by normalize())
  'cacat', 'cacatul', 'cacatilor',
  'pula', 'pulii', 'pulamea',
  'pizda', 'pizdii', 'pizdele',
  'futui', 'fute', 'futere', 'futut', 'futu', 'fututi',
  'muie', 'muist', 'muista',
  'cur', 'curul', 'curva', 'curve', 'curvelor',
  'coaie', 'coaiele',
  'dracu', 'dracului', 'dracie',
  'rahat', 'rahatul',
  'bulangiu', 'bulangii',
  'nenorocit', 'nenorocitule', 'nenorocitilor',
  'idiot', 'idioti', 'idioata', 'idiotule',
  'imbecil', 'imbecili', 'imbecilul',
  'cretin', 'cretini', 'cretinul',
  'handicapat', 'handicapati',
  'tigan', 'tiganca', 'tigani', 'tiganilor',
  'jigodie', 'jigodii',
  'porc', 'porcule', 'porci',
  'bou', 'boule', 'boi',
  'sugator', 'sugipula',
  'labagiu', 'labagii',
  'pisat', 'pisatul',
  'scursura', 'scursuri',
  'gunoi', 'gunoiule',
  'javra', 'javre',
  'tarfa', 'tarfe',
  'nesimtit', 'nesimtitule', 'nesimtiti',
  'prostie', 'prostii', 'prostul', 'proasta',
  'tampit', 'tampitule', 'tampiti',
]

// Build regex patterns from blocklists
// Match whole words using word boundaries
function buildPattern(words: string[]): RegExp {
  const escaped = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  return new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi')
}

const EN_PATTERN = buildPattern(ENGLISH_BLOCKLIST)
const RO_PATTERN = buildPattern(ROMANIAN_BLOCKLIST)

export interface ProfanityResult {
  isProfane: boolean
  matches: string[]
  cleanText: string
}

/**
 * Check if text contains profanity (Romanian or English).
 * Returns detected matches and a censored version of the text.
 */
export function checkProfanity(text: string): ProfanityResult {
  if (!text || typeof text !== 'string') {
    return { isProfane: false, matches: [], cleanText: text || '' }
  }

  const normalized = normalize(text)
  const matches: string[] = []

  // Check English
  let match: RegExpExecArray | null
  EN_PATTERN.lastIndex = 0
  while ((match = EN_PATTERN.exec(normalized)) !== null) {
    if (!matches.includes(match[1].toLowerCase())) {
      matches.push(match[1].toLowerCase())
    }
  }

  // Check Romanian
  RO_PATTERN.lastIndex = 0
  while ((match = RO_PATTERN.exec(normalized)) !== null) {
    if (!matches.includes(match[1].toLowerCase())) {
      matches.push(match[1].toLowerCase())
    }
  }

  // Build censored text (replace matched words with asterisks)
  let cleanText = text
  if (matches.length > 0) {
    for (const word of matches) {
      const censorRegex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
      cleanText = cleanText.replace(censorRegex, '*'.repeat(word.length))
    }
  }

  return {
    isProfane: matches.length > 0,
    matches,
    cleanText,
  }
}

/**
 * Validate text and return error message if profane.
 * Returns null if text is clean.
 */
export function validateContent(text: string): string | null {
  const result = checkProfanity(text)
  if (result.isProfane) {
    return 'Conținutul include limbaj nepotrivit. Vă rugăm să reformulați.'
  }
  return null
}
