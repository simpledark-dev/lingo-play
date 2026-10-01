import {
  ALL_IN_MS,
  DEFAULT_SECS,
  DIFFICULTIES,
  INTRO_MS,
  REVEAL_MS,
  ROUND_OPTIONS,
  SECS_OPTIONS,
  TOPIC_IDS,
  speechMs,
} from '../game/config'
import { listeningQ, vocabQ } from '../game/questions'
import { diffWords, eloDeltas, listeningPoints, vocabPoints } from '../game/scoring'
import type { Answer, Difficulty, Mode, Plan, Player, RecentGame, Room, RoomTopic, TypingSeg, World } from '../game/types'
import { chance, clamp, pick, rand, randInt, weightedPick } from '../lib/rng'
import { emit, toast } from './events'

export interface RoomConfig {
  mode: Mode
  topic: RoomTopic
  difficulty: Difficulty
  rounds: number
  secs: number
  max: number
  priv?: boolean
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x))

export const hasHuman = (w: World, r: Room) =>
  w.meId != null && (r.players.includes(w.meId) || r.spectators.includes(w.meId))
export const humanPlays = (w: World, r: Room) => w.meId != null && r.players.includes(w.meId)

export function randomConfig(host: Player): RoomConfig {
  const mode: Mode = chance(0.56) ? 'vocab' : 'listening'
  const lean = host.rating + rand(-180, 180)
  const difficulty: Difficulty = lean < 1120 ? 'easy' : lean < 1470 ? 'medium' : 'hard'
  return {
    mode,
    topic: chance(0.34) ? 'random' : pick(TOPIC_IDS),
    difficulty,
    rounds: weightedPick(ROUND_OPTIONS, (n) => (n === 10 ? 0.45 : n === 15 ? 0.32 : 0.23))!,
    secs: chance(0.75) ? DEFAULT_SECS[mode][difficulty] : pick(SECS_OPTIONS[mode]),
    max: pick([2, 2, 2, 3, 3, 4, 4, 4]),
  }
}

export function createRoom(w: World, hostId: string, cfg: RoomConfig, t: number): Room {
  const host = w.players[hostId]
  const room: Room = {
    id: w.nextRoomId++,
    mode: cfg.mode,
    topic: cfg.topic,
    difficulty: cfg.difficulty,
    rounds: cfg.rounds,
    secs: cfg.secs,
    max: cfg.max,
    host: hostId,
    players: [hostId],
    spectators: [],
    status: 'waiting',
    created: t,
    startAt: host.bot ? t + rand(25_000, 90_000) : null,
    nextJoinAt: t + (host.bot ? rand(3000, 14_000) : rand(1800, 4500)),
    seed: randInt(1, 2 ** 30),
    game: null,
    result: null,
    reactions: [],
    queue: [],
    closeAt: null,
    priv: !!cfg.priv,
    invited: [],
    played: 0,
  }
  w.rooms[room.id] = room
  host.roomId = room.id
  host.role = 'player'
  return room
}

export function addPlayer(w: World, r: Room, pid: string, t: number) {
  const p = w.players[pid]
  // a spectator taking a seat
  r.spectators = r.spectators.filter((s) => s !== pid)
  r.players.push(pid)
  p.roomId = r.id
  p.role = 'player'
  if (r.players.length >= r.max && r.startAt != null) r.startAt = Math.min(r.startAt, t + rand(2500, 5000))
}

function release(w: World, pid: string, t: number) {
  const p = w.players[pid]
  if (!p) return
  p.roomId = null
  p.role = null
  if (p.bot) p.nextAt = t + rand(4000, 30_000)
}

export function removeSpectator(w: World, r: Room, pid: string, t: number) {
  r.spectators = r.spectators.filter((s) => s !== pid)
  release(w, pid, t)
}

export function closeRoom(w: World, r: Room, t: number, live: boolean) {
  const humanWasHere = hasHuman(w, r)
  for (const pid of [...r.players, ...r.spectators]) release(w, pid, t)
  w.invites = w.invites.filter((i) => i.roomId !== r.id)
  delete w.rooms[r.id]
  if (humanWasHere && live) emit({ type: 'room-closed', roomId: r.id })
}

/** a player leaves a room that is not mid-game */
export function removePlayer(w: World, r: Room, pid: string, t: number, live: boolean) {
  r.players = r.players.filter((p) => p !== pid)
  release(w, pid, t)
  if (r.players.length === 0) {
    closeRoom(w, r, t, live)
    return
  }
  if (r.host === pid) {
    r.host = r.players[0]
    if (w.players[r.host].bot && r.status === 'waiting') r.startAt = t + rand(6000, 16_000)
  }
}

// ---------------------------------------------------------------- reactions

export function pushReaction(w: World, r: Room, pid: string, text: string, at: number) {
  r.reactions.push({ id: w.nextId++, pid, text, at })
  if (r.reactions.length > 24) r.reactions.splice(0, r.reactions.length - 24)
}

function queueReaction(r: Room, pid: string, text: string, at: number) {
  r.queue.push({ pid, text, at })
  r.queue.sort((a, b) => a.at - b.at)
}

const POSITIVE = ['Nice!', 'Awesome!', 'Wow!', 'Too fast!']
const NEGATIVE = ['Oops', 'So close!']

/** bots answering a reaction the human just sent */
export function botsEcho(w: World, r: Room, text: string, t: number) {
  const reply: Record<string, string[]> = {
    'Good luck!': ['Good luck!'],
    'GG!': ['GG!', 'Well played'],
    'Well played': ['GG!', 'Well played'],
    'One more round?': ['One more round?', 'GG!'],
    'Nice!': ['Awesome!', 'Nice!'],
    'Awesome!': ['Nice!', 'Wow!'],
  }
  const options = reply[text]
  if (!options) return
  for (const pid of r.players) {
    const p = w.players[pid]
    if (!p.bot) continue
    if (chance(0.3 + p.chatty * 0.5)) queueReaction(r, pid, pick(options), t + rand(900, 3200))
  }
}

// ---------------------------------------------------------------- bot play

function typo(word: string) {
  if (word.length < 3) return word + word.slice(-1)
  const i = randInt(1, word.length - 2)
  const mode = randInt(0, 2)
  if (mode === 0) return word.slice(0, i) + word.slice(i + 1) // dropped letter
  if (mode === 1) return word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2) // swapped letters
  return word.slice(0, i) + word[i] + word.slice(i) // doubled letter
}

const MISHEAR: Record<string, string[]> = {
  their: ['there'],
  there: ['their'],
  than: ['then'],
  then: ['than'],
  the: ['a'],
  a: ['the'],
  an: ['a'],
  to: ['too'],
  too: ['to'],
  is: ['was'],
  was: ['is'],
  are: ['is'],
  in: ['on'],
  on: ['in'],
  have: ['had', 'has'],
  had: ['have'],
  has: ['have'],
  would: ['will'],
  could: ['can'],
  this: ['these'],
  these: ['this'],
  for: ['from'],
  it: ['is'],
}

function mishear(word: string) {
  const bare = word.toLowerCase().replace(/[^a-z']/g, '')
  const alt = MISHEAR[bare]
  if (alt && chance(0.7)) return pick(alt)
  if (bare.endsWith('ed') && bare.length > 4) return bare.slice(0, -2)
  if (bare.endsWith('s') && bare.length > 3) return bare.slice(0, -1)
  return typo(bare)
}

function botTyped(text: string, pWord: number, tidy: boolean) {
  const out: string[] = []
  for (const word of text.split(' ')) {
    if (chance(pWord)) {
      out.push(word)
      continue
    }
    const roll = Math.random()
    if (roll < 0.3) continue // missed the word entirely
    out.push(roll < 0.75 ? mishear(word) : typo(word.replace(/[^A-Za-z']/g, '')))
  }
  let s = out.join(' ')
  if (!tidy) s = s.toLowerCase().replace(/[.,?!]/g, '')
  return s
}

function makePlan(r: Room, p: Player, idx: number, start: number, end: number): Plan | null {
  const gap = (p.ability - DIFFICULTIES[r.difficulty].level) / 260
  if (r.mode === 'vocab') {
    const q = vocabQ(r, idx)
    const correct = chance(0.34 + 0.62 * sigmoid(gap))
    if (!correct && chance(0.05)) return null // froze, ran out of time
    const frac = clamp((0.12 + 0.58 * Math.random() ** 1.3 * (1.25 - (p.ability - 700) / 2800)) / p.speed, 0.08, 0.99)
    const at = start + 900 + frac * (end - start - 1100)
    let v = q.answer
    if (!correct) {
      v = randInt(0, q.choices.length - 2)
      if (v >= q.answer) v++
    }
    return { startAt: start, at, v }
  }
  const text = listeningQ(r, idx).text
  const tidy = p.avatar % 5 < 3
  const typed = botTyped(text, 0.86 + 0.135 * sigmoid(gap), tidy)
  const cps = (3.4 + 4.6 * sigmoid((p.ability - 1200) / 300)) * p.speed
  return typingPlan(typed, start, end, speechMs(text, r.difficulty), cps)
}

/** how many characters are in the box at time t */
export function typedChars(segs: TypingSeg[], t: number) {
  let c = 0
  for (const seg of segs) {
    if (t >= seg.t1) c = seg.c
    else {
      if (t > seg.t0) c += ((seg.c - c) * (t - seg.t0)) / (seg.t1 - seg.t0)
      break
    }
  }
  return Math.max(0, Math.floor(c))
}

/**
 * People do not start typing the instant the audio stops and do not type in one smooth run:
 * they hesitate, type a few words, stop to think, fix a slip, then look it over before submitting.
 */
function typingPlan(typed: string, start: number, end: number, listenMs: number, cps: number): Plan {
  const heard = start + listenMs
  const mood = Math.random()
  let t =
    mood < 0.2
      ? start + listenMs * rand(0.5, 0.95) // starts while still listening
      : mood < 0.7
        ? heard + rand(350, 1700)
        : heard + rand(1700, 4500) // replays it in their head first
  const startAt = t

  // split into a few bursts at word boundaries
  const words = typed.split(' ')
  const bursts = Math.max(1, Math.min(words.length, randInt(1, words.length <= 3 ? 2 : 4)))
  const cuts: number[] = []
  let chars = 0
  words.forEach((word, i) => {
    chars += word.length + (i ? 1 : 0)
    if (i === words.length - 1 || (cuts.length < bursts - 1 && chance(bursts / words.length))) cuts.push(chars)
  })

  const segs: TypingSeg[] = []
  let c = 0
  cuts.forEach((target, i) => {
    if (i > 0) {
      t += chance(0.25) ? rand(1800, 3600) : rand(400, 1500)
      if (c > 4 && chance(0.3)) {
        // noticed a slip: delete a few characters and retype them
        const back = randInt(2, Math.min(7, c - 1))
        segs.push({ t0: t, t1: t + back * 110, c: c - back })
        t += back * 110 + rand(150, 500)
        c -= back
      }
    }
    const dur = ((target - c) / (cps * rand(0.75, 1.25))) * 1000
    segs.push({ t0: t, t1: t + dur, c: target })
    t += dur
    c = target
  })
  let at = t + (chance(0.3) ? rand(1300, 3800) : rand(300, 1200)) // reads it over before submitting

  const limit = end - 250
  if (at > limit) {
    const squeeze = (limit - startAt) / (at - startAt)
    if (squeeze >= 0.6) {
      // a little short on time: everything just happens a bit faster
      for (const seg of segs) {
        seg.t0 = startAt + (seg.t0 - startAt) * squeeze
        seg.t1 = startAt + (seg.t1 - startAt) * squeeze
      }
      at = limit
    } else {
      // ran out of time: whatever is in the box gets submitted
      typed = typed.slice(0, typedChars(segs, limit)).trim()
      at = end - 200
    }
  }
  return { startAt, at, v: typed, segs }
}

// ---------------------------------------------------------------- game flow

export function startGame(w: World, r: Room, at: number, live: boolean) {
  r.status = 'playing'
  r.startAt = null
  r.result = null
  r.invited = []
  w.invites = w.invites.filter((i) => i.roomId !== r.id)
  const scores: Record<string, number> = {}
  for (const pid of r.players) scores[pid] = 0
  r.game = { round: -1, phase: 'intro', start: at, end: at + INTRO_MS, scores, answers: [], plans: {}, left: [], replays: 0 }
  for (const pid of r.players) {
    const p = w.players[pid]
    if (p.bot && chance(0.12 + p.chatty * 0.45)) queueReaction(r, pid, 'Good luck!', at + rand(600, 4200))
  }
  if (live && humanPlays(w, r)) emit({ type: 'sfx', name: 'start' })
}

function beginRound(w: World, r: Room, idx: number, at: number) {
  const g = r.game!
  g.round = idx
  g.phase = 'question'
  g.start = at
  g.end = at + r.secs * 1000
  g.answers[idx] = {}
  g.plans = {}
  g.replays = 0
  for (const pid of r.players) {
    const p = w.players[pid]
    if (!p.bot) continue
    const plan = makePlan(r, p, idx, g.start, g.end)
    if (plan) g.plans[pid] = plan
  }
}

export function recordAnswer(r: Room, pid: string, v: number | string, at: number, replays = 0) {
  const g = r.game!
  if (g.phase !== 'question' || g.answers[g.round][pid]) return
  const t = Math.max(0, at - g.start)
  const left = 1 - t / (r.secs * 1000)
  let ans: Answer
  if (r.mode === 'vocab') {
    const ok = v === vocabQ(r, g.round).answer
    ans = { t, v, ok, acc: ok ? 1 : 0, pts: vocabPoints(ok, left), replays: 0 }
  } else {
    const { acc } = diffWords(listeningQ(r, g.round).text, String(v))
    ans = { t, v, ok: acc >= 0.999, acc, pts: listeningPoints(acc, left, replays), replays }
  }
  g.answers[g.round][pid] = ans
  if (r.players.every((p) => g.answers[g.round][p])) g.end = Math.min(g.end, at + ALL_IN_MS)
}

function endRound(w: World, r: Room, at: number, live: boolean) {
  const g = r.game!
  const answers = g.answers[g.round]
  let best: string | null = null
  for (const pid of r.players) {
    if (!answers[pid]) answers[pid] = { t: r.secs * 1000, v: null, ok: false, acc: 0, pts: 0, replays: 0 }
    g.scores[pid] = (g.scores[pid] ?? 0) + answers[pid].pts
    if (answers[pid].ok && (best == null || answers[pid].pts > answers[best].pts)) best = pid
  }
  g.phase = 'reveal'
  g.start = at
  g.end = at + REVEAL_MS[r.mode]
  g.plans = {}
  for (const pid of r.players) {
    const p = w.players[pid]
    if (!p.bot || !chance(p.chatty * 0.11)) continue
    const mine = answers[pid]
    const text = !mine.ok ? pick(NEGATIVE) : best && best !== pid ? pick(POSITIVE) : pick(['Nice!', 'Awesome!'])
    queueReaction(r, pid, text, at + rand(500, 2400))
  }
  for (const pid of r.spectators) {
    const p = w.players[pid]
    if (p.bot && best && chance(p.chatty * 0.03)) queueReaction(r, pid, pick(['Wow!', 'Nice!']), at + rand(600, 2500))
  }
  if (live && w.meId && answers[w.meId]) emit({ type: 'sfx', name: answers[w.meId].ok ? 'correct' : 'wrong' })
}

export function finishGame(w: World, r: Room, at: number, live: boolean) {
  const g = r.game!
  const correct: Record<string, number> = {}
  for (const pid of r.players) correct[pid] = g.answers.reduce((n, round) => n + (round[pid]?.ok ? 1 : 0), 0)
  const order = r.players.slice().sort((a, b) => g.scores[b] - g.scores[a] || correct[b] - correct[a])
  const before: Record<string, number> = {}
  for (const pid of order) before[pid] = w.players[pid].rating
  const deltas = eloDeltas(
    order.map((pid) => ({ id: pid, rating: w.players[pid].rating, score: g.scores[pid], k: w.players[pid].bot ? 20 : 30 })),
  )
  if (order.length > 1) {
    const first = order[0]
    const last = order[order.length - 1]
    if (g.scores[first] > g.scores[order[1]]) deltas[first] = Math.max(1, deltas[first])
    if (g.scores[last] < g.scores[order[order.length - 2]]) deltas[last] = Math.min(-1, deltas[last])
  }
  order.forEach((pid, i) => {
    const place = order.findIndex((o) => g.scores[o] === g.scores[pid]) + 1
    const opp = order[i === 0 ? 1 : 0]
    applyResult(w.players[pid], {
      roomId: r.id,
      mode: r.mode,
      at,
      place,
      of: order.length + g.left.length,
      score: g.scores[pid],
      delta: deltas[pid],
      oppId: opp ?? pid,
      oppScore: opp ? g.scores[opp] : 0,
    })
  })
  r.status = 'finished'
  r.result = { at, order, scores: { ...g.scores }, correct, deltas, before }
  r.played++
  const human = humanPlays(w, r)
  r.closeAt = at + (human ? 150_000 : rand(13_000, 26_000))
  for (const pid of r.players) {
    const p = w.players[pid]
    if (!p.bot) continue
    if (chance(0.22 + p.chatty * 0.5)) queueReaction(r, pid, pick(['GG!', 'GG!', 'Well played']), at + rand(800, 5000))
    if (chance(p.chatty * 0.35)) queueReaction(r, pid, 'One more round?', at + rand(4000, 9000))
  }
  if (live && human && w.meId) emit({ type: 'sfx', name: order[0] === w.meId ? 'win' : 'lose' })
}

export function applyResult(p: Player, game: RecentGame) {
  p.rating = Math.max(100, p.rating + game.delta)
  p.peak = Math.max(p.peak, p.rating)
  p.skills[game.mode] = Math.max(100, p.skills[game.mode] + Math.round(game.delta * 1.15))
  p.games++
  if (game.place === 1) p.wins++
  else p.losses++
  p.lastDelta = game.delta
  p.history.push(p.rating)
  if (p.history.length > 30) p.history.shift()
  p.recent.unshift(game)
  if (p.recent.length > 8) p.recent.length = 8
}

function rematchBots(r: Room, t: number) {
  r.status = 'waiting'
  r.game = null
  r.result = null
  r.closeAt = null
  r.seed = randInt(1, 2 ** 30)
  r.created = t
  r.startAt = t + rand(5000, 12_000)
  r.nextJoinAt = t + rand(2000, 8000)
}

export function advanceRoom(w: World, r: Room, t: number, live: boolean) {
  while (r.queue.length && r.queue[0].at <= t) {
    const q = r.queue.shift()!
    if (r.players.includes(q.pid) || r.spectators.includes(q.pid)) pushReaction(w, r, q.pid, q.text, q.at)
  }

  if (r.status === 'waiting') {
    // answers to invitations sent by the human
    for (const inv of r.invited.slice()) {
      if (inv.at > t) continue
      r.invited = r.invited.filter((i) => i !== inv)
      const p = w.players[inv.pid]
      const free = p.online && p.roomId == null && r.players.length < r.max
      if (free && chance(0.85)) {
        addPlayer(w, r, p.id, t)
        if (live) {
          toast(`${p.name} joined your room`, 'good', p.id)
          emit({ type: 'sfx', name: 'join' })
        }
      } else if (live) toast(`${p.name} can't join right now`, 'info', p.id)
    }
    if (r.startAt != null && t >= r.startAt) {
      if (r.players.length >= 2) startGame(w, r, r.startAt, live)
      else if (t - r.created > 110_000 && !hasHuman(w, r)) closeRoom(w, r, t, live)
      else r.startAt = t + rand(6000, 14_000)
    }
    if (r.status === 'waiting') return
  }

  if (r.status === 'playing') {
    for (let guard = 0; guard < 500; guard++) {
      const g = r.game!
      if (g.phase === 'intro') {
        if (t < g.end) break
        beginRound(w, r, 0, g.end)
      } else if (g.phase === 'question') {
        // bot answers land in time order so the "everyone is in" shortcut stays exact
        const due = Object.entries(g.plans)
          .filter(([, plan]) => plan.at <= t)
          .sort((a, b) => a[1].at - b[1].at)
        for (const [pid, plan] of due) {
          delete g.plans[pid]
          if (plan.at <= g.end && r.players.includes(pid)) recordAnswer(r, pid, plan.v, plan.at)
        }
        if (t < g.end) break
        endRound(w, r, g.end, live)
      } else {
        if (t < g.end) break
        if (g.round + 1 < r.rounds) beginRound(w, r, g.round + 1, g.end)
        else {
          finishGame(w, r, g.end, live)
          break
        }
      }
    }
  }

  if (r.status === 'finished' && r.closeAt != null && t >= r.closeAt) {
    const meHere = hasHuman(w, r)
    if (meHere && !humanPlays(w, r) && t < r.result!.at + 75_000) return // let a human spectator read the results
    const allBots = r.players.every((p) => w.players[p].bot)
    if (allBots && !meHere && r.players.length >= 2 && r.played < 3 && chance(0.28)) rematchBots(r, t)
    else closeRoom(w, r, t, live)
  }
}

/** the human walks out mid-game: immediate loss against everyone still playing */
export function forfeit(w: World, r: Room, pid: string, t: number, live: boolean) {
  const g = r.game!
  const me = w.players[pid]
  const rest = r.players.filter((p) => p !== pid)
  const deltas = eloDeltas([
    { id: pid, rating: me.rating, score: -1, k: 30 },
    ...rest.map((p) => ({ id: p, rating: w.players[p].rating, score: 0, k: 0 })),
  ])
  const top = rest.slice().sort((a, b) => g.scores[b] - g.scores[a])[0]
  applyResult(me, {
    roomId: r.id,
    mode: r.mode,
    at: t,
    place: r.players.length + g.left.length,
    of: r.players.length + g.left.length,
    score: g.scores[pid] ?? 0,
    delta: Math.min(-1, deltas[pid]),
    oppId: top ?? pid,
    oppScore: top ? g.scores[top] : 0,
  })
  g.left.push(pid)
  r.players = rest
  delete g.plans[pid]
  me.roomId = null
  me.role = null
  if (r.host === pid && rest.length) r.host = rest[0]
  if (rest.length < 2) {
    if (rest.length === 0) closeRoom(w, r, t, live)
    else finishGame(w, r, t, live)
  } else if (g.phase === 'question' && rest.every((p) => g.answers[g.round][p])) {
    g.end = Math.min(g.end, t + ALL_IN_MS)
  }
}
