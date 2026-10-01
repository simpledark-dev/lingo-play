import { SENTENCES } from '../data/sentences'
import { VOCAB, type VocabEntry } from '../data/vocab'
import { mulberry32, shuffle, type Rng } from '../lib/rng'
import { TOPIC_IDS } from './config'
import type { Difficulty, ListeningQuestion, Room, VocabQuestion } from './types'

const LEVEL_WEIGHTS: Record<Difficulty, [number, number, number]> = {
  easy: [1, 0.45, 0],
  medium: [0.35, 1, 0.45],
  hard: [0, 0.45, 1],
}

/** weighted sample without replacement */
function sample<T>(items: T[], weight: (t: T) => number, n: number, r: Rng): T[] {
  const keyed = items
    .map((it) => {
      const w = weight(it)
      return { it, k: w > 0 ? Math.pow(r(), 1 / w) : -1 }
    })
    .filter((x) => x.k >= 0)
    .sort((a, b) => b.k - a.k)
  return keyed.slice(0, n).map((x) => x.it)
}

function buildVocab(room: Room, r: Rng): VocabQuestion[] {
  const topics = room.topic === 'random' ? TOPIC_IDS : [room.topic]
  const pool: { e: VocabEntry; topic: string }[] = []
  for (const t of topics) for (const e of VOCAB[t]) pool.push({ e, topic: t })
  const w = LEVEL_WEIGHTS[room.difficulty]
  let chosen = sample(pool, (p) => w[p.e[2] - 1], room.rounds, r)
  if (chosen.length < room.rounds) {
    const rest = shuffle(
      pool.filter((p) => !chosen.includes(p)),
      r,
    )
    chosen = chosen.concat(rest.slice(0, room.rounds - chosen.length))
  }
  return chosen.map(({ e, topic }) => {
    const kind: VocabQuestion['kind'] = r() < 0.62 ? 'en-vi' : 'vi-en'
    // distractors: same topic first, nearest level first
    const sameTopic = pool.filter((p) => p.topic === topic && p.e !== e)
    const ranked = shuffle(sameTopic, r).sort((a, b) => Math.abs(a.e[2] - e[2]) - Math.abs(b.e[2] - e[2]))
    const distractors = ranked.slice(0, 5)
    const picked = shuffle(distractors, r).slice(0, 3)
    const options = shuffle([e, ...picked.map((p) => p.e)], r)
    return {
      kind,
      prompt: kind === 'en-vi' ? e[0] : e[1],
      choices: options.map((o) => (kind === 'en-vi' ? o[1] : o[0])),
      answer: options.indexOf(e),
      en: e[0],
      vi: e[1],
    }
  })
}

function buildListening(room: Room, r: Rng): ListeningQuestion[] {
  const topics = room.topic === 'random' ? TOPIC_IDS : [room.topic]
  const pool: { text: string; level: number }[] = []
  for (const t of topics) SENTENCES[t].forEach((list, i) => list.forEach((text) => pool.push({ text, level: i })))
  const w = LEVEL_WEIGHTS[room.difficulty]
  let chosen = sample(pool, (p) => w[p.level], room.rounds, r)
  if (chosen.length < room.rounds) {
    const rest = shuffle(
      pool.filter((p) => !chosen.includes(p)),
      r,
    )
    chosen = chosen.concat(rest.slice(0, room.rounds - chosen.length))
  }
  // loosely ramp up: easier sentences tend to come first
  return chosen
    .map((c) => ({ text: c.text, k: c.level + r() * 1.4 }))
    .sort((a, b) => a.k - b.k)
    .map((c) => ({ text: c.text }))
}

const cache = new Map<string, VocabQuestion[] | ListeningQuestion[]>()

/** Questions are a pure function of the room config + seed, so they are never persisted. */
export function questionsFor(room: Room): VocabQuestion[] | ListeningQuestion[] {
  const key = `${room.id}:${room.seed}:${room.mode}:${room.topic}:${room.difficulty}:${room.rounds}`
  let q = cache.get(key)
  if (!q) {
    const r = mulberry32(room.seed)
    q = room.mode === 'vocab' ? buildVocab(room, r) : buildListening(room, r)
    if (cache.size > 300) cache.clear()
    cache.set(key, q)
  }
  return q
}

export const vocabQ = (room: Room, i: number) => (questionsFor(room) as VocabQuestion[])[i]
export const listeningQ = (room: Room, i: number) => (questionsFor(room) as ListeningQuestion[])[i]
