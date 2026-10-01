import type { Difficulty, Mode, Room, RoomTopic, Skill, TopicId } from './types'

export interface ModeInfo {
  name: string
  short: string
  /** what `room.rounds` counts in this mode */
  unit: string
  blurb: string
  /** one line shown during the countdown */
  how: string
  skill: Skill
  /** one player performs at a time while the others watch */
  turns: boolean
}

export const MODES: Record<Mode, ModeInfo> = {
  vocab: {
    name: 'Vocabulary Battle',
    short: 'Vocabulary',
    unit: 'questions',
    blurb: 'Pick the right meaning faster than everyone else.',
    how: 'Pick the right meaning. Faster answers score more points.',
    skill: 'vocab',
    turns: false,
  },
  listening: {
    name: 'Listening Rush',
    short: 'Listening',
    unit: 'sentences',
    blurb: 'Listen carefully and type exactly what you hear.',
    how: 'Listen to each sentence and type exactly what you hear.',
    skill: 'listening',
    turns: false,
  },
  spotlight: {
    name: 'Spotlight',
    short: 'Spotlight',
    unit: 'turns each',
    blurb: 'One player on stage at a time, typing while everyone watches.',
    how: 'When the light is on you, type the sentence while the whole table watches.',
    skill: 'listening',
    turns: true,
  },
  hotseat: {
    name: 'Hot Seat',
    short: 'Hot Seat',
    unit: 'turns each',
    blurb: 'A rival picks your sentence. Everyone watches you type it.',
    how: 'A rival picks a sentence for you. They earn half of whatever you miss.',
    skill: 'listening',
    turns: true,
  },
  tower: {
    name: 'Tower Climb',
    short: 'Tower',
    unit: 'floors',
    blurb: 'One team, shared lives. Take turns and climb together.',
    how: 'Take turns. A right answer lifts the whole team a floor, a wrong one costs a shared life.',
    skill: 'vocab',
    turns: true,
  },
}

export const MODE_IDS = Object.keys(MODES) as Mode[]

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

export const LEVELS: Difficulty[] = ['easy', 'medium', 'hard']

/** choices for `room.rounds`: questions, turns per player, or floors */
export const ROUND_OPTIONS: Record<Mode, number[]> = {
  vocab: [10, 15, 20],
  listening: [10, 15, 20],
  spotlight: [2, 3, 5],
  hotseat: [2, 3, 5],
  tower: [10, 15, 20],
}
export const ROUND_LABEL: Record<Mode, string> = {
  vocab: 'Rounds',
  listening: 'Rounds',
  spotlight: 'Turns each',
  hotseat: 'Turns each',
  tower: 'Floors',
}
export const SECS_OPTIONS: Record<Mode, number[]> = {
  vocab: [6, 8, 10],
  listening: [15, 20, 30],
  spotlight: [20, 30],
  hotseat: [20, 30],
  tower: [8, 10, 15],
}
export const DEFAULT_SECS: Record<Mode, Record<Difficulty, number>> = {
  vocab: { easy: 10, medium: 8, hard: 6 },
  listening: { easy: 20, medium: 20, hard: 30 },
  spotlight: { easy: 20, medium: 20, hard: 30 },
  hotseat: { easy: 30, medium: 30, hard: 30 },
  tower: { easy: 10, medium: 10, hard: 10 },
}
export const SEAT_OPTIONS: Record<Mode, number[]> = {
  vocab: [2, 3, 4],
  listening: [2, 3, 4],
  spotlight: [3, 4, 5],
  hotseat: [3, 4, 5],
  tower: [2, 3, 4, 5],
}
/** Hot Seat and Tower Climb set their own difficulty turn by turn */
export const HAS_LEVEL: Record<Mode, boolean> = { vocab: true, listening: true, spotlight: true, hotseat: false, tower: false }

// Hot Seat
export const PICK_MS = 10_000
/** what a perfect answer is worth, by the level of the sentence the challenger picked */
export const HOTSEAT_POINTS = [100, 150, 200]
/** share of the missed points that goes to the challenger */
export const STUMP_SHARE = 0.5

// Tower Climb
export const TOWER_LIVES = 3
export const TOWER_MAX_LIVES = 5
/** reaching one of these floors earns the team a life */
export const CHECKPOINT_EVERY = 5
export const BOSS_SECS = 30
/** accuracy needed on the final dictation */
export const BOSS_PASS = 0.8
export const BAND_NAMES = ['Easy', 'Medium', 'Hard', 'Very hard', 'Boss']

/** 0 easy .. 3 very hard, 4 = the boss on the top floor */
export function towerBand(floor: number, top: number) {
  if (floor >= top) return 4
  return Math.min(3, Math.floor(((floor - 1) / (top - 1)) * 4))
}

export const isCheckpoint = (floor: number, top: number) => floor < top && floor % CHECKPOINT_EVERY === 0

/** short progress text for a room that is mid-game */
export function progressLabel(room: Room) {
  const g = room.game
  if (!g || g.phase === 'intro') return 'Starting'
  if (room.mode === 'tower') return `Floor ${Math.min(room.rounds, (g.floor ?? 0) + 1)}/${room.rounds}`
  if (MODES[room.mode].turns) {
    const seats = Math.max(1, g.order?.length ?? room.players.length)
    return `Round ${Math.min(room.rounds, Math.floor(g.round / seats) + 1)}/${room.rounds}`
  }
  return `Round ${g.round + 1}/${room.rounds}`
}

export const INTRO_MS = 5000
export const REVEAL_MS: Record<Mode, number> = { vocab: 3200, listening: 5500, spotlight: 5200, hotseat: 5200, tower: 3000 }
/** once everyone has answered the round wraps up after this long */
export const ALL_IN_MS = 700
export const MAX_REPLAYS = 2
export const REPLAY_COST = 5

export const TTS_RATE: Record<Difficulty, number> = { easy: 0.82, medium: 0.94, hard: 1.02 }

/** rough estimate of how long a sentence takes to hear */
export function speechMs(text: string, difficulty: Difficulty) {
  return (250 + text.length * 52) / TTS_RATE[difficulty]
}

const COMMON_REACTIONS = ['Good luck!', 'Nice!', 'Awesome!', 'Wow!', 'So close!', 'Too fast!', 'Oops', 'Well played', 'GG!', 'One more round?']
const STAGE_REACTIONS = ['You got this!', 'No pressure', 'Nice!', 'Wow!', 'So close!', 'Ouch', 'Too easy', 'Tough one', 'GG!', 'One more round?']
const TOWER_REACTIONS = ['You got this!', 'No pressure', "Don't mess this up", "Let's go!", 'Nice!', 'Phew', 'So close!', 'It happens', 'GG!', 'One more climb?']

export const REACTIONS: Record<Mode, string[]> = {
  vocab: COMMON_REACTIONS,
  listening: COMMON_REACTIONS,
  spotlight: STAGE_REACTIONS,
  hotseat: STAGE_REACTIONS,
  tower: TOWER_REACTIONS,
}
