import { useSyncExternalStore } from 'react'
import type { Player, World } from '../game/types'
import { tick, warmUp } from './engine'
import { createWorld } from './seed'

const KEY = 'lingoplay.world.v1'
const SCHEMA = 1

let world: World = boot()
let version = 0
const listeners = new Set<() => void>()

function boot(): World {
  const now = Date.now()
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const saved = JSON.parse(raw) as World
      if (saved && saved.v === SCHEMA && saved.players && saved.rooms) {
        tick(saved, now)
        return saved
      }
    }
  } catch {
    // corrupted or unavailable storage: start over
  }
  const fresh = createWorld(now)
  warmUp(fresh, now)
  return fresh
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(world))
  } catch {
    // storage full or blocked; the demo keeps running in memory
  }
}

export function resetWorld() {
  const now = Date.now()
  world = createWorld(now)
  warmUp(world, now)
  save()
  notify()
}

export const getWorld = () => world

export function notify() {
  version++
  ranksCache = null
  listeners.forEach((l) => l())
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** Re-renders the caller every time the simulation moves. */
export function useWorld(): World {
  useSyncExternalStore(subscribe, () => version)
  return world
}

let started = false
export function startEngine() {
  if (started) return
  started = true
  let lastSave = Date.now()
  const run = () => {
    const now = Date.now()
    tick(world, now)
    notify()
    if (now - lastSave > 3000) {
      lastSave = now
      save()
    }
  }
  setInterval(run, 250)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') save()
    else run()
  })
  window.addEventListener('pagehide', save)
}

// ---------------------------------------------------------------- derived data

let ranksCache: { list: Player[]; rank: Map<string, number> } | null = null

/** every known player ordered by rating, plus each one's global rank */
export function rankings() {
  if (!ranksCache) {
    const list = Object.values(world.players).sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name))
    const rank = new Map<string, number>()
    list.forEach((p, i) => rank.set(p.id, i + 1))
    ranksCache = { list, rank }
  }
  return ranksCache
}

export const rankOf = (id: string) => rankings().rank.get(id) ?? 0
export const me = () => (world.meId ? world.players[world.meId] : null)
