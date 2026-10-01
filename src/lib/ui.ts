import { useSyncExternalStore } from 'react'

// ---------------------------------------------------------------- hash router

export type Route =
  | { name: 'lobby' }
  | { name: 'rankings' }
  | { name: 'players' }
  | { name: 'room'; id: number }

function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/')
  if (parts[0] === 'room' && Number(parts[1]) > 0) return { name: 'room', id: Number(parts[1]) }
  if (parts[0] === 'rankings') return { name: 'rankings' }
  if (parts[0] === 'players') return { name: 'players' }
  return { name: 'lobby' }
}

let route = parse(location.hash)
const routeListeners = new Set<() => void>()
window.addEventListener('hashchange', () => {
  route = parse(location.hash)
  routeListeners.forEach((l) => l())
})

export function useRoute(): Route {
  return useSyncExternalStore(
    (fn) => {
      routeListeners.add(fn)
      return () => routeListeners.delete(fn)
    },
    () => route,
  )
}

export function go(path: string) {
  if (location.hash === `#/${path}`) return
  location.hash = `#/${path}`
}

// ---------------------------------------------------------------- overlays

export interface Toast {
  id: number
  text: string
  tone: 'info' | 'good' | 'bad'
  pid?: string
}

interface UiState {
  profile: string | null
  create: { inviteId?: string } | null
  pro: boolean
  matching: boolean
  toasts: Toast[]
}

let state: UiState = { profile: null, create: null, pro: false, matching: false, toasts: [] }
const listeners = new Set<() => void>()

export function setUi(patch: Partial<UiState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export function useUi(): UiState {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => state,
  )
}

let toastId = 1
export function showToast(text: string, tone: Toast['tone'] = 'info', pid?: string) {
  const t: Toast = { id: toastId++, text, tone, pid }
  setUi({ toasts: [...state.toasts.slice(-3), t] })
  setTimeout(() => setUi({ toasts: state.toasts.filter((x) => x.id !== t.id) }), 3800)
}

export const comingSoon = (what: string) => showToast(`${what} is coming soon`, 'info')

// ---------------------------------------------------------------- settings

const SETTINGS_KEY = 'lingoplay.settings.v1'
export interface Settings {
  music: boolean
  sfx: boolean
}

let settings: Settings = { music: true, sfx: true }
try {
  settings = { ...settings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }
} catch {
  // keep defaults
}
const settingsListeners = new Set<() => void>()

export function setSettings(patch: Partial<Settings>) {
  settings = { ...settings, ...patch }
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // ignore
  }
  settingsListeners.forEach((l) => l())
}

export const getSettings = () => settings

export function onSettings(fn: () => void) {
  settingsListeners.add(fn)
  return () => {
    settingsListeners.delete(fn)
  }
}

export function useSettings(): Settings {
  return useSyncExternalStore(onSettings, () => settings)
}
