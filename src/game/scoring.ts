import { REPLAY_COST } from './config'

export function normalizeWords(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9'\s]/g, ' ')
    .replace(/(^|\s)'+|'+(\s|$)/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

export type DiffOp = { op: 'ok' | 'wrong' | 'missing' | 'extra'; word: string; typed?: string }

/** Word-level alignment of what was typed against the target sentence. */
export function diffWords(target: string, typed: string): { ops: DiffOp[]; errors: number; acc: number } {
  const a = normalizeWords(target)
  const b = normalizeWords(typed)
  const n = a.length
  const m = b.length
  const d: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = 0; i <= n; i++) d[i][0] = i
  for (let j = 0; j <= m; j++) d[0][j] = j
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  const ops: DiffOp[] = []
  let i = n
  let j = m
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1] && d[i][j] === d[i - 1][j - 1]) {
      ops.push({ op: 'ok', word: a[i - 1] })
      i--
      j--
    } else if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + 1) {
      ops.push({ op: 'wrong', word: a[i - 1], typed: b[j - 1] })
      i--
      j--
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      ops.push({ op: 'missing', word: a[i - 1] })
      i--
    } else {
      ops.push({ op: 'extra', word: b[j - 1] })
      j--
    }
  }
  ops.reverse()
  const errors = d[n][m]
  const acc = n === 0 ? 0 : Math.max(0, 1 - errors / n)
  return { ops, errors, acc }
}

/** left = fraction of the round timer still remaining when the answer came in */
export function vocabPoints(correct: boolean, left: number) {
  return correct ? 100 + Math.round(50 * Math.max(0, Math.min(1, left))) : 0
}

export function listeningPoints(acc: number, left: number, replays: number) {
  if (acc <= 0) return 0
  const base = Math.round(100 * acc)
  const bonus = acc === 1 ? Math.round(20 * Math.max(0, Math.min(1, left))) : 0
  return Math.max(0, base + bonus - replays * REPLAY_COST)
}

export function verdict(acc: number): { label: string; tone: 'good' | 'warn' | 'bad' } {
  if (acc >= 0.999) return { label: 'Correct', tone: 'good' }
  if (acc >= 0.7) return { label: 'Minor mistake', tone: 'warn' }
  if (acc > 0) return { label: 'Partly right', tone: 'warn' }
  return { label: 'Missed', tone: 'bad' }
}

/**
 * Multiplayer Elo: each player's result is the share of opponents they beat,
 * compared to the share they were expected to beat.
 */
export function eloDeltas(entries: { id: string; rating: number; score: number; k: number }[]): Record<string, number> {
  const out: Record<string, number> = {}
  const n = entries.length
  if (n < 2) {
    for (const e of entries) out[e.id] = 0
    return out
  }
  for (const a of entries) {
    let expected = 0
    let actual = 0
    for (const b of entries) {
      if (a === b) continue
      expected += 1 / (1 + Math.pow(10, (b.rating - a.rating) / 400))
      actual += a.score > b.score ? 1 : a.score === b.score ? 0.5 : 0
    }
    const scale = 1 + (n - 2) * 0.25
    out[a.id] = Math.round((a.k * scale * (actual - expected)) / (n - 1))
  }
  return out
}
