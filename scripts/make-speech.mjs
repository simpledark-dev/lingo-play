// Renders every dictation sentence to public/assets/speech/<hash>.mp3 with Microsoft Edge's
// no-key neural TTS service. Install the generator once with: python3 -m pip install edge-tts
import { execFile } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'public/assets/speech')
const VOICE = process.env.VOICE || 'en-US-EmmaNeural'
const RATE = process.env.RATE || '-3%'
const EDGE_TTS = process.env.EDGE_TTS || 'edge-tts'
const FORCE = process.env.FORCE === '1'
const CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY) || 4)
const run = promisify(execFile)

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
const staging = mkdtempSync(join(tmpdir(), 'lingoplay-speech-'))

const wanted = new Set()
const jobs = []
for (const text of sentences) {
  const name = `${speechHash(text)}.mp3`
  if (wanted.has(name)) throw new Error(`hash collision or duplicate sentence: ${text}`)
  wanted.add(name)
  const file = join(out, name)
  if (!FORCE && existsSync(file)) continue
  jobs.push({ text, name, file: join(staging, name) })
}

let next = 0
let made = 0
async function worker() {
  while (next < jobs.length) {
    const job = jobs[next++]
    await run(EDGE_TTS, ['--voice', VOICE, `--rate=${RATE}`, '--text', job.text, '--write-media', job.file])
    if (!existsSync(job.file) || statSync(job.file).size < 1000) throw new Error(`TTS returned an empty clip for: ${job.text}`)
    made++
  }
}

try {
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker))
  for (const job of jobs) copyFileSync(job.file, join(out, job.name))
} finally {
  rmSync(staging, { recursive: true, force: true })
}

for (const f of readdirSync(out)) if (!wanted.has(f)) rmSync(join(out, f))
console.log(`${sentences.length} sentences, ${made} rendered, voice ${VOICE}, rate ${RATE}`)
