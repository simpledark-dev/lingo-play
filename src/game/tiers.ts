export interface Tier {
  key: 'rookie' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'master' | 'grandmaster'
  name: string
  min: number
  /** exclusive upper bound; Infinity for the last tier */
  max: number
  color: string
  dark: string
}

const T = (key: Tier['key'], name: string, min: number, max: number, color: string, dark: string): Tier => ({
  key,
  name,
  min,
  max,
  color,
  dark,
})

export const TIERS: Tier[] = [
  T('rookie', 'Rookie', 0, 900, '#94a3b8', '#475569'),
  T('bronze', 'Bronze I', 900, 1000, '#e09a5f', '#9a5a2a'),
  T('bronze', 'Bronze II', 1000, 1100, '#e09a5f', '#9a5a2a'),
  T('silver', 'Silver I', 1100, 1200, '#cbd5e1', '#64748b'),
  T('silver', 'Silver II', 1200, 1300, '#cbd5e1', '#64748b'),
  T('gold', 'Gold I', 1300, 1400, '#fbbf24', '#b45309'),
  T('gold', 'Gold II', 1400, 1500, '#fbbf24', '#b45309'),
  T('platinum', 'Platinum I', 1500, 1600, '#5eead4', '#0f766e'),
  T('platinum', 'Platinum II', 1600, 1700, '#5eead4', '#0f766e'),
  T('diamond', 'Diamond I', 1700, 1800, '#7cc4ff', '#1d4ed8'),
  T('diamond', 'Diamond II', 1800, 1900, '#7cc4ff', '#1d4ed8'),
  T('master', 'Master', 1900, 2100, '#c4a1ff', '#6d28d9'),
  T('grandmaster', 'Grandmaster', 2100, Infinity, '#ff8fa3', '#be123c'),
]

export function tierIndex(rating: number) {
  for (let i = TIERS.length - 1; i >= 0; i--) if (rating >= TIERS[i].min) return i
  return 0
}

export function tierOf(rating: number) {
  const i = tierIndex(rating)
  const tier = TIERS[i]
  const next = TIERS[i + 1] as Tier | undefined
  const span = (next ? next.min : tier.min + 200) - tier.min
  const progress = next ? Math.max(0, Math.min(1, (rating - tier.min) / span)) : 1
  return { tier, next, progress, toNext: next ? next.min - rating : 0 }
}
