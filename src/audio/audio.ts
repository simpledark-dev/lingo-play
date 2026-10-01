import { getSettings, onSettings } from '../lib/ui'
import type { SfxName } from '../sim/events'

// Browsers only allow sound after the visitor has interacted with the page.
let unlocked = false
const unlockWaiters: (() => void)[] = []

function unlock() {
  if (unlocked) return
  unlocked = true
  window.removeEventListener('pointerdown', unlock)
  window.removeEventListener('keydown', unlock)
  preloadSfx()
  syncMusic()
  unlockWaiters.splice(0).forEach((fn) => fn())
}
window.addEventListener('pointerdown', unlock)
window.addEventListener('keydown', unlock)

export const isUnlocked = () => unlocked
export const whenUnlocked = (fn: () => void) => (unlocked ? fn() : void unlockWaiters.push(fn))

// ---------------------------------------------------------------- lobby music

const MUSIC_VOLUME = 0.22
let music: HTMLAudioElement | null = null
let musicWanted = false
let fade = 0

function syncMusic() {
  const on = musicWanted && getSettings().music && unlocked
  if (on && !music) {
    music = new Audio('/assets/music/lobby-time.mp3')
    music.loop = true
    music.volume = 0
  }
  if (!music) return
  cancelAnimationFrame(fade)
  const target = on ? MUSIC_VOLUME : 0
  if (on && music.paused) music.play().catch(() => {})
  const step = () => {
    if (!music) return
    const diff = target - music.volume
    if (Math.abs(diff) < 0.012) {
      music.volume = target
      if (target === 0) music.pause()
      return
    }
    music.volume = Math.max(0, Math.min(1, music.volume + Math.sign(diff) * 0.012))
    fade = requestAnimationFrame(step)
  }
  step()
}

/** The lobby track plays only while a lobby screen is showing. */
export function setMusicWanted(wanted: boolean) {
  musicWanted = wanted
  syncMusic()
}
onSettings(syncMusic)

// ---------------------------------------------------------------- sound effects

const SFX: Record<SfxName, { src: string; volume: number; rate?: number }> = {
  correct: { src: '/assets/sfx/correct.wav', volume: 0.32, rate: 1.08 },
  wrong: { src: '/assets/sfx/wrong.wav', volume: 0.28 },
  tick: { src: '/assets/sfx/tick.wav', volume: 0.14 },
  start: { src: '/assets/sfx/start.wav', volume: 0.25 },
  win: { src: '/assets/sfx/win.wav', volume: 0.32 },
  lose: { src: '/assets/sfx/lose.wav', volume: 0.28 },
  join: { src: '/assets/sfx/join.wav', volume: 0.18, rate: 1.06 },
  pop: { src: '/assets/sfx/pop.wav', volume: 0.16, rate: 1.12 },
  invite: { src: '/assets/sfx/invite.wav', volume: 0.23 },
}

const sfxCache = new Map<SfxName, HTMLAudioElement>()

function sound(name: SfxName) {
  let audio = sfxCache.get(name)
  if (audio) return audio
  const cue = SFX[name]
  audio = new Audio()
  audio.preload = 'auto'
  audio.src = cue.src
  audio.load()
  sfxCache.set(name, audio)
  return audio
}

function preloadSfx() {
  ;(Object.keys(SFX) as SfxName[]).forEach(sound)
}

export function sfx(name: SfxName) {
  if (!getSettings().sfx || !unlocked) return
  try {
    const cue = SFX[name]
    const cached = sound(name)
    const audio = cached.paused ? cached : (cached.cloneNode(true) as HTMLAudioElement)
    audio.volume = cue.volume
    audio.playbackRate = cue.rate ?? 1
    audio.currentTime = 0
    audio.play().catch(() => {})
  } catch {
    // no audio available
  }
}

// ---------------------------------------------------------------- speech
// Dictation sentences are pre-rendered to mp3 (scripts/make-speech.mjs) so every browser plays the same
// audio the same way. The browser's own speech engine is only a fallback for a sentence without a file.

type SpeakHandlers = { onstart?: () => void; onend?: () => void }

/** must match speechHash() in scripts/make-speech.mjs */
function speechFile(text: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return `/assets/speech/${(h >>> 0).toString(16).padStart(8, '0')}.mp3`
}

let clip: HTMLAudioElement | null = null
let speakTimer = 0
let voice: SpeechSynthesisVoice | null = null
// Chrome drops an utterance that is collected mid-speech, so the current one is kept here
const keep: { utterance: SpeechSynthesisUtterance | null } = { utterance: null }

function pickVoice() {
  const voices = window.speechSynthesis?.getVoices() ?? []
  const en = voices.filter((v) => v.lang.startsWith('en'))
  const prefer = ['Samantha', 'Google US English', 'Microsoft Aria', 'Microsoft Jenny', 'Karen', 'Daniel']
  voice =
    prefer.map((n) => en.find((v) => v.name.includes(n))).find(Boolean) ??
    en.find((v) => v.lang === 'en-US') ??
    en[0] ??
    null
}
if ('speechSynthesis' in window) {
  pickVoice()
  window.speechSynthesis.addEventListener?.('voiceschanged', pickVoice)
}

function synthSpeak(text: string, rate: number, handlers: SpeakHandlers) {
  const synth = window.speechSynthesis
  if (!synth) {
    handlers.onend?.()
    return
  }
  synth.cancel()
  const u = new SpeechSynthesisUtterance(text)
  if (voice) u.voice = voice
  u.lang = voice?.lang ?? 'en-US'
  u.rate = rate
  u.onstart = () => handlers.onstart?.()
  u.onend = () => handlers.onend?.()
  u.onerror = () => handlers.onend?.()
  // Chrome silently swallows speak() issued in the same tick as cancel(), so the speech starts a beat later
  speakTimer = window.setTimeout(() => {
    keep.utterance = u
    synth.speak(u)
  }, 120)
}

export function speak(text: string, rate: number, handlers: SpeakHandlers = {}) {
  stopSpeaking()
  const audio = new Audio(speechFile(text))
  clip = audio
  audio.playbackRate = rate
  let fellBack = false
  const fallback = () => {
    if (fellBack || clip !== audio) return
    fellBack = true
    clip = null
    synthSpeak(text, rate, handlers)
  }
  audio.onplaying = () => clip === audio && handlers.onstart?.()
  audio.onended = () => clip === audio && handlers.onend?.()
  audio.onerror = fallback
  audio.play().catch((err: DOMException) => {
    // AbortError just means stopSpeaking() got there first
    if (err?.name !== 'AbortError') fallback()
  })
}

export function stopSpeaking() {
  clearTimeout(speakTimer)
  if (clip) {
    const old = clip
    clip = null
    old.pause()
  }
  if (keep.utterance) {
    keep.utterance = null
    window.speechSynthesis?.cancel()
  }
}
