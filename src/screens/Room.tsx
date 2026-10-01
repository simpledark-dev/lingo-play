import { ArrowLeft, CircleCheck, CircleX, Clock, Crown, Eye, Lock, Minus, Play, Plus, RotateCcw, Search, Timer, TrendingDown, TrendingUp, UserPlus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { sfx } from '../audio/audio'
import { MODES, REACTIONS, TOPICS } from '../game/config'
import { tierOf } from '../game/tiers'
import type { Game, Player, Room, World } from '../game/types'
import { useLoading, useNow, usePending } from '../lib/hooks'
import { go, setUi } from '../lib/ui'
import { invitePlayer, joinRoom, leaveCurrentRoom, rematch, sendReaction, startRoom, watchRoom } from '../sim/actions'
import { getWorld, rankings, useWorld } from '../sim/store'
import { Avatar } from '../ui/Avatar'
import { cx, DifficultyChip, Flag, fmt, Loading, ModeIcon, ordinal, ProgressBar, RankBadge, Spinner } from '../ui/bits'
import { Modal } from '../ui/Modal'
import { lastReaction, ListeningPlayerCard, ListeningStage, ReactionBubble, VocabPlayerCard, VocabStage } from './stages'

const panel = 'rounded-2xl border border-white/10 bg-[#0b1426]/88 backdrop-blur-md'

function standings(room: Room, game: Game) {
  return room.players.slice().sort((a, b) => (game.scores[b] ?? 0) - (game.scores[a] ?? 0))
}

// ---------------------------------------------------------------- left column

function GameInfo({ room }: { room: Room }) {
  const mode = MODES[room.mode]
  return (
    <div className={cx(panel, 'p-3.5')}>
      <div className="flex items-center gap-3">
        <ModeIcon mode={room.mode} size={48} />
        <div className="min-w-0">
          <div className="truncate text-[17px] font-extrabold">{mode.name}</div>
          <div className="text-[13px] text-soft">
            Room #{room.id} · {room.players.length}/{room.max} players
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[12.500px] text-soft">
        <span className="rounded-lg bg-white/[0.07] px-2 py-1">{TOPICS[room.topic]}</span>
        <DifficultyChip difficulty={room.difficulty} className="!px-2 !py-[3px] !text-[12px]" />
        <span className="rounded-lg bg-white/[0.07] px-2 py-1">
          {room.rounds} {mode.unit}
        </span>
        <span className="rounded-lg bg-white/[0.07] px-2 py-1">{room.secs}s each</span>
        {room.priv && (
          <span className="flex items-center gap-1 rounded-lg bg-white/[0.07] px-2 py-1">
            <Lock size={12} />
            Invite only
          </span>
        )}
      </div>
    </div>
  )
}

function ReactionButtons({ room, compact }: { room: Room; compact?: boolean }) {
  const [cooldown, setCooldown] = useState(false)
  const send = (text: string) => {
    if (cooldown) return
    sendReaction(room.id, text)
    setCooldown(true)
    setTimeout(() => setCooldown(false), 1500)
  }
  return (
    <div className={cx(compact ? 'no-scrollbar flex gap-2 overflow-x-auto px-3 py-2.5' : 'flex flex-wrap gap-1.5')}>
      {REACTIONS.map((text) => (
        <button
          key={text}
          onClick={() => send(text)}
          disabled={cooldown}
          className={cx(
            'shrink-0 rounded-xl border border-[#2c3a63] bg-[#16213f] text-[13.500px] font-bold text-soft transition hover:border-azure-2 hover:text-white active:scale-95 disabled:opacity-50',
            compact ? 'h-9 px-3.5 whitespace-nowrap' : 'h-[34px] px-3',
          )}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

function ReactionsPanel({ w, room, now }: { w: World; room: Room; now: number }) {
  const feed = room.reactions.slice(-7)
  const scroller = useRef<HTMLDivElement>(null)
  const lastId = feed[feed.length - 1]?.id
  useEffect(() => {
    scroller.current?.scrollTo({ top: 1e6 })
  }, [lastId])
  return (
    <div className={cx(panel, 'flex min-h-0 flex-1 flex-col p-3.5')}>
      <div className="flex items-center justify-between">
        <h3 className="text-[16px] font-extrabold">Reactions</h3>
        {room.spectators.length > 0 && (
          <span className="tabular flex items-center gap-1.5 text-[12.500px] text-soft" title="Spectators">
            <Eye size={14} />
            {room.spectators.length} watching
          </span>
        )}
      </div>
      <div ref={scroller} className="scroll-slim mt-2 min-h-[72px] flex-1 space-y-2 overflow-y-auto">
        {feed.length === 0 && <div className="pt-3 text-[13px] text-mute">Say hi with a quick reaction.</div>}
        {feed.map((r) => {
          const p = w.players[r.pid]
          if (!p) return null
          const watching = !room.players.includes(r.pid)
          return (
            <div key={r.id} className={cx('flex items-center gap-2.5', now - r.at < 600 && 'animate-rise')}>
              <Avatar size={28} />
              <div className="min-w-0 leading-tight">
                <div className="truncate text-[12px] text-mute">
                  {p.id === w.meId ? 'You' : p.name}
                  {watching && ' (watching)'}
                </div>
                <div className="text-[14px] font-bold">{r.text}</div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-3 border-t border-white/10 pt-3">
        <ReactionButtons room={room} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- right column

function StandingsPanel({ w, room, game }: { w: World; room: Room; game: Game }) {
  const order = standings(room, game)
  const top = Math.max(1, ...order.map((pid) => game.scores[pid] ?? 0))
  const colors = ['#32d583', '#4f8dff', '#9b6bff', '#38bdf8']
  return (
    <div className={cx(panel, 'p-3.5')}>
      <h3 className="text-[17px] font-extrabold">Live Standings</h3>
      <div className="mt-2.5 space-y-1.5">
        {order.map((pid, i) => {
          const p = w.players[pid]
          if (!p) return null
          const isMe = pid === w.meId
          return (
            <button
              key={pid}
              onClick={() => setUi({ profile: pid })}
              className={cx('flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition', isMe ? 'bg-white/10' : 'hover:bg-white/5')}
            >
              {i === 0 && (game.scores[pid] ?? 0) > 0 ? (
                <Crown size={22} className="w-6 text-gold" fill="currentColor" />
              ) : (
                <span
                  className={cx(
                    'flex h-6 w-6 items-center justify-center rounded-full text-[13px] font-black',
                    i === 1 ? 'bg-[#2f6bea]' : i === 2 ? 'bg-[#b9713a]' : 'bg-white/15',
                  )}
                >
                  {i + 1}
                </span>
              )}
              <Avatar size={38} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[14.500px] font-extrabold">{isMe ? 'You' : p.name}</span>
                  <span className={cx('tabular text-[15px] font-black', i === 0 ? 'text-gold' : 'text-white')}>{fmt(game.scores[pid] ?? 0)}</span>
                </span>
                <ProgressBar value={(game.scores[pid] ?? 0) / top} color={colors[i % colors.length]} className="mt-1 !h-1.5" />
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function RoundList({ w, room, game, playing }: { w: World; room: Room; game: Game; playing: boolean }) {
  const current = useRef<HTMLDivElement>(null)
  useEffect(() => {
    current.current?.scrollIntoView({ block: 'nearest' })
  }, [game.round])
  return (
    <div className={cx(panel, 'scroll-slim min-h-0 flex-1 overflow-y-auto p-2')}>
      {Array.from({ length: room.rounds }, (_, i) => {
        const done = i < game.round || (i === game.round && game.phase === 'reveal')
        const isCurrent = i === game.round && game.phase === 'question'
        const answers = game.answers[i]
        let pts: number | null = null
        let ok = false
        let who: Player | null = null
        if (done && answers) {
          if (playing && w.meId && answers[w.meId]) {
            pts = answers[w.meId].pts
            ok = answers[w.meId].acc >= 0.7
          } else {
            // spectators see who took the round
            const best = Object.entries(answers).sort((a, b) => b[1].pts - a[1].pts)[0]
            if (best) {
              pts = best[1].pts
              ok = best[1].pts > 0
              who = w.players[best[0]] ?? null
            }
          }
        }
        return (
          <div
            key={i}
            ref={isCurrent ? current : undefined}
            className={cx('flex h-[29px] items-center gap-2.5 rounded-lg px-2.5 text-[13.500px]', isCurrent ? 'bg-[#16305f] font-extrabold text-white' : 'text-soft')}
          >
            {done ? (
              ok ? (
                <CircleCheck size={15} className="text-mint" />
              ) : (
                <CircleX size={15} className="text-rose" />
              )
            ) : isCurrent ? (
              <span className="mx-[2.500px] h-2.5 w-2.5 rounded-full bg-azure-2" />
            ) : (
              <span className="mx-[2.500px] h-2.5 w-2.5 rounded-full bg-white/20" />
            )}
            <span>Round {i + 1}</span>
            <span className="tabular ml-auto flex items-center gap-1.5 font-bold text-white">
              {who && <Avatar size={18} />}
              {done ? pts : isCurrent ? <span className="typing-dots text-soft"><span /><span /><span /></span> : <Minus size={12} className="text-mute" />}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------- playing

function RoundHeader({ w, room, game, now, playing }: { w: World; room: Room; game: Game; now: number; playing: boolean }) {
  const secsLeft = Math.max(0, Math.ceil((game.end - now) / 1000))
  const question = game.phase === 'question'
  const urgent = question && secsLeft <= 3
  const lastTick = useRef(0)
  const answered = !!(w.meId && game.answers[game.round]?.[w.meId])
  useEffect(() => {
    if (playing && urgent && !answered && secsLeft > 0 && lastTick.current !== secsLeft) {
      lastTick.current = secsLeft
      sfx('tick')
    }
  }, [playing, urgent, answered, secsLeft])

  return (
    <div className={cx(panel, 'flex items-center gap-3 px-3.5 py-2.5 sm:gap-5 sm:px-6 sm:py-3')}>
      <div className="min-w-0 flex-1">
        <div className="text-[17px] leading-tight font-black sm:text-[20px]">
          Round {Math.max(1, game.round + 1)} <span className="font-bold text-soft">/ {room.rounds}</span>
        </div>
        <div className="mt-2 flex gap-[3px] sm:gap-1.5">
          {Array.from({ length: room.rounds }, (_, i) => {
            const a = playing && w.meId ? game.answers[i]?.[w.meId] : undefined
            const done = i < game.round || (i === game.round && game.phase === 'reveal')
            return (
              <span
                key={i}
                className={cx(
                  'h-1.5 min-w-0 flex-1 rounded-full',
                  done ? (playing && a ? (a.acc >= 0.999 ? 'bg-mint' : a.acc >= 0.7 ? 'bg-gold' : 'bg-rose') : 'bg-mint') : i === game.round ? 'bg-[#3dbef6]' : 'bg-[#33496f]',
                )}
              />
            )
          })}
        </div>
      </div>
      <DifficultyChip difficulty={room.difficulty} className="hidden sm:inline-flex" />
      <div className="hidden h-9 w-px bg-white/10 sm:block" />
      <div className={cx('tabular flex w-[74px] items-center justify-end gap-2 text-[24px] font-black sm:w-[96px] sm:text-[30px]', urgent ? 'text-rose' : 'text-[#f9b550]')}>
        <Timer size={26} strokeWidth={2.4} className={cx('text-white', urgent && 'animate-pulse')} />
        {question ? `${secsLeft}s` : <span className="text-[15px] font-extrabold text-soft sm:text-[17px]">Next</span>}
      </div>
    </div>
  )
}

function Intro({ w, room, game, now }: { w: World; room: Room; game: Game; now: number }) {
  const secs = Math.max(1, Math.ceil((game.end - now) / 1000))
  return (
    <div className={cx(panel, 'mx-auto my-auto flex w-full max-w-[720px] flex-col items-center justify-center px-4 py-10 text-center')}>
      <div className="text-[14px] font-extrabold tracking-[0.2em] text-[#8fb6ff] uppercase">Get ready</div>
      <div key={secs} className="animate-pop tabular mt-2 text-[110px] leading-none font-black text-white drop-shadow-[0_0_30px_rgba(79,141,255,0.7)]">
        {secs}
      </div>
      <div className="mt-6 flex flex-wrap items-start justify-center gap-5">
        {room.players.map((pid) => {
          const p = w.players[pid]
          if (!p) return null
          return (
            <div key={pid} className="flex w-[92px] flex-col items-center">
              <span className="relative">
                <ReactionBubble reaction={lastReaction(room, pid)} now={now} />
                <Avatar size={64} ring={pid === w.meId ? '#fbbf3b' : '#3d59a6'} />
              </span>
              <div className="mt-2 max-w-full truncate text-[14px] font-extrabold">{pid === w.meId ? 'You' : p.name}</div>
              <div className="tabular text-[13px] text-gold">{p.rating}</div>
            </div>
          )
        })}
      </div>
      <p className="mt-6 max-w-[380px] text-[14px] text-soft">
        {room.mode === 'vocab' ? 'Pick the right meaning. Faster answers score more points.' : 'Listen to each sentence and type exactly what you hear.'}
      </p>
    </div>
  )
}

function Playing({ w, room, game, now, playing }: { w: World; room: Room; game: Game; now: number; playing: boolean }) {
  const order = standings(room, game)
  const rankOfPid = (pid: string) => order.indexOf(pid) + 1
  // my own card always comes first
  const seats = room.players.slice().sort((a, b) => Number(b === w.meId) - Number(a === w.meId))
  const props = { w, room, game, now, playing }

  if (game.phase === 'intro') return <Intro w={w} room={room} game={game} now={now} />

  return (
    <>
      <RoundHeader {...props} />
      {room.mode === 'vocab' ? (
        <>
          <VocabStage key={game.round} {...props} />
          <div className="grid grid-cols-2 gap-2.5 desk:flex">
            {seats.map((pid) => w.players[pid] && <VocabPlayerCard key={pid} {...props} p={w.players[pid]} rank={rankOfPid(pid)} />)}
          </div>
        </>
      ) : (
        <>
          <ListeningStage key={game.round} {...props} />
          <div
            className="grid grid-cols-[repeat(var(--m),minmax(0,1fr))] gap-2.5 desk:grid-cols-[repeat(var(--n),minmax(0,1fr))]"
            style={{ ['--n' as string]: seats.length, ['--m' as string]: Math.max(1, seats.length - (playing ? 1 : 0)) }}
          >
            {seats.map(
              (pid) => w.players[pid] && <ListeningPlayerCard key={`${pid}-${game.round}`} {...props} p={w.players[pid]} rank={rankOfPid(pid)} />,
            )}
          </div>
        </>
      )}
    </>
  )
}

// ---------------------------------------------------------------- waiting

function InviteButton({ room, pid, invited, busy }: { room: Room; pid: string; invited: boolean; busy: boolean }) {
  const [sending, run] = usePending(300, 600)
  return (
    <button
      disabled={sending || invited || busy || room.players.length >= room.max}
      onClick={() => run(() => invitePlayer(room.id, pid))}
      className="flex h-8 w-[84px] items-center justify-center rounded-lg bg-azure text-[13px] font-extrabold transition hover:bg-azure-2 disabled:bg-raise disabled:text-mute"
    >
      {sending ? <Spinner size={15} /> : invited ? 'Invited' : busy ? 'Busy' : 'Invite'}
    </button>
  )
}

function InvitePicker({ w, room, onClose }: { w: World; room: Room; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const list = rankings()
    .list.filter((p) => p.bot && p.online && !room.players.includes(p.id))
    .filter((p) => !q || p.name.toLowerCase().includes(q))
    .sort((a, b) => Number(w.friends.includes(b.id)) - Number(w.friends.includes(a.id)) || Number(a.roomId != null) - Number(b.roomId != null))
    .slice(0, 60)
  return (
    <Modal onClose={onClose} className="sm:max-w-[440px]">
      <div className="flex h-dvh flex-col p-5 sm:h-[560px]">
        <h2 className="text-[22px] font-black">Invite players</h2>
        <label className="mt-3 flex h-11 items-center gap-2.5 rounded-xl border border-line bg-[#0b1224] px-3.5 text-soft focus-within:border-azure-2">
          <Search size={18} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search online players..."
            className="w-full bg-transparent text-[15px] text-white outline-none placeholder:text-mute"
          />
        </label>
        <div className="scroll-slim -mr-2 mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto pr-2">
          {list.map((p) => {
            const invited = room.invited.some((i) => i.pid === p.id)
            const busy = p.roomId != null
            return (
              <div key={p.id} className="flex h-12 items-center gap-3 rounded-xl px-2 hover:bg-white/5">
                <Avatar size={34} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[14.500px] font-extrabold">{p.name}</span>
                    <Flag country={p.country} size={14} />
                    {w.friends.includes(p.id) && <span className="rounded bg-[#12553a] px-1.5 text-[10px] font-black text-[#5ee0a6] uppercase">Friend</span>}
                  </div>
                  <div className="tabular text-[12.500px] text-mute">
                    {p.rating} · {busy ? (p.role === 'player' ? 'In a game' : 'Watching a game') : 'In the lobby'}
                  </div>
                </div>
                <InviteButton room={room} pid={p.id} invited={invited} busy={busy} />
              </div>
            )
          })}
          {list.length === 0 && <div className="py-10 text-center text-[14px] text-mute">Nobody online matches that name.</div>}
        </div>
      </div>
    </Modal>
  )
}

function Waiting({ w, room, now, playing }: { w: World; room: Room; now: number; playing: boolean }) {
  const [inviting, setInviting] = useState(false)
  const [starting, runStart] = usePending(350, 650)
  const [sitting, runSit] = usePending(300, 550)
  const isHost = room.host === w.meId
  const host = w.players[room.host]
  const seats = Array.from({ length: room.max }, (_, i) => room.players[i] ?? null)
  const startsIn = room.startAt != null ? Math.max(0, Math.ceil((room.startAt - now) / 1000)) : null
  const canSit = !playing && room.players.length < room.max && !room.priv

  return (
    <div className={cx(panel, 'mx-auto my-auto flex w-full max-w-[780px] flex-col items-center px-4 py-7 text-center sm:px-8 sm:py-10')}>
      <ModeIcon mode={room.mode} size={60} />
      <h2 className="mt-3 text-[26px] leading-tight font-black sm:text-[30px]">{MODES[room.mode].name}</h2>
      <p className="mt-1 max-w-[420px] text-[14.500px] text-soft">{MODES[room.mode].blurb}</p>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[13.500px] text-soft">
        <span className="rounded-lg bg-white/[0.08] px-2.5 py-1">{TOPICS[room.topic]}</span>
        <DifficultyChip difficulty={room.difficulty} />
        <span className="rounded-lg bg-white/[0.08] px-2.5 py-1">
          {room.rounds} {MODES[room.mode].unit}
        </span>
        <span className="flex items-center gap-1.5 rounded-lg bg-white/[0.08] px-2.5 py-1">
          <Clock size={14} />
          {room.secs}s each
        </span>
      </div>

      <div className="mt-7 grid w-full max-w-[640px] grid-cols-2 gap-3 sm:flex sm:justify-center">
        {seats.map((pid, i) => {
          const p = pid ? w.players[pid] : null
          if (!p)
            return (
              <button
                key={`empty-${i}`}
                disabled={!playing}
                onClick={() => setInviting(true)}
                className="flex h-[168px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.03] text-mute transition enabled:hover:border-azure-2 enabled:hover:text-white sm:w-[148px]"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-current">
                  {playing ? <UserPlus size={22} /> : <Plus size={22} />}
                </span>
                <span className="text-[13.500px] font-bold">{playing ? 'Invite a player' : 'Open seat'}</span>
              </button>
            )
          const { tier } = tierOf(p.rating)
          return (
            <button
              key={p.id}
              onClick={() => setUi({ profile: p.id })}
              className={cx(
                'animate-pop relative flex h-[168px] flex-col items-center justify-center rounded-2xl border-2 bg-[#131d38]/90 px-2 transition hover:bg-[#182548] sm:w-[148px]',
                p.id === w.meId ? 'border-gold/80' : 'border-[#2b4fa8]',
              )}
            >
              {p.id === room.host && (
                <span className="absolute top-2 left-2 flex items-center gap-1 rounded-md bg-[#3b2a16] px-1.5 py-0.5 text-[10.500px] font-black text-gold uppercase">
                  <Crown size={11} fill="currentColor" />
                  Host
                </span>
              )}
              <span className="relative">
                <ReactionBubble reaction={lastReaction(room, p.id)} now={now} />
                <Avatar size={64} ring={p.id === w.meId ? '#fbbf3b' : '#3d59a6'} />
              </span>
              <span className="mt-2 flex max-w-full items-center gap-1.5">
                <span className="truncate text-[15px] font-extrabold">{p.id === w.meId ? 'You' : p.name}</span>
                <Flag country={p.country} size={14} />
              </span>
              <span className="tabular text-[14px] font-extrabold text-gold">{p.rating}</span>
              <span className="mt-0.5 flex items-center gap-1 text-[12px] font-bold" style={{ color: tier.color }}>
                <RankBadge tier={tier} size={13} />
                {tier.name}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-7 flex w-full max-w-[380px] flex-col items-center gap-3">
        {isHost ? (
          <>
            <button
              onClick={() => runStart(() => startRoom(room.id))}
              disabled={room.players.length < 2 || starting}
              className="flex h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-flame-2 to-flame text-[18px] font-black shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_10px_24px_rgba(253,123,58,0.3)] transition active:scale-[0.985] disabled:opacity-45 disabled:shadow-none"
            >
              {starting ? <Spinner size={20} /> : <Play size={20} fill="currentColor" />}
              {starting ? 'Starting...' : startsIn != null ? `Starting in ${startsIn}s` : 'Start game'}
            </button>
            <p className="text-[13.500px] text-soft">
              {room.players.length < 2
                ? room.priv
                  ? room.invited.length
                    ? 'Invitation sent. Waiting for a reply...'
                    : 'Invite someone to get started.'
                  : 'Waiting for players to join...'
                : room.players.length < room.max
                  ? 'You can start now or wait for more players.'
                  : 'The room is full. Start whenever you are ready.'}
            </p>
          </>
        ) : playing ? (
          <div className="flex h-[54px] w-full items-center justify-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.06] text-[16px] font-extrabold">
            {startsIn != null && room.players.length >= 2 ? (
              <>
                <Timer size={19} className="text-[#f9b550]" />
                Game starts in <span className="tabular text-[#f9b550]">{startsIn}s</span>
              </>
            ) : (
              <>
                Waiting for {host?.name ?? 'the host'}
                <span className="typing-dots text-soft">
                  <span />
                  <span />
                  <span />
                </span>
              </>
            )}
          </div>
        ) : (
          <button
            disabled={!canSit || sitting}
            onClick={() => runSit(() => joinRoom(room.id))}
            className="flex h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-flame-2 to-flame text-[18px] font-black shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] disabled:opacity-45"
          >
            {sitting && <Spinner size={20} />}
            {room.priv ? 'Invite only' : room.players.length >= room.max ? 'Room is full' : 'Take a seat'}
          </button>
        )}
      </div>
      {inviting && <InvitePicker w={w} room={room} onClose={() => setInviting(false)} />}
    </div>
  )
}

// ---------------------------------------------------------------- results

function Results({ w, room, now, playing }: { w: World; room: Room; now: number; playing: boolean }) {
  const res = room.result!
  const [rematching, runRematch] = usePending(400, 700)
  const meId = w.meId
  const myPlace = meId ? res.order.indexOf(meId) + 1 : 0
  const winner = w.players[res.order[0]]
  const self = meId ? w.players[meId] : null
  const myDelta = meId ? (res.deltas[meId] ?? 0) : 0
  const leave = () => {
    leaveCurrentRoom()
    go('lobby')
  }
  const standing = self ? tierOf(self.rating) : null
  const before = meId ? res.before[meId] : 0
  const promoted = playing && self && tierOf(before).tier.name !== tierOf(self.rating).tier.name && myDelta > 0

  return (
    <div className={cx(panel, 'mx-auto my-auto flex w-full max-w-[780px] flex-col items-center px-3 py-6 sm:px-8 sm:py-8')}>
      {playing && self ? (
        <>
          <div className="text-[14px] font-extrabold tracking-[0.2em] text-[#8fb6ff] uppercase">Game over</div>
          <h2 className={cx('animate-pop mt-1 text-[40px] leading-tight font-black sm:text-[48px]', myPlace === 1 ? 'text-gold' : 'text-white')}>
            {myPlace === 1 ? 'Victory!' : `${ordinal(myPlace)} place`}
          </h2>
          <div className="mt-3 w-full max-w-[460px] rounded-2xl border border-[#6b4d1f] bg-gradient-to-b from-[#2b2416] to-[#151b2c] p-4">
            <div className="flex items-center gap-3.5">
              <RankBadge tier={standing!.tier} size={46} />
              <div className="min-w-0 flex-1 text-left">
                <div className="flex items-baseline gap-2.5">
                  <span className="tabular text-[28px] leading-none font-black">{fmt(self.rating)}</span>
                  <span className={cx('tabular flex items-center gap-1 text-[18px] font-black', myDelta >= 0 ? 'text-mint' : 'text-rose')}>
                    {myDelta >= 0 ? <TrendingUp size={18} strokeWidth={3} /> : <TrendingDown size={18} strokeWidth={3} />}
                    {myDelta >= 0 ? '+' : ''}
                    {myDelta}
                  </span>
                </div>
                <div className="mt-0.5 text-[14px] font-extrabold" style={{ color: standing!.tier.color }}>
                  {promoted ? `Promoted to ${standing!.tier.name}!` : standing!.tier.name}
                </div>
              </div>
            </div>
            <ProgressBar value={standing!.progress} className="mt-3" color="linear-gradient(90deg,#fd7b3a,#fbbf3b)" />
            {standing!.next && (
              <p className="mt-2 text-left text-[13.500px] text-soft">
                <span className="font-extrabold text-white">{standing!.toNext} more</span> to reach{' '}
                <span className="font-extrabold" style={{ color: standing!.next.color }}>
                  {standing!.next.name}
                </span>
              </p>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="text-[14px] font-extrabold tracking-[0.2em] text-[#8fb6ff] uppercase">Game over</div>
          <h2 className="mt-1 flex items-center gap-3 text-[32px] font-black sm:text-[40px]">
            <Crown size={34} className="text-gold" fill="currentColor" />
            {winner?.name} wins
          </h2>
        </>
      )}

      <div className="mt-5 w-full max-w-[640px] space-y-2">
        {res.order.map((pid, i) => {
          const p = w.players[pid]
          if (!p) return null
          const delta = res.deltas[pid] ?? 0
          const isMe = pid === meId
          return (
            <button
              key={pid}
              onClick={() => setUi({ profile: pid })}
              className={cx(
                'animate-rise relative flex w-full items-center gap-3 rounded-2xl border-2 px-3 py-2.5 text-left sm:px-4',
                isMe ? 'border-gold/70 bg-[#221d12]' : 'border-white/10 bg-[#131d38]/90',
              )}
              style={{ animationDelay: `${i * 90}ms`, animationFillMode: 'backwards' }}
            >
              <span
                className={cx(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[15px] font-black',
                  i === 0 ? 'bg-gradient-to-b from-[#ffd766] to-[#f59e0b] text-[#3b2405]' : i === 1 ? 'bg-[#94a3b8] text-[#101627]' : i === 2 ? 'bg-[#b9713a] text-white' : 'bg-white/15',
                )}
              >
                {i + 1}
              </span>
              <span className="relative shrink-0">
                <ReactionBubble reaction={lastReaction(room, pid)} now={now} />
                <Avatar size={44} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15.500px] font-extrabold">{isMe ? 'You' : p.name}</span>
                <span className="tabular block text-[12.500px] text-mute">
                  {res.correct[pid]}/{room.rounds} correct
                </span>
              </span>
              <span className="tabular text-right">
                <span className="block text-[19px] leading-tight font-black">{fmt(res.scores[pid])}</span>
                <span className="block text-[11.500px] text-mute">points</span>
              </span>
              <span className="tabular w-[74px] text-right">
                <span className={cx('block text-[16px] leading-tight font-black', delta >= 0 ? 'text-mint' : 'text-rose')}>
                  {delta >= 0 ? '+' : ''}
                  {delta}
                </span>
                <span className="block text-[12px] text-gold">{p.rating}</span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-6 flex w-full max-w-[460px] gap-3">
        <button onClick={leave} className="h-[52px] flex-1 rounded-2xl border border-white/15 bg-white/[0.06] text-[16px] font-extrabold transition hover:bg-white/10">
          Back to lobby
        </button>
        {playing && (
          <button
            onClick={() => runRematch(() => rematch(room.id))}
            disabled={rematching}
            className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-flame-2 to-flame text-[16px] font-black shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] transition active:scale-[0.985]"
          >
            {rematching ? <Spinner size={18} /> : <RotateCcw size={18} strokeWidth={3} />}
            Play again
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- frame

function LeaveConfirm({ onStay, onLeave }: { onStay: () => void; onLeave: () => void }) {
  return (
    <Modal onClose={onStay} sheet={false} className="max-w-[400px]">
      <div className="p-6 text-center">
        <h2 className="text-[22px] font-black">Leave this game?</h2>
        <p className="mt-2 text-[14.500px] text-soft">The game is still running. Leaving now counts as a loss and costs you rating.</p>
        <div className="mt-5 flex gap-3">
          <button onClick={onLeave} className="h-12 flex-1 rounded-xl border border-[#7a2c3c] bg-[#30141c] text-[15px] font-extrabold text-[#ff8a9c]">
            Leave game
          </button>
          <button onClick={onStay} className="h-12 flex-1 rounded-xl bg-gradient-to-b from-azure-2 to-azure text-[15px] font-extrabold">
            Keep playing
          </button>
        </div>
      </div>
    </Modal>
  )
}

export function RoomScreen({ id }: { id: number }) {
  const w = useWorld()
  const now = useNow(100)
  const [confirm, setConfirm] = useState(false)
  const entering = useLoading(id, 400, 750)
  const room = w.rooms[id]
  const exists = !!room

  // anyone opening a room without holding a seat in it is a spectator
  useEffect(() => {
    if (!exists) return
    watchRoom(id)
    return () => {
      const world = getWorld()
      const p = world.meId ? world.players[world.meId] : null
      if (p && p.roomId === id && p.role === 'spectator') leaveCurrentRoom()
    }
  }, [id, exists])

  useEffect(() => {
    if (exists) return
    const t = setTimeout(() => go('lobby'), 1800)
    return () => clearTimeout(t)
  }, [exists])

  if (!room) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
        <div className="text-[22px] font-black">Room #{id} has closed</div>
        <div className="text-soft">Taking you back to the lobby...</div>
      </div>
    )
  }

  const playing = !!w.meId && room.players.includes(w.meId)
  const game = room.game
  const inGame = room.status === 'playing' && !!game
  const back = () => {
    if (playing && room.status === 'playing') setConfirm(true)
    else {
      leaveCurrentRoom()
      go('lobby')
    }
  }

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden">
      <img src="/assets/game-bg.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a1124]/65 via-[#0a1124]/55 to-[#0a1124]/88" />

      {/* phone header */}
      <header className="relative flex h-13 shrink-0 items-center gap-2 border-b border-white/10 bg-[#0b1426]/90 px-2 py-2 desk:hidden">
        <button onClick={back} className="flex h-9 w-9 items-center justify-center rounded-full text-soft" aria-label="Back to lobby">
          <ArrowLeft size={22} />
        </button>
        <ModeIcon mode={room.mode} size={30} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[15px] font-extrabold">{MODES[room.mode].name}</div>
          <div className="truncate text-[12px] text-mute">
            #{room.id} · {TOPICS[room.topic]} · {room.rounds} {MODES[room.mode].unit}
          </div>
        </div>
        {!playing && (
          <span className="flex items-center gap-1 rounded-lg bg-azure/25 px-2 py-1 text-[12px] font-extrabold text-[#9cc2ff]">
            <Eye size={13} />
            Watching
          </span>
        )}
        {room.spectators.length > 0 && playing && (
          <span className="tabular flex items-center gap-1 pr-1 text-[12.500px] text-soft">
            <Eye size={14} />
            {room.spectators.length}
          </span>
        )}
      </header>

      <div className="relative mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 gap-4 desk:p-4">
        {/* left */}
        <aside className="hidden w-[250px] shrink-0 flex-col gap-3 desk:flex">
          <img src="/assets/logo.png" alt="LingoPlay" className="h-[46px] self-start" />
          <button onClick={back} className="flex items-center gap-2.5 px-1 py-1 text-[16px] font-bold text-soft transition hover:text-white">
            <ArrowLeft size={20} />
            Back to Lobby
          </button>
          <GameInfo room={room} />
          {!playing && (
            <div className="flex items-center gap-2 rounded-xl border border-[#2f4f8f] bg-[#12244d]/90 px-3 py-2 text-[13.500px] font-bold text-[#9cc2ff]">
              <Eye size={16} />
              You are watching this game
            </div>
          )}
          <ReactionsPanel w={w} room={room} now={now} />
        </aside>

        {/* center */}
        <main className="scroll-slim flex min-w-0 flex-1 flex-col gap-2.5 overflow-y-auto p-2.5 desk:gap-3 desk:p-0 [&>*]:shrink-0">
          {entering ? (
            <div className={cx(panel, 'mx-auto my-auto w-full max-w-[420px]')}>
              <Loading label={`Entering room #${id}...`} />
            </div>
          ) : inGame ? (
            <Playing w={w} room={room} game={game} now={now} playing={playing} />
          ) : room.status === 'finished' && room.result ? (
            <Results w={w} room={room} now={now} playing={playing} />
          ) : (
            <Waiting w={w} room={room} now={now} playing={playing} />
          )}
        </main>

        {/* right */}
        {!entering && inGame && game.phase !== 'intro' && (
          <aside className="hidden w-[256px] shrink-0 flex-col gap-3 desk:flex">
            <StandingsPanel w={w} room={room} game={game} />
            <RoundList w={w} room={room} game={game} playing={playing} />
          </aside>
        )}
      </div>

      {/* phone reactions */}
      <div className="relative shrink-0 border-t border-white/10 bg-[#0b1426]/95 pb-[env(safe-area-inset-bottom)] desk:hidden">
        <ReactionButtons room={room} compact />
      </div>

      {confirm && (
        <LeaveConfirm
          onStay={() => setConfirm(false)}
          onLeave={() => {
            setConfirm(false)
            leaveCurrentRoom()
            go('lobby')
          }}
        />
      )}
    </div>
  )
}

