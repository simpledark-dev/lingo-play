import { MAX_REPLAYS } from '../game/config'
import type { Room } from '../game/types'
import { chance, pick, rand, randInt } from '../lib/rng'
import { emit, toast } from './events'
import {
  addPlayer,
  botsEcho,
  createRoom,
  forfeit,
  pushReaction,
  randomConfig,
  recordAnswer,
  removePlayer,
  removeSpectator,
  startGame,
  type RoomConfig,
} from './rooms'
import { createGuest } from './seed'
import { getWorld, notify, resetWorld, save } from './store'

const commit = () => {
  notify()
  save()
}

export function loginAsGuest() {
  const w = getWorld()
  const now = Date.now()
  w.players.me = createGuest(now)
  w.meId = 'me'
  w.friends = []
  w.friendReqs = []
  w.invites = []
  w.nextInviteAt = now + rand(45_000, 80_000)
  commit()
}

export function logout() {
  const w = getWorld()
  if (!w.meId) return
  leaveCurrentRoom()
  delete w.players[w.meId]
  w.meId = null
  w.friends = []
  w.friendReqs = []
  w.invites = []
  commit()
}

export function resetEverything() {
  resetWorld()
}

export function updateProfile(patch: { name?: string; avatar?: number; bio?: string }) {
  const w = getWorld()
  const p = w.meId ? w.players[w.meId] : null
  if (!p) return
  if (patch.name != null) p.name = patch.name.trim().slice(0, 15) || p.name
  if (patch.avatar != null) p.avatar = patch.avatar
  if (patch.bio != null) p.bio = patch.bio.slice(0, 80)
  commit()
}

/** the room the human currently holds a seat in (not spectating) */
export function mySeat(): Room | null {
  const w = getWorld()
  const p = w.meId ? w.players[w.meId] : null
  if (!p || p.roomId == null || p.role !== 'player') return null
  return w.rooms[p.roomId] ?? null
}

function busy(): boolean {
  const seat = mySeat()
  if (seat) toast(`You are already in room #${seat.id}`, 'info')
  return !!seat
}

function stopWatching() {
  const w = getWorld()
  const p = w.meId ? w.players[w.meId] : null
  if (!p || p.role !== 'spectator' || p.roomId == null) return
  const r = w.rooms[p.roomId]
  if (r) removeSpectator(w, r, p.id, Date.now())
  else {
    p.roomId = null
    p.role = null
  }
}

export function hostRoom(cfg: RoomConfig, inviteId?: string): number | null {
  const w = getWorld()
  if (!w.meId || busy()) return null
  stopWatching()
  const now = Date.now()
  const r = createRoom(w, w.meId, cfg, now)
  if (inviteId) r.invited.push({ pid: inviteId, at: now + rand(1800, 4500) })
  commit()
  return r.id
}

export function joinRoom(roomId: number): boolean {
  const w = getWorld()
  const r = w.rooms[roomId]
  if (!w.meId) return false
  if (r?.players.includes(w.meId)) return true
  if (busy()) return false
  if (!r || r.status !== 'waiting') {
    toast('That game has already started', 'info')
    return false
  }
  if (r.players.length >= r.max) {
    toast('That room is full', 'info')
    return false
  }
  stopWatching()
  const now = Date.now()
  addPlayer(w, r, w.meId, now)
  // nobody likes waiting: bot hosts get going shortly after a human sits down
  if (r.startAt != null) r.startAt = Math.max(now + 5000, Math.min(r.startAt, now + 11_000))
  w.invites = w.invites.filter((i) => i.roomId !== roomId)
  emit({ type: 'sfx', name: 'join' })
  commit()
  return true
}

export function quickPlay(): number | null {
  const w = getWorld()
  if (!w.meId || busy()) return null
  const open = Object.values(w.rooms).filter((r) => r.status === 'waiting' && !r.priv && r.players.length < r.max)
  if (open.length && chance(0.85)) {
    const r = pick(open)
    return joinRoom(r.id) ? r.id : null
  }
  const now = Date.now()
  stopWatching()
  const r = createRoom(w, w.meId, { ...randomConfig(w.players[w.meId]), max: 4 }, now)
  r.startAt = now + 9000
  r.nextJoinAt = now + 1200
  commit()
  return r.id
}

export function watchRoom(roomId: number) {
  const w = getWorld()
  const p = w.meId ? w.players[w.meId] : null
  const r = w.rooms[roomId]
  if (!p || !r || r.players.includes(p.id) || r.spectators.includes(p.id)) return
  if (mySeat()) return
  stopWatching()
  r.spectators.push(p.id)
  p.roomId = r.id
  p.role = 'spectator'
  commit()
}

/** leave whatever room the human is in; mid-game this counts as a forfeit */
export function leaveCurrentRoom() {
  const w = getWorld()
  const p = w.meId ? w.players[w.meId] : null
  if (!p || p.roomId == null) return
  const r = w.rooms[p.roomId]
  const now = Date.now()
  if (!r) {
    p.roomId = null
    p.role = null
  } else if (p.role === 'spectator') {
    removeSpectator(w, r, p.id, now)
  } else if (r.status === 'playing') {
    forfeit(w, r, p.id, now, true)
  } else {
    removePlayer(w, r, p.id, now, true)
    if (w.rooms[r.id] && r.status === 'finished') r.closeAt = Math.min(r.closeAt ?? now, now + rand(4000, 10_000))
  }
  commit()
}

export function startRoom(roomId: number) {
  const w = getWorld()
  const r = w.rooms[roomId]
  if (!r || r.status !== 'waiting' || r.host !== w.meId) return
  if (r.players.length < 2) {
    toast('You need at least 2 players to start', 'info')
    return
  }
  startGame(w, r, Date.now(), true)
  commit()
}

export function invitePlayer(roomId: number, pid: string) {
  const w = getWorld()
  const r = w.rooms[roomId]
  if (!r || r.status !== 'waiting' || r.invited.some((i) => i.pid === pid)) return
  r.invited.push({ pid, at: Date.now() + rand(1800, 5000) })
  commit()
}

export function submitAnswer(roomId: number, v: number | string) {
  const w = getWorld()
  const r = w.rooms[roomId]
  if (!r || !w.meId || r.status !== 'playing' || !r.game || !r.players.includes(w.meId)) return
  recordAnswer(r, w.meId, v, Date.now(), r.game.replays)
  commit()
}

/** returns true when a replay was granted */
export function takeReplay(roomId: number): boolean {
  const w = getWorld()
  const g = w.rooms[roomId]?.game
  if (!g || g.phase !== 'question' || g.replays >= MAX_REPLAYS) return false
  g.replays++
  commit()
  return true
}

export function sendReaction(roomId: number, text: string) {
  const w = getWorld()
  const r = w.rooms[roomId]
  if (!r || !w.meId) return
  const now = Date.now()
  pushReaction(w, r, w.meId, text, now)
  botsEcho(w, r, text, now)
  emit({ type: 'sfx', name: 'pop' })
  commit()
}

/** "Play again" from the results screen: the human hosts a fresh game with whoever sticks around */
export function rematch(roomId: number) {
  const w = getWorld()
  const r = w.rooms[roomId]
  if (!r || !w.meId || r.status !== 'finished' || !r.players.includes(w.meId)) return
  const now = Date.now()
  const stay = r.players.filter((p) => p === w.meId || chance(0.7))
  for (const pid of r.players) if (!stay.includes(pid)) removePlayer(w, r, pid, now, true)
  if (!w.rooms[r.id]) return
  r.status = 'waiting'
  r.host = w.meId
  r.game = null
  r.result = null
  r.closeAt = null
  r.startAt = null
  r.seed = randInt(1, 2 ** 30)
  r.created = now
  r.nextJoinAt = now + rand(1500, 4000)
  commit()
}

export function addFriend(pid: string) {
  const w = getWorld()
  if (w.friends.includes(pid) || w.friendReqs.some((q) => q.pid === pid)) return
  w.friendReqs.push({ pid, at: Date.now() + rand(2500, 8000) })
  toast('Friend request sent', 'info', pid)
  commit()
}

export function removeFriend(pid: string) {
  const w = getWorld()
  w.friends = w.friends.filter((f) => f !== pid)
  commit()
}

export function acceptInvite(id: number): number | null {
  const w = getWorld()
  const inv = w.invites.find((i) => i.id === id)
  if (!inv) return null
  w.invites = w.invites.filter((i) => i !== inv)
  const ok = joinRoom(inv.roomId)
  commit()
  return ok ? inv.roomId : null
}

export function declineInvite(id: number) {
  const w = getWorld()
  const inv = w.invites.find((i) => i.id === id)
  if (!inv) return
  w.invites = w.invites.filter((i) => i !== inv)
  const r = w.rooms[inv.roomId]
  // the bot shrugs and opens the room to everyone else
  if (r && r.status === 'waiting') {
    r.startAt = Date.now() + rand(12_000, 30_000)
    r.nextJoinAt = Date.now() + rand(1500, 5000)
  }
  commit()
}
