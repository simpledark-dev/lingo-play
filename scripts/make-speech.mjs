// Renders every dictation sentence to public/assets/speech/<hash>.mp3 with the macOS system voice.
// Run with `npm run speech` after editing src/data/sentences.ts (needs macOS `say` and ffmpeg).
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'public/assets/speech')
const VOICE = process.env.VOICE || 'Samantha'

// must match speechFile() in src/audio/audio.ts
export function speechHash(text) {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

const source = readFileSync(join(root, 'src/data/sentences.ts'), 'utf8')
const sentences = [...source.matchAll(/^\s+'(.+)',$/gm)].map((m) => m[1])
mkdirSync(out, { recursive: true })

const wanted = new Set()
let made = 0
for (const text of sentences) {
  const name = `${speechHash(text)}.mp3`
  if (wanted.has(name)) throw new Error(`hash collision or duplicate sentence: ${text}`)
  wanted.add(name)
  const file = join(out, name)
  if (existsSync(file)) continue
  const aiff = join(out, 'tmp.aiff')
  execFileSync('say', ['-v', VOICE, '-o', aiff, text])
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', aiff, '-ac', '1', '-codec:a', 'libmp3lame', '-b:a', '64k', file])
  rmSync(aiff)
  made++
}
for (const f of readdirSync(out)) if (!wanted.has(f)) rmSync(join(out, f))
console.log(`${sentences.length} sentences, ${made} rendered, voice ${VOICE}`)
