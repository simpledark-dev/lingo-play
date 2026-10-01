export type Mode = 'vocab' | 'listening' | 'spotlight' | 'hotseat' | 'tower'
/** what a game trains; every mode feeds one of these two ratings */
export type Skill = 'vocab' | 'listening'
export type Difficulty = 'easy' | 'medium' | 'hard'
export type TopicId = 'family' | 'nature' | 'transport' | 'food' | 'travel' | 'daily'
export type RoomTopic = TopicId | 'random'
export type Country = 'vn' | 'jp' | 'th' | 'id' | 'kr' | 'fr' | 'de' | 'us'

export interface RecentGame {
  roomId: number
  mode: Mode
  at: number
  place: number
  of: number
  score: number
  delta: number
  /** best-placed opponent */
  oppId: string
  oppScore: number
}

export interface Player {
  id: string
  name: string
  country: Country
  avatar: number
  bot: boolean
  rating: number
  peak: number
  skills: Record<Skill, number>
  games: number
  wins: number
  losses: number
  streak: number
  bestStreak: number
  joined: number
  bio: string
  online: boolean
  roomId: number | null
  role: 'player' | 'spectator' | null
  /** rating after each of the last N games */
  history: number[]
  recent: RecentGame[]
  lastDelta: number
  // bot behaviour
  ability: number
  speed: number
  chatty: number
  /** next time this bot makes a decision (or stops watching) */
  nextAt: number
  /** when the current online/offline session flips */
  sessionEnd: number
}

export interface Answer {
  /** ms from round start */
  t: number
  /** choice index for vocab, typed text for listening, null = no answer */
  v: number | string | null
  ok: boolean
  /** 0..1 accuracy */
  acc: number
  pts: number
  replays: number
}

/** a stretch of typing (or backspacing): the character count moves linearly to `c` between t0 and t1 */
export interface TypingSeg {
  t0: number
  t1: number
  c: number
}

export interface Plan {
  startAt: number
  at: number
  v: number | string
  /** listening only: how the typing unfolds, with pauses between the stretches */
  segs?: TypingSeg[]
}

/**
 * One turn of a turn-based game (Spotlight, Hot Seat, Tower Climb): a single player performs
 * while the rest of the table watches.
 */
export interface Turn {
  /** the player on stage */
  pid: string
  kind: 'listen' | 'vocab'
  /** 0 easy, 1 medium, 2 hard, 3 very hard: drives bot accuracy, speech speed and points */
  level: number
  secs: number
  /** the sentence to type; in Hot Seat it is only set once the challenger has picked */
  text?: string
  vq?: VocabQuestion
  // Hot Seat
  picker?: string
  options?: { text: string; level: number }[]
  picked?: number
  /** points the challenger earned for what the player missed */
  bonus?: number
  // Tower Climb
  /** the floor this turn is trying to reach */
  floor?: number
  boss?: boolean
  passed?: boolean
  /** the team earned a life by reaching a checkpoint */
  gained?: boolean
  /** the player left before finishing the turn */
  void?: boolean
}

export interface Game {
  round: number
  phase: 'intro' | 'pick' | 'question' | 'reveal'
  start: number
  end: number
  scores: Record<string, number>
  answers: Record<string, Answer>[]
  plans: Record<string, Plan>
  /** players who forfeited mid-game */
  left: string[]
  /** replays used by the human this round */
  replays: number
  // turn-based modes only
  turns?: Turn[]
  /** seating order the turns rotate through */
  order?: string[]
  /** Tower Climb: floors cleared so far and shared lives left */
  floor?: number
  lives?: number
}

export interface Reaction {
  id: number
  pid: string
  text: string
  at: number
}

export interface GameResult {
  at: number
  order: string[]
  scores: Record<string, number>
  correct: Record<string, number>
  deltas: Record<string, number>
  before: Record<string, number>
  /** turns each player took (turn-based modes) */
  turns?: Record<string, number>
  /** Tower Climb outcome: the team wins or loses together */
  tower?: { won: boolean; floor: number; top: number }
}

export interface Room {
  id: number
  mode: Mode
  topic: RoomTopic
  difficulty: Difficulty
  rounds: number
  secs: number
  max: number
  host: string
  players: string[]
  spectators: string[]
  status: 'waiting' | 'playing' | 'finished'
  created: number
  /** planned start for bot-hosted rooms; null = host starts manually */
  startAt: number | null
  nextJoinAt: number
  seed: number
  game: Game | null
  result: GameResult | null
  reactions: Reaction[]
  queue: { at: number; pid: string; text: string }[]
  closeAt: number | null
  priv: boolean
  invited: { pid: string; at: number }[]
  played: number
}

export interface Invite {
  id: number
  roomId: number
  from: string
  at: number
}

export interface World {
  v: number
  meId: string | null
  players: Record<string, Player>
  rooms: Record<number, Room>
  nextRoomId: number
  nextId: number
  lastTick: number
  nextSpawnAt: number
  nextInviteAt: number
  targetRooms: number
  friends: string[]
  friendReqs: { pid: string; at: number }[]
  invites: Invite[]
}

export interface VocabQuestion {
  kind: 'en-vi' | 'vi-en'
  prompt: string
  choices: string[]
  answer: number
  en: string
  vi: string
}

export interface ListeningQuestion {
  text: string
}
