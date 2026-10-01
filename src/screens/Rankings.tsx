import { ChevronDown, Crown } from 'lucide-react'
import { useState } from 'react'
import { MODES } from '../game/config'
import { TIERS, tierIndex, tierOf } from '../game/tiers'
import type { Mode, Player } from '../game/types'
import { useLoading } from '../lib/hooks'
import { setUi } from '../lib/ui'
import { me, useWorld } from '../sim/store'
import { Avatar } from '../ui/Avatar'
import { cx, Flag, fmt, Loading, ProgressBar, RankBadge, TierChip } from '../ui/bits'

type Board = 'overall' | Mode

const ratingFor = (p: Player, board: Board) => (board === 'overall' ? p.rating : p.skills[board])

function Podium({ p, place, board }: { p: Player; place: number; board: Board }) {
  const tone = ['from-[#fbbf3b] to-[#f59e0b]', 'from-[#cbd5e1] to-[#94a3b8]', 'from-[#e09a5f] to-[#b9713a]'][place - 1]
  return (
    <button
      onClick={() => setUi({ profile: p.id })}
      className={cx(
        'relative flex flex-1 flex-col items-center rounded-2xl border border-line bg-panel px-2 pb-4 transition hover:bg-panel-2',
        place === 1 ? 'pt-5 desk:-mt-3' : 'pt-4',
      )}
    >
      <span className={cx('absolute -top-3 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-b text-[14px] font-black text-[#1a1408]', tone)}>
        {place}
      </span>
      <Avatar size={place === 1 ? 72 : 60} ring={place === 1 ? '#fbbf3b' : '#3a4568'} />
      <span className="mt-2.5 flex max-w-full items-center gap-1.5">
        <span className="truncate text-[15px] font-extrabold">{p.name}</span>
        <Flag country={p.country} size={15} />
      </span>
      <span className="tabular mt-0.5 flex items-center gap-1 text-[17px] font-black text-gold">
        {place === 1 && <Crown size={16} fill="currentColor" />}
        {fmt(ratingFor(p, board))}
      </span>
      <TierChip rating={ratingFor(p, board)} className="mt-1 text-[12.500px]" />
    </button>
  )
}

const ROW = 'grid grid-cols-[44px_minmax(0,1fr)_64px] items-center gap-3 sm:grid-cols-[52px_minmax(0,1.4fr)_minmax(0,1fr)_72px_64px_64px]'

function Row({ p, rank, board, isMe }: { p: Player; rank: number; board: Board; isMe: boolean }) {
  const rate = p.games ? Math.round((p.wins / p.games) * 100) : 0
  return (
    <button
      onClick={() => setUi({ profile: p.id })}
      className={cx(ROW, 'h-[52px] w-full px-4 text-left transition', isMe ? 'bg-[#1d2f52] ring-1 ring-inset ring-[#2f4f8f]' : 'border-t border-line hover:bg-white/[0.035]')}
    >
      <span className={cx('tabular text-[15px] font-extrabold', rank <= 3 ? 'text-gold' : 'text-mute')}>#{rank}</span>
      <span className="flex min-w-0 items-center gap-3">
        <span className="relative">
          <Avatar size={34} />
          {p.online && <span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-panel-2 bg-mint" />}
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-extrabold">{p.name}</span>
            <Flag country={p.country} size={15} />
            {isMe && <span className="rounded bg-azure px-1.5 text-[10px] font-black uppercase">You</span>}
          </span>
          <span className="block sm:hidden">
            <TierChip rating={ratingFor(p, board)} className="text-[12px]" />
          </span>
        </span>
      </span>
      <span className="hidden sm:block">
        <TierChip rating={ratingFor(p, board)} className="text-[13.500px]" />
      </span>
      <span className="tabular text-right text-[16px] font-black text-white">{fmt(ratingFor(p, board))}</span>
      <span className="tabular hidden text-right text-[14px] text-soft sm:block">{fmt(p.games)}</span>
      <span className="tabular hidden text-right text-[14px] text-soft sm:block">{p.games ? `${rate}%` : '-'}</span>
    </button>
  )
}

function TitleLadder({ rating }: { rating: number }) {
  const current = tierIndex(rating)
  return (
    <div className="rounded-2xl border border-line bg-panel p-4">
      <h3 className="text-[17px] font-extrabold">Titles</h3>
      <p className="mt-0.5 text-[13px] text-mute">Win games to raise your rating and earn the next title.</p>
      <div className="mt-3 space-y-1">
        {TIERS.slice()
          .reverse()
          .map((t) => {
            const i = TIERS.indexOf(t)
            const isCurrent = i === current
            const isNext = i === current + 1
            return (
              <div
                key={t.name}
                className={cx(
                  'flex h-10 items-center gap-2.5 rounded-xl px-2.5 text-[14px]',
                  isCurrent ? 'bg-[#1d2f52] ring-1 ring-[#2f4f8f]' : i < current ? 'opacity-45' : '',
                )}
              >
                <RankBadge tier={t} size={20} />
                <span className="font-extrabold" style={{ color: t.color }}>
                  {t.name}
                </span>
                {isCurrent && <span className="rounded bg-azure px-1.5 text-[10px] font-black uppercase">You</span>}
                {isNext && <span className="text-[12px] font-bold text-soft">{t.min - rating} to go</span>}
                <span className="tabular ml-auto text-[13px] text-mute">
                  {t.max === Infinity ? `${fmt(t.min)}+` : t.min === 0 ? `under ${t.max}` : `${fmt(t.min)} - ${fmt(t.max - 1)}`}
                </span>
              </div>
            )
          })}
      </div>
    </div>
  )
}

function StandingCard({ self, rank }: { self: Player; rank: number }) {
  const standing = tierOf(self.rating)
  return (
    <div className="rounded-2xl border border-[#6b4d1f] bg-gradient-to-b from-[#2b2416] to-panel p-4">
      <div className="flex items-center gap-3">
        <RankBadge tier={standing.tier} size={44} />
        <div className="min-w-0 flex-1">
          <div className="text-[18px] font-extrabold" style={{ color: standing.tier.color }}>
            {standing.tier.name}
          </div>
          <div className="tabular text-[13px] text-soft">
            {fmt(self.rating)}
            {standing.next && <span className="text-mute"> / {fmt(standing.next.min)}</span>}
          </div>
        </div>
        <div className="text-right">
          <div className="tabular text-[20px] leading-none font-black">#{rank}</div>
          <div className="mt-1 text-[12px] text-mute">Global rank</div>
        </div>
      </div>
      <ProgressBar value={standing.progress} className="mt-3.5" color="linear-gradient(90deg,#fd7b3a,#fbbf3b)" />
      {standing.next && (
        <p className="mt-2.5 text-[13.500px] text-soft">
          <span className="font-extrabold text-white">{standing.toNext} more</span> rating to reach{' '}
          <span className="font-extrabold" style={{ color: standing.next.color }}>
            {standing.next.name}
          </span>
        </p>
      )}
    </div>
  )
}

export function Rankings() {
  const w = useWorld()
  const [board, setBoard] = useState<Board>('overall')
  const self = me()
  const list = Object.values(w.players).sort((a, b) => ratingFor(b, board) - ratingFor(a, board) || a.name.localeCompare(b.name))
  const myRank = self ? list.indexOf(self) + 1 : 0
  const top = list.slice(0, 100)
  const [showTitles, setShowTitles] = useState(false)
  const loading = useLoading(board)

  return (
    <div className="flex h-full gap-5 desk:p-5">
      <main className="scroll-slim min-w-0 flex-1 overflow-y-auto px-3 pt-4 pb-4 desk:p-0">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[26px] leading-tight font-black">Rankings</h1>
            <p className="text-[14px] text-mute">{fmt(list.length)} ranked players. Updated live after every game.</p>
          </div>
          <div className="flex rounded-xl bg-[#202641] p-0.5 text-[14px]">
            {(
              [
                ['overall', 'Overall'],
                ['vocab', MODES.vocab.short],
                ['listening', MODES.listening.short],
              ] as [Board, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setBoard(key)}
                className={cx(
                  'h-9 rounded-[10px] px-4 transition',
                  board === key ? 'bg-gradient-to-b from-azure-2 to-azure font-extrabold text-white shadow' : 'text-soft hover:text-white',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {self && (
          <div className="mt-4 space-y-2.5 desk:hidden">
            <StandingCard self={self} rank={myRank} />
            <button
              onClick={() => setShowTitles(!showTitles)}
              className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-line bg-panel text-[14px] text-soft"
            >
              {showTitles ? 'Hide titles' : 'See all titles'}
              <ChevronDown size={16} className={cx('transition', showTitles && 'rotate-180')} />
            </button>
            {showTitles && <TitleLadder rating={self.rating} />}
          </div>
        )}

        {loading ? (
          <Loading label="Loading rankings..." className="mt-6 rounded-2xl border border-line bg-panel-2 !py-24" />
        ) : (
          <>
            <div className="mt-7 flex items-end gap-2.5 desk:gap-4">
              {[top[1], top[0], top[2]].map((p, i) => p && <Podium key={p.id} p={p} place={[2, 1, 3][i]} board={board} />)}
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-panel-2">
              <div className={cx(ROW, 'bg-[#232a42] px-4 py-2.5 text-[13.500px] text-soft')}>
                <span>Rank</span>
                <span>Player</span>
                <span className="hidden sm:block">Title</span>
                <span className="text-right">Rating</span>
                <span className="hidden text-right sm:block">Games</span>
                <span className="hidden text-right sm:block">Win rate</span>
              </div>
              {top.slice(3).map((p, i) => (
                <Row key={p.id} p={p} rank={i + 4} board={board} isMe={p.id === w.meId} />
              ))}
            </div>
            {self && myRank > 0 && (
              <div className="sticky bottom-0 -mx-3 -mb-4 bg-gradient-to-t from-page from-70% to-transparent px-3 pt-5 pb-3 desk:mx-0 desk:mb-0 desk:px-0 desk:pb-0">
                <div className="overflow-hidden rounded-2xl">
                  <Row p={self} rank={myRank} board={board} isMe />
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {self && (
        <aside className="scroll-slim hidden w-[312px] shrink-0 flex-col gap-4 overflow-y-auto desk:flex">
          <StandingCard self={self} rank={myRank} />
          <TitleLadder rating={self.rating} />
        </aside>
      )}
    </div>
  )
}
