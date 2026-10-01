import { MODES } from '../game/config'
import type { Player, Room, World } from '../game/types'
import { chance, rand, weightedPick } from '../lib/rng'
import { emit, toast } from './events'
import { addPlayer, advanceRoom, closeRoom, createRoom, hasHuman, randomConfig, removeSpectator } from './rooms'
import { ONLINE_SHARE, offlineSession, onlineSession } from './seed'

const MAX_GAP = 25 * 60_000
const CATCHUP_STEP = 1500

const isIdle = (p: Player) => p.bot && p.online && p.roomId == null

function idleBots(w: World) {
  const out: Player[] = []
  for (const id in w.players) if (isIdle(w.players[id])) out.push(w.players[id])
  return out
}

function presence(w: World, t: number, live: boolean) {
  const rooms = Object.values(w.rooms)
  for (const id in w.players) {
    const b = w.players[id]
    if (!b.bot) continue
    if (!b.online) {
      if (t >= b.sessionEnd) {
        b.online = true
        b.sessionEnd = t + onlineSession()
        b.nextAt = t + rand(3000, 25_000)
        if (live && w.friends.includes(b.id)) toast(`${b.name} is online`, 'info', b.id)
      }
      continue
    }
    if (b.roomId != null) {
      if (b.role === 'spectator' && t >= b.nextAt) {
        const r = w.rooms[b.roomId]
        if (r) removeSpectator(w, r, b.id, t)
        else {
          b.roomId = null
          b.role = null
        }
      }
      continue
    }
    if (t >= b.sessionEnd) {
      b.online = false
      b.sessionEnd = t + offlineSession()
      continue
    }
    if (t >= b.nextAt) {
      b.nextAt = t + rand(12_000, 50_000)
      if (!chance(0.1)) continue
      // drop in to watch a game, strong tables draw a crowd
      const playing = rooms.filter((r) => r.status === 'playing' && w.rooms[r.id])
      const r = weightedPick(playing, (room) => {
        const top = Math.max(...room.players.map((p) => w.players[p]?.rating ?? 0))
        return 1 + Math.max(0, top - 1300) / 150 + room.spectators.length * 0.6 + (hasHuman(w, room) ? 2 : 0)
      })
      if (!r) continue
      r.spectators.push(b.id)
      b.roomId = r.id
      b.role = 'spectator'
      b.nextAt = t + rand(25_000, 150_000)
    }
  }
}

function fillRooms(w: World, t: number, live: boolean) {
  let idle: Player[] | null = null
  for (const r of Object.values(w.rooms)) {
    if (r.status !== 'waiting' || r.priv || t < r.nextJoinAt) continue
    const host = w.players[r.host]
    r.nextJoinAt = t + (host.bot ? rand(6000, 24_000) : rand(2500, 7000))
    if (r.players.length >= r.max) continue
    idle ??= idleBots(w)
    const b = weightedPick(idle, (p) => (p.roomId == null ? Math.exp(-Math.abs(p.rating - host.rating) / 320) : 0))
    if (!b || b.roomId != null) continue
    addPlayer(w, r, b.id, t)
    if (live && hasHuman(w, r)) emit({ type: 'sfx', name: 'join' })
  }
}

function spawnRooms(w: World, t: number) {
  if (t < w.nextSpawnAt) return
  const count = Object.keys(w.rooms).length
  const deficit = w.targetRooms - count
  w.nextSpawnAt = t + rand(2500, 9000) * (deficit > 4 ? 0.35 : 1)
  if (chance(0.04)) w.targetRooms = Math.max(36, Math.min(44, w.targetRooms + (chance(0.5) ? 1 : -1)))
  if (deficit <= 0) return
  const host = weightedPick(idleBots(w), () => 1)
  if (host) createRoom(w, host.id, randomConfig(host), t)
}

/** now and then a bot invites the human into a room it just opened */
function inviteHuman(w: World, t: number, live: boolean) {
  const me = w.meId ? w.players[w.meId] : null
  w.invites = w.invites.filter((i) => w.rooms[i.roomId]?.status === 'waiting' && t - i.at < 40_000)
  if (!me || !live || t < w.nextInviteAt) return
  w.nextInviteAt = t + rand(100_000, 260_000)
  if (me.roomId != null || w.invites.length) return
  const idle = idleBots(w)
  const host = weightedPick(idle, (p) => Math.exp(-Math.abs(p.rating - me.rating) / 200) * (w.friends.includes(p.id) ? 5 : 1))
  if (!host) return
  const cfg = randomConfig(me)
  // party games need a table, the classic ones work as a duel
  const r = createRoom(w, host.id, { ...cfg, max: MODES[cfg.mode].turns ? cfg.max : chance(0.6) ? 2 : 3 }, t)
  r.startAt = t + 45_000
  r.nextJoinAt = t + rand(15_000, 30_000)
  w.invites.push({ id: w.nextId++, roomId: r.id, from: host.id, at: t })
  emit({ type: 'sfx', name: 'invite' })
}

function friendRequests(w: World, t: number, live: boolean) {
  for (const req of w.friendReqs.slice()) {
    if (req.at > t) continue
    w.friendReqs = w.friendReqs.filter((q) => q !== req)
    if (!w.friends.includes(req.pid)) w.friends.push(req.pid)
    const p = w.players[req.pid]
    if (live && p) toast(`${p.name} accepted your friend request`, 'good', p.id)
  }
}

function stepWorld(w: World, t: number, live: boolean) {
  for (const r of Object.values(w.rooms) as Room[]) if (w.rooms[r.id]) advanceRoom(w, r, t, live)
  presence(w, t, live)
  fillRooms(w, t, live)
  spawnRooms(w, t)
  inviteHuman(w, t, live)
  friendRequests(w, t, live)
}

/** After a long absence nothing on screen should look frozen in time. */
function reshuffle(w: World, t: number) {
  for (const r of Object.values(w.rooms)) closeRoom(w, r, t, false)
  for (const id in w.players) {
    const p = w.players[id]
    p.roomId = null
    p.role = null
    if (!p.bot) continue
    p.online = chance(ONLINE_SHARE)
    p.sessionEnd = t + (p.online ? onlineSession() : offlineSession()) * Math.random()
    p.nextAt = t + rand(0, 40_000)
  }
  w.invites = []
  w.nextSpawnAt = t
}

/** Advance the world to `now`, replaying whatever happened while the tab was closed or asleep. */
export function tick(w: World, now: number) {
  let gap = now - w.lastTick
  if (gap <= 0) return
  if (gap > MAX_GAP) {
    w.lastTick = now - MAX_GAP
    reshuffle(w, w.lastTick)
    gap = MAX_GAP
  }
  if (gap < 4000) {
    stepWorld(w, now, true)
  } else {
    let t = w.lastTick
    while (t < now) {
      t = Math.min(now, t + CATCHUP_STEP)
      stepWorld(w, t, false)
    }
  }
  w.lastTick = now
}

/** Run a fresh world for a while so the first thing a visitor sees is a busy lobby. */
export function warmUp(w: World, now: number, minutes = 14) {
  w.lastTick = now - minutes * 60_000
  w.nextSpawnAt = w.lastTick
  for (const id in w.players) {
    const p = w.players[id]
    p.sessionEnd -= minutes * 60_000 * 0.5
    p.nextAt -= minutes * 60_000
  }
  tick(w, now)
}
