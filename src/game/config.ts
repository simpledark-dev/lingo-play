import type { Difficulty, Mode, RoomTopic, TopicId } from './types'

export const MODES: Record<Mode, { name: string; short: string; unit: string; blurb: string }> = {
  vocab: {
    name: 'Vocabulary Battle',
    short: 'Vocabulary',
    unit: 'questions',
    blurb: 'Pick the right meaning faster than everyone else.',
  },
  listening: {
    name: 'Listening Rush',
    short: 'Listening',
    unit: 'sentences',
    blurb: 'Listen carefully and type exactly what you hear.',
  },
}

export const TOPIC_IDS: TopicId[] = ['family', 'nature', 'transport', 'food', 'travel', 'daily']

export const TOPICS: Record<RoomTopic, string> = {
  random: 'Random',
  family: 'Family',
  nature: 'Nature',
  transport: 'Transportation',
  food: 'Food & Drink',
  travel: 'Travel',
  daily: 'Daily Life',
}

export const DIFFICULTIES: Record<Difficulty, { name: string; level: number }> = {
  easy: { name: 'Easy', level: 950 },
  medium: { name: 'Medium', level: 1250 },
  hard: { name: 'Hard', level: 1550 },
}

export const ROUND_OPTIONS = [10, 15, 20]
export const SECS_OPTIONS: Record<Mode, number[]> = { vocab: [6, 8, 10], listening: [15, 20, 30] }
export const DEFAULT_SECS: Record<Mode, Record<Difficulty, number>> = {
  vocab: { easy: 10, medium: 8, hard: 6 },
  listening: { easy: 20, medium: 20, hard: 30 },
}

export const INTRO_MS = 5000
export const REVEAL_MS: Record<Mode, number> = { vocab: 3200, listening: 5500 }
/** once everyone has answered the round wraps up after this long */
export const ALL_IN_MS = 700
export const MAX_REPLAYS = 2
export const REPLAY_COST = 5

export const TTS_RATE: Record<Difficulty, number> = { easy: 0.82, medium: 0.94, hard: 1.02 }

/** rough estimate of how long a sentence takes to hear */
export function speechMs(text: string, difficulty: Difficulty) {
  return (250 + text.length * 52) / TTS_RATE[difficulty]
}

export const REACTIONS = [
  'Good luck!',
  'Nice!',
  'Awesome!',
  'Wow!',
  'So close!',
  'Too fast!',
  'Oops',
  'Well played',
  'GG!',
  'One more round?',
]
