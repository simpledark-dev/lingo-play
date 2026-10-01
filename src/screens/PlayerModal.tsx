import { CalendarCheck, Check, ChevronRight, Eye, Flame, Gamepad2, LogOut, MapPin, Pencil, Swords, TrendingDown, TrendingUp, UserCheck, UserPlus } from 'lucide-react'
import { useId, useState } from 'react'
import { COUNTRY_NAMES } from '../data/names'
import { MODES } from '../game/config'
import { tierOf } from '../game/tiers'
import type { Mode, Player, World } from '../game/types'
import { useLoading, usePending } from '../lib/hooks'
import { go, setUi } from '../lib/ui'
import { addFriend, logout, removeFriend, updateProfile } from '../sim/actions'
import { rankOf, rankings, useWorld } from '../sim/store'
import { Avatar } from '../ui/Avatar'
import { cx, Flag, fmt, Loading, ModeIcon, ordinal, ProgressBar, RankBadge, Spinner, timeAgo } from '../ui/bits'
import { Modal } from '../ui/Modal'

const topPercent = (rank: number, total: number) => Math.max(1, Math.ceil((rank / total) * 100))

function Tile({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cx('rounded-2xl border border-line bg-[#131d38] px-4 py-3', className)}>
      <div className="text-[13px] text-soft">{label}</div>
      {children}
    </div>
  )
}

function RatingChart({ history }: { history: number[] }) {
  const id = useId()
  const W = 560
  const H = 150
  const pad = { l: 38, r: 12, t: 12, b: 10 }
  const pts = history.length > 1 ? history : [history[0] ?? 1200, history[0] ?? 1200]
  const lo = Math.floor((Math.min(...pts) - 20) / 50) * 50
  const hi = Math.ceil((Math.max(...pts) + 20) / 50) * 50
  const x = (i: number) => pad.l + (i / (pts.length - 1)) * (W - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b)
  const line = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const ticks = [lo, Math.round((lo + hi) / 2), hi]
  const last = pts.length - 1
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Rating history">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7c5cff" stopOpacity="0.45" />
          <stop offset="1" stopColor="#7c5cff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#26304f" strokeWidth="1" />
          <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11.500" fill="#8d99b6">
            {t}
          </text>
        </g>
      ))}
      <path d={`${line} L${x(last)} ${H - pad.b} L${x(0)} ${H - pad.b} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke="#9d86ff" strokeWidth="2.200" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((v, i) => (i % 3 === last % 3 ? <circle key={i} cx={x(i)} cy={y(v)} r={i === last ? 4.5 : 2.6} fill={i === last ? '#fff' : '#b9a8ff'} stroke="#7c5cff" strokeWidth={i === last ? 2.5 : 0} /> : null))}
    </svg>
  )
}

function SkillCard({ w, p, mode }: { w: World; p: Player; mode: Mode }) {
  const all = Object.values(w.players)
  const rank = all.filter((o) => o.skills[mode] > p.skills[mode]).length + 1
  const color = mode === 'listening' ? '#9b6bff' : '#3ed598'
  return (
    <div className="flex-1 rounded-xl border border-line bg-[#152042] p-3">
      <div className="flex items-center gap-2.5">
        <ModeIcon mode={mode} size={36} />
        <div>
          <div className="text-[13px] text-soft">{MODES[mode].short}</div>
          <div className="tabular text-[19px] leading-tight font-black">{fmt(p.skills[mode])}</div>
        </div>
      </div>
      <ProgressBar value={(p.skills[mode] - 600) / 1600} color={color} className="mt-3 !h-1.5" />
      <div className="mt-1.5 text-[12.500px] text-mute">Top {topPercent(rank, all.length)}%</div>
    </div>
  )
}

function RecentGames({ w, p, now }: { w: World; p: Player; now: number }) {
  if (p.recent.length === 0)
    return <div className="px-2 py-8 text-center text-[14px] text-mute">No games yet. Join a room to get on the board.</div>
  return (
    <div className="space-y-1.5">
      {p.recent.slice(0, 6).map((g, i) => {
        const opp = w.players[g.oppId]
        const win = g.place === 1
        return (
          <div key={i} className="flex items-center gap-3 rounded-xl bg-[#152042] px-3 py-2">
            <ModeIcon mode={g.mode} size={34} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-extrabold">{MODES[g.mode].name}</div>
              <div className="text-[12.500px] text-mute">{timeAgo(g.at, now)}</div>
            </div>
            <span
              className={cx(
                'w-[52px] rounded-md py-1 text-center text-[12.500px] font-extrabold',
                win ? 'bg-[#12553a] text-[#5ee0a6]' : 'bg-[#5a1f2c] text-[#ff8a9c]',
              )}
            >
              {g.of > 2 ? ordinal(g.place) : win ? 'Win' : 'Loss'}
            </span>
            <span className={cx('tabular w-9 text-right text-[13px] font-extrabold', g.delta >= 0 ? 'text-mint' : 'text-rose')}>
              {g.delta >= 0 ? '+' : ''}
              {g.delta}
            </span>
            {opp && opp.id !== p.id ? (
              <button onClick={() => setUi({ profile: opp.id })} className="hidden w-[132px] items-center gap-2 text-left sm:flex">
                <Avatar size={30} />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-bold">{opp.name}</span>
                  <span className="tabular block text-[12px] text-mute">{opp.rating}</span>
                </span>
                <ChevronRight size={15} className="ml-auto shrink-0 text-mute" />
              </button>
            ) : (
              <span className="hidden w-[132px] sm:block" />
            )}
          </div>
        )
      })}
    </div>
  )
}

export function PlayerModal({ id }: { id: string }) {
  const w = useWorld()
  const loading = useLoading(id, 350, 700)
  const p = w.players[id === 'me' ? (w.meId ?? '') : id]
  if (!p) return null
  if (loading)
    return (
      <Modal onClose={() => setUi({ profile: null })} className="sm:max-w-[1080px]">
        <Loading label="Loading profile..." className="min-h-[420px]" />
      </Modal>
    )
  return <Profile w={w} p={p} />
}

function Profile({ w, p }: { w: World; p: Player }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, runSave] = usePending(300, 550)
  const [befriending, runFriend] = usePending(300, 550)
  const [leaving, runLogout] = usePending(350, 600)
  const close = () => setUi({ profile: null })
  const isMe = p.id === w.meId
  const now = Date.now()
  const total = rankings().list.length
  const rank = rankOf(p.id)
  const { tier, next, progress } = tierOf(p.rating)
  const isFriend = w.friends.includes(p.id)
  const pending = w.friendReqs.some((q) => q.pid === p.id)
  const room = p.roomId != null ? w.rooms[p.roomId] : null
  const status = !p.online
    ? { text: 'Offline', dot: 'bg-[#5b6687]', tone: 'text-mute' }
    : p.role === 'player' && room
      ? { text: `Playing ${MODES[room.mode].name} in #${room.id}`, dot: 'bg-flame-2', tone: 'text-flame-2' }
      : p.role === 'spectator' && room
        ? { text: `Watching room #${room.id}`, dot: 'bg-azure-2', tone: 'text-azure-2' }
        : { text: 'Online now', dot: 'bg-mint', tone: 'text-mint' }
  const joined = new Date(p.joined).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  const rate = p.games ? Math.round((p.wins / p.games) * 100) : 0

  const saveName = () =>
    runSave(() => {
      updateProfile({ name: draft })
      setEditing(false)
    })

  return (
    <Modal onClose={close} className="sm:max-w-[1080px]">
      {/* header */}
      <div className="relative overflow-hidden">
        <img src="/assets/game-bg.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-[50%_30%]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0f1830] via-[#0f1830]/85 to-[#0f1830]/55" />
        <div className="relative flex flex-col gap-4 px-5 pt-6 pb-5 sm:flex-row sm:items-center sm:gap-6 sm:px-8 sm:pt-8">
          <div className="relative w-fit shrink-0">
            <Avatar size={132} ring="#fff" className="!h-24 !w-24 sm:!h-[132px] sm:!w-[132px]" />
            {p.online && <span className="absolute right-1.5 bottom-1.5 h-5 w-5 rounded-full border-[3px] border-[#0f1830] bg-mint sm:right-2.5 sm:bottom-2.5" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              {editing ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    saveName()
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    autoFocus
                    value={draft}
                    maxLength={15}
                    onChange={(e) => setDraft(e.target.value.replace(/[^\w.]/g, ''))}
                    className="h-11 w-[220px] rounded-xl border border-azure-2 bg-[#0b1224] px-3 text-[22px] font-black outline-none"
                  />
                  <button type="submit" disabled={saving} className="flex h-11 w-11 items-center justify-center rounded-xl bg-azure" aria-label="Save name">
                    {saving ? <Spinner size={18} /> : <Check size={20} strokeWidth={3} />}
                  </button>
                </form>
              ) : (
                <>
                  <h2 className="truncate text-[30px] leading-none font-black sm:text-[38px]">{p.name}</h2>
                  <Flag country={p.country} size={30} />
                  {isMe && (
                    <button
                      onClick={() => {
                        setDraft(p.name)
                        setEditing(true)
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-soft hover:text-white"
                      title="Change name"
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                </>
              )}
            </div>
            <div className={cx('mt-2 flex items-center gap-2 text-[15px] font-bold', status.tone)}>
              <span className={cx('h-2.5 w-2.5 rounded-full', status.dot)} />
              {status.text}
            </div>
            {(p.bio || isMe) && <p className="mt-2 text-[15px] text-soft">{p.bio || 'Playing as a guest. Your progress is saved on this device.'}</p>}
            <div className="mt-3 flex flex-wrap gap-2 text-[13.500px]">
              <span className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#0f1830]/70 px-2.5 py-1.5">
                <MapPin size={15} className="text-rose" />
                {COUNTRY_NAMES[p.country]}
              </span>
              <span className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#0f1830]/70 px-2.5 py-1.5">
                <Flame size={15} className="text-flame" fill="currentColor" />
                {p.streak}-day streak
              </span>
              <span className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#0f1830]/70 px-2.5 py-1.5">
                <CalendarCheck size={15} className="text-[#b79cff]" />
                {now - p.joined < 86_400_000 ? 'Joined today' : `Member since ${joined}`}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 gap-2.5 sm:mr-10 sm:w-[176px] sm:flex-col">
            {isMe ? (
              <>
                <button
                  onClick={() =>
                    runLogout(() => {
                      close()
                      logout()
                      go('lobby')
                    })
                  }
                  disabled={leaving}
                  className="flex h-11 flex-1 items-center justify-center sm:flex-none gap-2 rounded-xl border border-line bg-[#131d38] text-[15px] font-bold text-soft hover:text-white"
                >
                  {leaving ? <Spinner size={17} /> : <LogOut size={17} />}
                  Log out
                </button>
              </>
            ) : (
              <>
                {p.role === 'player' && room ? (
                  <button
                    onClick={() => {
                      close()
                      go(`room/${room.id}`)
                    }}
                    className="flex h-11 flex-1 items-center justify-center sm:flex-none gap-2 rounded-xl bg-gradient-to-b from-azure-2 to-azure text-[15px] font-extrabold shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]"
                  >
                    <Eye size={18} />
                    Watch game
                  </button>
                ) : (
                  <button
                    disabled={!p.online}
                    onClick={() => setUi({ profile: null, create: { inviteId: p.id } })}
                    className="flex h-11 flex-1 items-center justify-center sm:flex-none gap-2 rounded-xl bg-gradient-to-b from-azure-2 to-azure text-[15px] font-extrabold shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] disabled:opacity-40"
                  >
                    <Swords size={18} />
                    Challenge
                  </button>
                )}
                <button
                  onClick={() => runFriend(() => (isFriend ? removeFriend(p.id) : addFriend(p.id)))}
                  disabled={pending || befriending}
                  className="flex h-11 flex-1 items-center justify-center sm:flex-none gap-2 rounded-xl border border-line bg-[#131d38] text-[15px] font-bold text-white hover:bg-raise disabled:text-mute"
                >
                  {befriending ? <Spinner size={18} /> : isFriend ? <UserCheck size={18} className="text-mint" /> : <UserPlus size={18} />}
                  {isFriend ? 'Friends' : pending ? 'Request sent' : 'Add Friend'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3 px-4 pt-1 pb-5 sm:px-5">
        {/* stat tiles */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-[1.7fr_1fr_1fr_1fr_1fr_1fr]">
          <div className="col-span-2 flex items-center gap-3.5 rounded-2xl border border-[#8a6424] bg-gradient-to-b from-[#2b2416] to-[#171a26] px-4 py-3 sm:col-span-3 lg:col-span-1">
            <RankBadge tier={tier} size={50} />
            <div className="min-w-0 flex-1">
              <div className="text-[18px] font-extrabold" style={{ color: tier.color }}>
                {tier.name}
              </div>
              <ProgressBar value={progress} className="mt-1.5" color="linear-gradient(90deg,#fd7b3a,#fbbf3b)" />
              <div className="tabular mt-1.5 text-[13px]">
                <span className="font-extrabold text-gold">{fmt(p.rating)}</span>
                {next ? <span className="text-mute"> / {fmt(next.min)} for {next.name}</span> : <span className="text-mute"> · top title</span>}
              </div>
            </div>
          </div>
          <Tile label="Rating">
            <div className="tabular flex items-baseline gap-2 text-[26px] leading-tight font-black">
              {fmt(p.rating)}
              {p.lastDelta !== 0 && (
                <span className={cx('flex items-center gap-0.5 text-[14px]', p.lastDelta > 0 ? 'text-mint' : 'text-rose')}>
                  {p.lastDelta > 0 ? <TrendingUp size={15} strokeWidth={3} /> : <TrendingDown size={15} strokeWidth={3} />}
                  {Math.abs(p.lastDelta)}
                </span>
              )}
            </div>
            <div className="tabular text-[13px] text-mute">Peak {fmt(p.peak)}</div>
          </Tile>
          <Tile label="Global Rank">
            <div className="tabular text-[26px] leading-tight font-black">#{fmt(rank)}</div>
            <div className="text-[13px] text-mute">Top {topPercent(rank, total)}%</div>
          </Tile>
          <Tile label="Win Rate">
            <div className="tabular text-[26px] leading-tight font-black">
              {p.games ? rate : '-'}
              {p.games > 0 && <span className="text-[17px]">%</span>}
            </div>
            <div className="tabular text-[13px] text-mute">
              {fmt(p.wins)}W {fmt(p.losses)}L
            </div>
          </Tile>
          <Tile label="Total Games">
            <div className="tabular flex items-center gap-2 text-[26px] leading-tight font-black">
              <Gamepad2 size={22} className="text-[#8fb6ff]" />
              {fmt(p.games)}
            </div>
            <div className="text-[13px] text-mute">all modes</div>
          </Tile>
          <Tile label="Streak" className="col-span-2 sm:col-span-1">
            <div className="tabular flex items-center gap-1.5 text-[20px] leading-[1.6] font-black whitespace-nowrap">
              <Flame size={19} className="shrink-0 text-flame" fill="currentColor" />
              {p.streak} {p.streak === 1 ? 'day' : 'days'}
            </div>
            <div className="tabular text-[13px] text-mute">
              Best: {p.bestStreak} {p.bestStreak === 1 ? 'day' : 'days'}
            </div>
          </Tile>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1.12fr_1fr]">
          <div className="rounded-2xl border border-line bg-[#131d38] p-4">
            <h3 className="text-[16px] font-extrabold">Skill Ratings</h3>
            <div className="mt-3 flex gap-2.5">
              <SkillCard w={w} p={p} mode="listening" />
              <SkillCard w={w} p={p} mode="vocab" />
            </div>
            <div className="mt-4 flex items-center justify-between">
              <h3 className="text-[16px] font-extrabold">Rating History</h3>
              <span className="text-[12.500px] text-mute">Last {Math.max(1, p.history.length)} games</span>
            </div>
            <div className="mt-2">
              <RatingChart history={p.history} />
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-[#131d38] p-4">
            <h3 className="mb-3 text-[16px] font-extrabold">Recent Games</h3>
            <RecentGames w={w} p={p} now={now} />
          </div>
        </div>
      </div>
    </Modal>
  )
}
