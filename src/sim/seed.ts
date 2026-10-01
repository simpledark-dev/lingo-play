import { BIOS, botIdentities, guestName } from '../data/names'
import type { Country, Mode, Player, RecentGame, World } from '../game/types'
import { chance, clamp, gauss, mulberry32, pick, rand, randInt } from '../lib/rng'

export const BOT_COUNT = 230
export const ONLINE_SHARE = 0.72
const DAY = 86_400_000
const MIN = 60_000

export const onlineSession = () => rand(12 * MIN, 55 * MIN)
export const offlineSession = () => rand(4 * MIN, 22 * MIN)

function ratingHistory(rating: number, n: number) {
  const h = new Array<number>(n)
  h[n - 1] = rating
  const drift = rand(-2.5, 4)
  for (let i = n - 2; i >= 0; i--) h[i] = Math.round(clamp(h[i + 1] - drift - gauss() * 13, 400, 2400))
  return h
}

function makeBot(id: string, name: string, country: Country, now: number): Player {
  const rating = Math.round(clamp(1240 + gauss() * 235, 720, 2190))
  const games = Math.round(clamp(25 + Math.random() ** 2 * 700 + Math.max(0, rating - 1200) * 0.7, 12, 1800))
  const winRate = clamp(0.5 + (rating - 1250) / 2400 + gauss() * 0.04, 0.28, 0.79)
  const wins = Math.round(games * winRate)
  const streak = chance(0.22) ? 0 : Math.round(Math.random() ** 2.4 * 180) + 1
  const history = ratingHistory(rating, 30)
  const online = chance(ONLINE_SHARE)
  return {
    id,
    name,
    country,
    avatar: randInt(1, 2 ** 30),
    bot: true,
    rating,
    peak: Math.max(...history) + randInt(0, 40),
    skills: {
      vocab: Math.round(rating + gauss() * 45),
      listening: Math.round(rating + gauss() * 45),
    },
    games,
    wins,
    losses: games - wins,
    streak,
    bestStreak: streak + (chance(0.5) ? 0 : randInt(1, 70)),
    joined: now - randInt(20, 900) * DAY,
    bio: pick(BIOS),
    online,
    roomId: null,
    role: null,
    history,
    recent: [],
    lastDelta: history[29] - history[28],
    ability: rating + gauss() * 70,
    speed: clamp(1 + gauss() * 0.14, 0.7, 1.35),
    chatty: Math.random() ** 1.6,
    nextAt: now + rand(0, 40_000),
    sessionEnd: now + (online ? onlineSession() : offlineSession()) * Math.random(),
  }
}

/** a believable back-catalogue so a profile never looks empty */
function fakeRecent(p: Player, ids: string[], now: number) {
  const out: RecentGame[] = []
  let at = now - rand(20 * MIN, 5 * 60 * MIN)
  const n = randInt(5, 8)
  for (let i = 0; i < n; i++) {
    const mode: Mode = chance(0.55) ? 'vocab' : 'listening'
    const of = pick([2, 2, 3, 4, 4])
    const idx = 29 - i
    const delta = p.history[idx] - p.history[idx - 1]
    const place = delta > 0 ? 1 : randInt(2, of)
    const rounds = pick([10, 15, 20])
    const score = Math.round(rounds * rand(62, 118))
    let oppId = pick(ids)
    while (oppId === p.id) oppId = pick(ids)
    out.push({
      roomId: randInt(100, 480),
      mode,
      at,
      place,
      of,
      score,
      delta,
      oppId,
      oppScore: Math.round(place === 1 ? score * rand(0.7, 0.97) : score * rand(1.03, 1.3)),
    })
    at -= rand(8 * MIN, 9 * 60 * MIN)
  }
  return out
}

export function createWorld(now: number): World {
  const r = mulberry32((Math.random() * 2 ** 31) | 0)
  const players: Record<string, Player> = {}
  const ids: string[] = []
  botIdentities(BOT_COUNT, r).forEach((ident, i) => {
    const id = `b${i}`
    players[id] = makeBot(id, ident.name, ident.country, now)
    ids.push(id)
  })
  // a handful of standouts so the top of the leaderboard has Masters and a Grandmaster
  const top = ids.slice().sort((a, b) => players[b].rating - players[a].rating)
  ;[330, 250, 200, 150, 110, 80, 50, 30].forEach((boost, i) => {
    const p = players[top[i]]
    p.history = p.history.map((h) => h + boost)
    p.rating += boost
    p.peak += boost
    p.ability += boost
    p.skills.vocab += boost
    p.skills.listening += boost
    p.games += boost * 2
    p.wins += Math.round(boost * 1.4)
    p.losses = p.games - p.wins
  })
  for (const id of ids) players[id].recent = fakeRecent(players[id], ids, now)
  return {
    v: 1,
    meId: null,
    players,
    rooms: {},
    nextRoomId: randInt(480, 520),
    nextId: 1,
    lastTick: now,
    nextSpawnAt: now,
    nextInviteAt: now + rand(50_000, 90_000),
    targetRooms: 40,
    friends: [],
    friendReqs: [],
    invites: [],
  }
}

export function createGuest(now: number): Player {
  return {
    id: 'me',
    name: guestName(),
    country: 'vn',
    avatar: randInt(1, 2 ** 30),
    bot: false,
    rating: 1200,
    peak: 1200,
    skills: { vocab: 1200, listening: 1200 },
    games: 0,
    wins: 0,
    losses: 0,
    streak: 1,
    bestStreak: 1,
    joined: now,
    bio: '',
    online: true,
    roomId: null,
    role: null,
    history: [1200],
    recent: [],
    lastDelta: 0,
    ability: 1200,
    speed: 1,
    chatty: 0,
    nextAt: 0,
    sessionEnd: 0,
  }
}
