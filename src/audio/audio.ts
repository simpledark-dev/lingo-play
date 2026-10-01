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
  ctx?.resume()
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

let ctx: AudioContext | null = null

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.12) {
  if (!ctx) return
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  const t0 = ctx.currentTime + start
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(gain, t0 + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g).connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

const SFX: Record<SfxName, () => void> = {
  correct: () => {
    tone(660, 0, 0.14, 'triangle')
    tone(990, 0.09, 0.22, 'triangle')
  },
  wrong: () => {
    tone(220, 0, 0.18, 'sawtooth', 0.06)
    tone(170, 0.1, 0.24, 'sawtooth', 0.06)
  },
  tick: () => tone(880, 0, 0.05, 'square', 0.04),
  start: () => {
    tone(523, 0, 0.12, 'triangle')
    tone(659, 0.1, 0.12, 'triangle')
    tone(784, 0.2, 0.25, 'triangle')
  },
  win: () => {
    ;[523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.3, 'triangle', 0.13))
  },
  lose: () => {
    tone(392, 0, 0.2, 'triangle', 0.1)
    tone(330, 0.16, 0.34, 'triangle', 0.1)
  },
  join: () => tone(740, 0, 0.12, 'sine', 0.08),
  pop: () => tone(520, 0, 0.07, 'sine', 0.08),
  invite: () => {
    tone(880, 0, 0.12, 'sine', 0.1)
    tone(1175, 0.12, 0.2, 'sine', 0.1)
  },
}

export function sfx(name: SfxName) {
  if (!getSettings().sfx || !unlocked) return
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') ctx.resume()
    SFX[name]()
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
