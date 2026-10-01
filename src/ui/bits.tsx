import { Armchair, BookA, Castle, Headphones, LoaderCircle, Signal, Spotlight, type LucideIcon } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { DIFFICULTIES, HAS_LEVEL } from '../game/config'
import { tierOf, type Tier } from '../game/tiers'
import type { Country, Difficulty, Mode, Room } from '../game/types'

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ')

export function Flag({ country, size = 18 }: { country: Country; size?: number }) {
  const w = size
  const h = Math.round(size * 0.7)
  const body: Record<Country, ReactNode> = {
    vn: (
      <>
        <rect width="20" height="14" fill="#da251d" />
        <path d="M10 2.6l1.06 3.05h3.2l-2.6 1.9 1 3.07L10 8.72l-2.66 1.9 1-3.07-2.6-1.9h3.2z" fill="#ffde21" />
      </>
    ),
    jp: (
      <>
        <rect width="20" height="14" fill="#fff" />
        <circle cx="10" cy="7" r="3.6" fill="#d7263d" />
      </>
    ),
    th: (
      <>
        <rect width="20" height="14" fill="#d7263d" />
        <rect y="2.3" width="20" height="9.4" fill="#fff" />
        <rect y="4.6" width="20" height="4.8" fill="#2d3a8c" />
      </>
    ),
    id: (
      <>
        <rect width="20" height="14" fill="#fff" />
        <rect width="20" height="7" fill="#d7263d" />
      </>
    ),
    kr: (
      <>
        <rect width="20" height="14" fill="#fff" />
        <path d="M6.4 7a3.6 3.6 0 0 1 7.2 0z" fill="#d7263d" />
        <path d="M6.4 7a3.6 3.6 0 0 0 7.2 0z" fill="#2d4fa3" />
      </>
    ),
    fr: (
      <>
        <rect width="20" height="14" fill="#fff" />
        <rect width="6.67" height="14" fill="#2d4fa3" />
        <rect x="13.33" width="6.67" height="14" fill="#d7263d" />
      </>
    ),
    de: (
      <>
        <rect width="20" height="14" fill="#1b1b1b" />
        <rect y="4.67" width="20" height="4.67" fill="#d7263d" />
        <rect y="9.33" width="20" height="4.67" fill="#ffce00" />
      </>
    ),
    us: (
      <>
        <rect width="20" height="14" fill="#fff" />
        {[0, 4, 8, 12].map((y) => (
          <rect key={y} y={y} width="20" height="2" fill="#c8323c" />
        ))}
        <rect width="9" height="8" fill="#2d3a8c" />
      </>
    ),
  }
  return (
    <svg viewBox="0 0 20 14" width={w} height={h} className="shrink-0 rounded-[3px]" aria-hidden>
      {body[country]}
    </svg>
  )
}

/** Shield emblem for a rating tier. */
export function RankBadge({ tier, size = 28 }: { tier: Tier; size?: number }) {
  const id = useId()
  const wings = tier.key === 'master' || tier.key === 'grandmaster'
  return (
    <svg viewBox="0 0 48 52" width={size} height={(size * 52) / 48} className="shrink-0" aria-hidden>
      <defs>
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={tier.color} />
          <stop offset="1" stopColor={tier.dark} />
        </linearGradient>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {wings && (
        <path d="M5 13L0 9v13c0 6 2.5 11 6 15zM43 13l5-4v13c0 6-2.5 11-6 15z" fill={tier.dark} />
      )}
      <path d="M24 2l19 6.8V26c0 12-8.6 20-19 24.4C13.600 46 5 38 5 26V8.8z" fill={`url(#${id}a)`} />
      <path d="M24 2l19 6.8V26c0 12-8.6 20-19 24.4C13.600 46 5 38 5 26V8.800z" fill={`url(#${id}b)`} />
      <path d="M24 7.600l14.200 5.100V26c0 9.200-6.300 15.500-14.200 19.200C16.100 41.500 9.800 35.200 9.800 26V12.700z" fill="#000" fillOpacity="0.28" />
      <path
        d="M24 14.5l3.060 6.560 7.140.840-5.280 4.900 1.400 7.060L24 30.340l-6.320 3.520 1.400-7.060-5.280-4.900 7.140-.840z"
        fill="#fff"
        fillOpacity="0.95"
      />
    </svg>
  )
}

export function TierChip({ rating, className }: { rating: number; className?: string }) {
  const { tier } = tierOf(rating)
  return (
    <span className={cx('inline-flex items-center gap-1.5 font-extrabold', className)} style={{ color: tier.color }}>
      <RankBadge tier={tier} size={16} />
      {tier.name}
    </span>
  )
}

const MODE_STYLE: Record<Mode, string> = {
  listening: 'from-[#9b6bff] to-[#6a3be0]',
  vocab: 'from-[#3ed598] to-[#1f9a68]',
  spotlight: 'from-[#ffcf4a] to-[#f08c1a]',
  hotseat: 'from-[#ff7a7a] to-[#d93a5a]',
  tower: 'from-[#5cc8ff] to-[#2a7bd6]',
}
const MODE_ICON: Record<Mode, LucideIcon> = { listening: Headphones, vocab: BookA, spotlight: Spotlight, hotseat: Armchair, tower: Castle }

export function ModeIcon({ mode, size = 40 }: { mode: Mode; size?: number }) {
  const Icon = MODE_ICON[mode]
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-b text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_10px_rgba(0,0,0,0.3)]',
        MODE_STYLE[mode],
      )}
      style={{ width: size, height: size, borderRadius: size * 0.28 }}
    >
      <Icon size={size * 0.56} strokeWidth={2.4} />
    </span>
  )
}

const DIFF_STYLE: Record<Difficulty, string> = {
  easy: 'bg-[#14342c] text-[#5ee0a6] border-[#1f5444]',
  medium: 'bg-[#3a3323] text-[#fbc94b] border-[#5a4c26]',
  hard: 'bg-[#3d2230] text-[#ff8196] border-[#643046]',
}

export function DifficultyChip({ difficulty, className }: { difficulty: Difficulty; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[13px] font-extrabold',
        DIFF_STYLE[difficulty],
        className,
      )}
    >
      <Signal size={14} strokeWidth={3} />
      {DIFFICULTIES[difficulty].name}
    </span>
  )
}

/** the level a room plays at; Hot Seat and Tower Climb change level from turn to turn */
export function LevelChip({ room, className }: { room: Room; className?: string }) {
  if (HAS_LEVEL[room.mode]) return <DifficultyChip difficulty={room.difficulty} className={className} />
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-lg border border-[#33437a] bg-[#1b2547] px-2.5 py-1 text-[13px] font-extrabold text-[#a9bcf5]', className)}>
      <Signal size={14} strokeWidth={3} />
      {room.mode === 'tower' ? 'Rising' : 'Mixed'}
    </span>
  )
}

export function ProgressBar({ value, color = 'var(--color-flame)', className }: { value: number; color?: string; className?: string }) {
  return (
    <div className={cx('h-2 overflow-hidden rounded-full bg-white/10', className)}>
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }}
      />
    </div>
  )
}

export function timeAgo(at: number, now: number) {
  const s = Math.max(0, Math.round((now - at) / 1000))
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return h === 1 ? '1 hour ago' : `${h} hours ago`
  const d = Math.round(h / 24)
  return d === 1 ? 'yesterday' : `${d} days ago`
}

export const ordinal = (n: number) => `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : Math.min(n % 10, 4) % 4]}`

export const fmt = (n: number) => n.toLocaleString('en-US')

export function Spinner({ size = 18, className }: { size?: number; className?: string }) {
  return <LoaderCircle size={size} strokeWidth={2.6} className={cx('shrink-0 animate-spin', className)} aria-label="Loading" />
}

/** centred spinner with a caption, for a panel whose data is still loading */
export function Loading({ label, className }: { label?: string; className?: string }) {
  return (
    <div className={cx('flex flex-col items-center justify-center gap-3 py-14 text-[14px] text-mute', className)}>
      <Spinner size={30} className="text-azure-2" />
      {label}
    </div>
  )
}
