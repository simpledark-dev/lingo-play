import { ChevronRight, Crown, Pencil } from 'lucide-react'
import { useState } from 'react'
import { tierOf } from '../game/tiers'
import type { Player } from '../game/types'
import { useLoading } from '../lib/hooks'
import { go, setUi } from '../lib/ui'
import { me, rankOf, rankings, useWorld } from '../sim/store'
import { Avatar } from '../ui/Avatar'
import { cx, Flag, fmt, Loading, ProgressBar, RankBadge } from '../ui/bits'

export function MyCard() {
  useWorld()
  const p = me()
  if (!p) return null
  const { tier, next, progress, toNext } = tierOf(p.rating)
  return (
    <div className="rounded-2xl border border-line bg-panel p-4">
      <div className="flex items-center gap-3.5">
        <button onClick={() => setUi({ profile: 'me' })} className="rounded-full">
          <Avatar size={60} ring="#4f8dff" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[17px] font-extrabold">{p.name}</span>
            <Flag country={p.country} size={20} />
          </div>
          <div className="tabular mt-0.5 text-[18px] font-extrabold text-gold">{fmt(p.rating)}</div>
        </div>
        <button
          onClick={() => setUi({ profile: 'me' })}
          className="flex h-8 w-8 items-center justify-center self-start rounded-full bg-raise text-soft transition hover:text-white"
          title="Edit profile"
        >
          <Pencil size={14} />
        </button>
      </div>
      <button onClick={() => go('rankings')} className="group mt-4 block w-full border-t border-white/5 pt-3.5 text-left">
        <div className="flex items-center gap-3">
          <ProgressBar value={progress} className="flex-1" color="linear-gradient(90deg,#fd7b3a,#fbbf3b)" />
          <span className="flex items-center gap-1.5 text-[15px] font-extrabold" style={{ color: tier.color }}>
            <RankBadge tier={tier} size={18} />
            {tier.name}
          </span>
          <ChevronRight size={18} className="text-mute transition group-hover:translate-x-0.5" />
        </div>
        {next && (
          <div className="mt-2 text-[12.500px] text-mute">
            <span className="font-extrabold text-soft">{toNext} more</span> to reach {next.name}
          </div>
        )}
      </button>
    </div>
  )
}

type Tab = 'all' | 'friends' | 'top'

function PlayerLine({ p, rank, meId }: { p: Player; rank: number; meId: string | null }) {
  const isMe = p.id === meId
  const dot = !p.online ? 'bg-[#4a5472]' : p.role === 'player' ? 'bg-flame-2' : p.role === 'spectator' ? 'bg-azure-2' : 'bg-mint'
  const title = !p.online ? 'Offline' : p.role === 'player' ? `Playing in #${p.roomId}` : p.role === 'spectator' ? `Watching #${p.roomId}` : 'In the lobby'
  return (
    <button
      onClick={() => setUi({ profile: p.id })}
      title={title}
      className={cx(
        'flex h-[34px] w-full items-center gap-2.5 rounded-lg px-2 text-left transition',
        isMe ? 'bg-[#1d2f52] ring-1 ring-[#2f4f8f]' : 'hover:bg-white/5',
      )}
    >
      <span className={cx('h-2 w-2 shrink-0 rounded-full', dot)} />
      <Avatar size={26} />
      <Flag country={p.country} size={16} />
      <span className={cx('min-w-0 flex-1 truncate text-[14.500px]', isMe ? 'font-extrabold text-white' : 'text-soft', !p.online && 'opacity-60')}>
        {p.name}
      </span>
      {rank === 1 && <Crown size={15} className="text-gold" fill="currentColor" />}
      <span className={cx('tabular w-10 text-right text-[14px] font-bold', rank === 1 ? 'text-gold' : isMe ? 'text-white' : 'text-soft')}>
        {p.rating}
      </span>
      <span className="tabular w-9 text-right text-[13px] text-mute">#{rank}</span>
    </button>
  )
}

export function OnlinePanel() {
  const w = useWorld()
  const [tab, setTab] = useState<Tab>('all')
  const loading = useLoading(tab, 350, 650)
  const { list } = rankings()
  const online = list.filter((p) => p.online)
  const shown =
    tab === 'all' ? online : tab === 'top' ? list.slice(0, 30) : list.filter((p) => w.friends.includes(p.id))

  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-line bg-panel p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[19px] font-extrabold">Online Players</h2>
        <span className="tabular flex items-center gap-2 text-[16px] font-bold text-soft">
          <span className="h-2.5 w-2.5 rounded-full bg-mint shadow-[0_0_8px_#32d583]" />
          {fmt(online.length)}
        </span>
      </div>
      <div className="mt-3 flex rounded-xl bg-[#202641] p-0.5 text-[13px]">
        {(
          [
            ['all', 'All'],
            ['friends', w.friends.length ? `Friends (${w.friends.length})` : 'Friends'],
            ['top', 'Top Players'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cx(
              'h-8 flex-1 rounded-[10px] transition',
              tab === key ? 'bg-gradient-to-b from-azure-2 to-azure font-extrabold text-white shadow' : 'text-soft hover:text-white',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="scroll-slim -mr-2 mt-2.5 min-h-0 flex-1 space-y-px overflow-y-auto pr-1">
        {loading ? <Loading className="!py-10" /> : shown.map((p) => <PlayerLine key={p.id} p={p} rank={rankOf(p.id)} meId={w.meId} />)}
        {!loading && tab === 'friends' && shown.length === 0 && (
          <div className="px-3 py-10 text-center text-[14px] leading-relaxed text-mute">
            No friends yet.
            <br />
            Tap any player to see their stats and send a friend request.
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center justify-center gap-4 border-t border-white/5 pt-3 text-[12px] text-mute">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-mint" />
          Lobby
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-flame-2" />
          Playing
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-azure-2" />
          Watching
        </span>
      </div>
    </div>
  )
}
