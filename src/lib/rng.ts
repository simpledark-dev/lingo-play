export type Rng = () => number

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const rand = (min: number, max: number, r: Rng = Math.random) => min + r() * (max - min)
export const randInt = (min: number, max: number, r: Rng = Math.random) => Math.floor(rand(min, max + 1, r))
export const pick = <T>(arr: readonly T[], r: Rng = Math.random): T => arr[Math.floor(r() * arr.length)]
export const chance = (p: number, r: Rng = Math.random) => r() < p
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export function shuffle<T>(arr: readonly T[], r: Rng = Math.random): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** roughly normal, mean 0 sd 1 */
export function gauss(r: Rng = Math.random) {
  let u = 0
  for (let i = 0; i < 6; i++) u += r()
  return (u - 3) / 0.7071
}

export function weightedPick<T>(items: readonly T[], weight: (t: T) => number, r: Rng = Math.random): T | undefined {
  let total = 0
  for (const it of items) total += Math.max(0, weight(it))
  if (total <= 0) return items.length ? pick(items, r) : undefined
  let x = r() * total
  for (const it of items) {
    x -= Math.max(0, weight(it))
    if (x <= 0) return it
  }
  return items[items.length - 1]
}
