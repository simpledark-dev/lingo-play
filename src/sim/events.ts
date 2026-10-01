/** Transient UI notifications coming out of the simulation. Never persisted. */
export type UiEvent =
  | { type: 'toast'; text: string; tone?: 'info' | 'good' | 'bad'; pid?: string }
  | { type: 'room-closed'; roomId: number }
  | { type: 'sfx'; name: SfxName }

export type SfxName = 'correct' | 'wrong' | 'tick' | 'start' | 'win' | 'lose' | 'join' | 'pop' | 'invite'

type Listener = (e: UiEvent) => void
const listeners = new Set<Listener>()

export function onUiEvent(fn: Listener) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function emit(e: UiEvent) {
  listeners.forEach((l) => l(e))
}

export const toast = (text: string, tone: 'info' | 'good' | 'bad' = 'info', pid?: string) =>
  emit({ type: 'toast', text, tone, pid })
