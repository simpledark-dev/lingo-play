import { ArrowRight, CalendarDays, Check, ChevronDown, Eye, LayoutGrid, Radio, Search, Signal, Users, Zap, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { DIFFICULTIES, MODES, MODE_IDS, progressLabel, TOPICS } from '../game/config'
import type { Difficulty, Mode, Room, World } from '../game/types'
import { useLoading, usePending } from '../lib/hooks'
import { comingSoon, go, setUi } from '../lib/ui'
import { joinRoom, quickPlay } from '../sim/actions'
import { useWorld } from '../sim/store'
import { Avatar } from '../ui/Avatar'
import { cx, LevelChip, Loading, ModeIcon, Spinner } from '../ui/bits'
import { MyCard, OnlinePanel } from './OnlinePanel'

function ActionCard(props: {
  title: string
  lines: [string, string]
  icon: ReactNode
  className: string
  tag?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={props.onClick}
      className={cx(
        'group relative flex min-h-[72px] items-center gap-3 overflow-hidden rounded-2xl border px-3.5 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] transition hover:brightness-110 active:scale-[0.985] desk:min-h-[112px] desk:gap-3.5 desk:px-5',
        props.className,
      )}
    >
      {props.tag && (
        <span className="absolute top-2 right-2.5 rounded-md bg-black/25 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide uppercase">{props.tag}</span>
      )}
      <span className="shrink-0 drop-shadow-[0_4px_8px_rgba(0,0,0,0.25)] [&>svg]:h-9 [&>svg]:w-9 desk:[&>svg]:h-[46px] desk:[&>svg]:w-[46px]">{props.icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16.500px] leading-tight font-extrabold desk:text-[18px]">{props.title}</span>
        <span className="mt-1 hidden text-[14px] leading-snug text-white/85 md:block">
          {props.lines[0]}
          <br className="hidden desk:block" /> {props.lines[1]}
        </span>
      </span>
      <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 transition group-hover:translate-x-0.5 group-hover:bg-white/30 sm:flex desk:hidden wide:flex">
        <ArrowRight size={18} strokeWidth={2.6} />
      </span>
    </button>
  )
}

function Dropdown<T extends string>(props: {
  icon: LucideIcon
  value: T
  options: [T, string][]
  onChange: (v: T) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [open])
  const label = props.options.find((o) => o[0] === props.value)?.[1]
  return (
    <div ref={ref} className="relative min-w-0 flex-1 desk:flex-none">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-10 w-full items-center gap-2 rounded-xl border border-line bg-[#20253e] px-3 text-[13.500px] text-white transition hover:border-[#3a4568] sm:h-11 sm:gap-2.5 sm:px-3.5 sm:text-[14.500px] desk:w-[188px]"
      >
        <props.icon size={19} className="hidden shrink-0 text-soft sm:block" />
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        <ChevronDown size={17} className={cx('shrink-0 text-soft transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="animate-fade absolute top-12 left-0 z-30 w-full min-w-[180px] overflow-hidden rounded-xl border border-[#3a4568] bg-[#20253e] py-1 shadow-2xl">
          {props.options.map(([v, text]) => (
            <button
              key={v}
              onClick={() => {
                props.onChange(v)
                setOpen(false)
              }}
              className={cx('flex h-9 w-full items-center justify-between px-3.5 text-left text-[14px] hover:bg-white/10', v === props.value ? 'text-white' : 'text-soft')}
            >
              {text}
              {v === props.value && <Check size={15} className="text-azure-2" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function AvatarStack({ room }: { room: Room }) {
  const shown = room.players.slice(0, 3)
  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {shown.map((pid) => (
          <Avatar key={pid} size={30} ring="#1c2238" />
        ))}
      </div>
      {room.players.length > 3 && <span className="ml-1.5 text-[13px] text-soft">+{room.players.length - 3}</span>}
      {room.status === 'waiting' && (
        <span className="tabular ml-2 text-[13px] text-mute">
          {room.players.length}/{room.max}
        </span>
      )}
    </div>
  )
}

function statusOf(room: Room): { dot: string; text: string } {
  if (room.status === 'waiting') return { dot: 'bg-[#fbcf3b]', text: 'Waiting' }
  if (room.status === 'finished') return { dot: 'bg-[#8d99b6]', text: 'Finished' }
  return { dot: 'bg-mint', text: progressLabel(room) }
}

function RoomAction({ room, mine, pending }: { room: Room; mine: boolean; pending: boolean }) {
  const canJoin = room.status === 'waiting' && room.players.length < room.max
  const label = mine ? 'Return' : canJoin ? 'Join' : 'Watch'
  return (
    <span
      className={cx(
        'inline-flex h-10 w-[92px] items-center justify-center rounded-xl text-[15px] font-extrabold transition',
        mine
          ? 'bg-gradient-to-b from-grape to-[#5a36d8] text-white'
          : canJoin
            ? 'bg-gradient-to-b from-flame-2 to-flame text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] group-hover:brightness-110'
            : 'bg-[#1f305c] text-[#8fb6ff] group-hover:bg-[#274079]',
      )}
    >
      {pending ? <Spinner size={18} /> : label}
    </span>
  )
}

/** taking a seat is a request that can fail (room filled up, game started), so it waits for the answer */
function useOpenRoom(room: Room, meId: string | null) {
  const [pending, run] = usePending(300, 550)
  const open = () => {
    const mine = !!meId && room.players.includes(meId)
    if (!mine && room.status === 'waiting' && room.players.length < room.max) {
      run(() => {
        if (joinRoom(room.id)) go(`room/${room.id}`)
      })
    } else go(`room/${room.id}`)
  }
  return [pending, open] as const
}

const GRID =
  'grid grid-cols-[70px_minmax(180px,1.5fr)_minmax(100px,0.8fr)_100px_minmax(112px,0.9fr)_92px] items-center gap-3 wide:grid-cols-[74px_minmax(190px,1.5fr)_minmax(104px,0.8fr)_minmax(96px,0.7fr)_104px_minmax(142px,0.9fr)_92px]'

function RoomRow({ w, room, now }: { w: World; room: Room; now: number }) {
  const mine = !!w.meId && room.players.includes(w.meId)
  const st = statusOf(room)
  const fresh = now - room.created < 4000
  const mode = MODES[room.mode]
  const [pending, open] = useOpenRoom(room, w.meId)
  return (
    <button
      onClick={open}
      className={cx('group w-full border-t border-line px-4 py-[9px] text-left transition hover:bg-white/[0.035]', GRID, fresh && 'animate-row', mine && 'bg-grape/10')}
    >
      <span className="tabular inline-flex h-9 w-[62px] items-center justify-center rounded-lg bg-[#1d2a4c] text-[14.500px] font-extrabold text-[#7ea6f5]">
        #{room.id}
      </span>
      <span className="flex min-w-0 items-center gap-3">
        <ModeIcon mode={room.mode} size={38} />
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-extrabold">{mode.name}</span>
          <span className="block truncate text-[13px] text-mute">
            {room.rounds} {mode.unit} · {room.secs}s<span className="wide:hidden"> · {TOPICS[room.topic]}</span>
          </span>
        </span>
      </span>
      <AvatarStack room={room} />
      <span className="hidden truncate text-[14px] text-soft wide:block">{TOPICS[room.topic]}</span>
      <span>
        <LevelChip room={room} />
      </span>
      <span className="flex min-w-0 items-center gap-2 text-[14px] text-soft">
        <span className={cx('h-2.5 w-2.5 shrink-0 rounded-full', st.dot)} />
        <span className="truncate">{st.text}</span>
        {room.spectators.length > 0 && (
          <span className="tabular ml-auto flex items-center gap-1 text-[12px] text-mute" title={`${room.spectators.length} watching`}>
            <Eye size={13} />
            {room.spectators.length}
          </span>
        )}
      </span>
      <RoomAction room={room} mine={mine} pending={pending} />
    </button>
  )
}

function RoomCard({ w, room, now }: { w: World; room: Room; now: number }) {
  const mine = !!w.meId && room.players.includes(w.meId)
  const st = statusOf(room)
  const mode = MODES[room.mode]
  const [pending, open] = useOpenRoom(room, w.meId)
  return (
    <button
      onClick={open}
      className={cx(
        'group w-full rounded-2xl border border-line bg-panel p-3 text-left active:bg-panel-2',
        now - room.created < 4000 && 'animate-row',
      )}
    >
      <span className="flex items-center gap-3">
        <ModeIcon mode={room.mode} size={42} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15.500px] font-extrabold">{mode.name}</span>
          <span className="block truncate text-[13px] text-mute">
            #{room.id} · {room.rounds} {mode.unit} · {room.secs}s
          </span>
        </span>
        <RoomAction room={room} mine={mine} pending={pending} />
      </span>
      <span className="mt-2.5 flex items-center gap-2.5 border-t border-white/5 pt-2.5">
        <AvatarStack room={room} />
        <span className="ml-auto flex min-w-0 items-center gap-2 text-[13px] text-soft">
          <span className="truncate">{TOPICS[room.topic]}</span>
          <LevelChip room={room} className="!px-2 !py-0.5 !text-[12px]" />
          <span className="flex shrink-0 items-center gap-1.5">
            <span className={cx('h-2 w-2 rounded-full', st.dot)} />
            {st.text}
          </span>
        </span>
      </span>
    </button>
  )
}

type StatusFilter = 'all' | 'open' | 'live'

export function Lobby() {
  const w = useWorld()
  const [mode, setMode] = useState<Mode | 'all'>('all')
  const [difficulty, setDifficulty] = useState<Difficulty | 'all'>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [query, setQuery] = useState('')
  const now = Date.now()
  const loading = useLoading('rooms')

  const q = query.trim().toLowerCase().replace(/^#/, '')
  const all = Object.values(w.rooms)
  const rooms = all
    .filter((r) => !r.priv || (w.meId && r.players.includes(w.meId)))
    .filter((r) => mode === 'all' || r.mode === mode)
    .filter((r) => difficulty === 'all' || r.difficulty === difficulty)
    .filter((r) => status === 'all' || (status === 'open' ? r.status === 'waiting' && r.players.length < r.max : r.status === 'playing'))
    .filter(
      (r) =>
        !q ||
        String(r.id).includes(q) ||
        MODES[r.mode].name.toLowerCase().includes(q) ||
        TOPICS[r.topic].toLowerCase().includes(q) ||
        r.players.some((pid) => w.players[pid]?.name.toLowerCase().includes(q)),
    )
    .sort((a, b) => b.created - a.created)

  const onQuickPlay = () => {
    setUi({ matching: true })
    setTimeout(() => {
      setUi({ matching: false })
      const id = quickPlay()
      if (id != null) go(`room/${id}`)
    }, 900)
  }

  return (
    <div className="relative h-full overflow-hidden">
      <img src="/assets/game-bg.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a1124]/82 via-[#0a1124]/74 to-[#0a1124]/92" />

      <div className="relative flex h-full gap-5 desk:p-5">
        <main className="scroll-slim min-w-0 flex-1 overflow-y-auto px-3 pt-3 pb-4 desk:p-0">
        <div className="overflow-hidden rounded-2xl desk:rounded-[22px]">
          <img
            src="/assets/lobby-banner.png"
            alt="Play together. Learn faster. Join live games and climb the global leaderboard."
            className="block aspect-[928/240] w-full scale-[1.012] object-cover"
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 desk:mt-4 desk:gap-4">
          <ActionCard
            title="Quick Play"
            lines={['Jump into a random', 'game right now']}
            icon={<Zap size={46} fill="#8fd3ff" stroke="#d9f0ff" strokeWidth={1.2} />}
            className="border-[#3d8bff] bg-gradient-to-br from-[#0a5ce6] to-[#2a62d6]"
            onClick={onQuickPlay}
          />
          <ActionCard
            title="Create Room"
            lines={['Play with friends', 'or custom settings']}
            icon={<Users size={46} fill="#e3d4ff" stroke="#f3ecff" strokeWidth={1.2} />}
            className="border-[#9a6bff] bg-gradient-to-br from-[#7a41ea] to-[#5a36d8]"
            onClick={() => setUi({ create: {} })}
          />
          <ActionCard
            title="Daily Challenge"
            tag="Soon"
            lines={['One challenge for', 'everyone, every day']}
            icon={<CalendarDays size={46} stroke="#fff4dc" strokeWidth={2} />}
            className="hidden border-[#ffb04d] bg-gradient-to-br from-[#ff8f2e] to-[#c9781d] sm:flex"
            onClick={() => comingSoon('Daily Challenge')}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 sm:gap-2.5 desk:mt-4 desk:flex-nowrap desk:gap-3">
          <Dropdown
            icon={LayoutGrid}
            value={mode}
            onChange={setMode}
            options={[
              ['all', 'All Modes'],
              ...MODE_IDS.map((m): [Mode, string] => [m, MODES[m].name]),
            ]}
          />
          <Dropdown
            icon={Signal}
            value={difficulty}
            onChange={setDifficulty}
            options={[
              ['all', 'All Levels'],
              ['easy', DIFFICULTIES.easy.name],
              ['medium', DIFFICULTIES.medium.name],
              ['hard', DIFFICULTIES.hard.name],
            ]}
          />
          <Dropdown
            icon={Radio}
            value={status}
            onChange={setStatus}
            options={[
              ['all', 'All Rooms'],
              ['open', 'Open to join'],
              ['live', 'In game'],
            ]}
          />
          <label className="flex h-11 w-full min-w-0 items-center gap-2.5 rounded-xl border border-line bg-[#1a2035] px-3.5 text-soft focus-within:border-azure-2 desk:flex-1">
            <Search size={19} className="shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search rooms or players..."
              className="w-full min-w-0 bg-transparent text-[14.500px] text-white outline-none placeholder:text-mute"
            />
          </label>
        </div>

        {/* desktop: table */}
        <div className="mt-4 hidden overflow-hidden rounded-2xl border border-line bg-panel-2 desk:block">
          <div className={cx('bg-[#232a42] px-4 py-2.5 text-[13.500px] text-soft', GRID)}>
            <span>Room</span>
            <span>Mode</span>
            <span>Players</span>
            <span className="hidden wide:block">Topic</span>
            <span>Level</span>
            <span>Status</span>
            <span />
          </div>
          {loading ? (
            <Loading label="Loading rooms..." className="border-t border-line" />
          ) : (
            rooms.map((r) => <RoomRow key={r.id} w={w} room={r} now={now} />)
          )}
          {!loading && rooms.length === 0 && <Empty />}
        </div>

        {/* mobile: cards */}
        <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-2 desk:hidden">
          {loading ? <Loading label="Loading rooms..." className="col-span-full" /> : rooms.map((r) => <RoomCard key={r.id} w={w} room={r} now={now} />)}
          {!loading && rooms.length === 0 && <Empty />}
        </div>
          <div className="mt-3 text-center text-[12.500px] text-soft drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
            {rooms.length} of {all.length} rooms
          </div>
        </main>

        <aside className="hidden w-[312px] shrink-0 flex-col gap-4 desk:flex">
          <MyCard />
          <div className="min-h-0 flex-1">
            <OnlinePanel />
          </div>
        </aside>
      </div>
    </div>
  )
}

function Empty() {
  return (
    <div className="col-span-full border-t border-line px-4 py-12 text-center text-[14px] text-mute">
      No rooms match these filters. Try Quick Play or create your own room.
    </div>
  )
}
