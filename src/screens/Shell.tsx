import {
  BookOpen,
  CalendarDays,
  Crown,
  Gamepad2,
  MessagesSquare,
  Music,
  Trophy,
  User,
  Users,
  Volume2,
  VolumeX,
  type LucideIcon,
} from 'lucide-react'
import { MODES } from '../game/config'
import { comingSoon, go, setSettings, setUi, useSettings, type Route } from '../lib/ui'
import { mySeat } from '../sim/actions'
import { me, useWorld } from '../sim/store'
import { Avatar } from '../ui/Avatar'
import { cx, fmt } from '../ui/bits'
import { Lobby } from './Lobby'
import { OnlinePanel } from './OnlinePanel'
import { Rankings } from './Rankings'

interface NavItem {
  key: string
  label: string
  icon: LucideIcon
  soon?: boolean
  dot?: boolean
  onClick: () => void
}

const NAV: NavItem[] = [
  { key: 'lobby', label: 'Play', icon: Gamepad2, onClick: () => go('lobby') },
  { key: 'daily', label: 'Daily Challenge', icon: CalendarDays, soon: true, dot: true, onClick: () => comingSoon('Daily Challenge') },
  { key: 'rankings', label: 'Rankings', icon: Trophy, onClick: () => go('rankings') },
  { key: 'learn', label: 'Learn', icon: BookOpen, soon: true, onClick: () => comingSoon('Learn') },
  { key: 'community', label: 'Community', icon: MessagesSquare, soon: true, onClick: () => comingSoon('Community') },
  { key: 'profile', label: 'Profile', icon: User, onClick: () => setUi({ profile: 'me' }) },
]

function SoundToggles({ compact }: { compact?: boolean }) {
  const s = useSettings()
  const btn = 'flex items-center justify-center gap-2 rounded-xl border border-line bg-panel text-soft transition hover:bg-raise'
  if (compact) {
    // phones get one switch for all sound
    const on = s.music || s.sfx
    return (
      <button
        onClick={() => setSettings({ music: !on, sfx: !on })}
        className={cx(btn, 'h-9 w-9', !on && 'opacity-50')}
        title={on ? 'Turn sound off' : 'Turn sound on'}
        aria-pressed={on}
      >
        {on ? <Volume2 size={17} /> : <VolumeX size={17} />}
      </button>
    )
  }
  return (
    <div className="flex w-full gap-2">
      <button
        onClick={() => setSettings({ music: !s.music })}
        className={cx(btn, 'h-10 flex-1 text-[13px]', !s.music && 'opacity-50')}
        title={s.music ? 'Turn lobby music off' : 'Turn lobby music on'}
        aria-pressed={s.music}
      >
        <Music size={16} />
        {s.music ? 'Music on' : 'Music off'}
      </button>
      <button
        onClick={() => setSettings({ sfx: !s.sfx })}
        className={cx(btn, 'h-10 w-10', !s.sfx && 'opacity-50')}
        title={s.sfx ? 'Mute sound effects' : 'Unmute sound effects'}
        aria-pressed={s.sfx}
      >
        {s.sfx ? <Volume2 size={16} /> : <VolumeX size={16} />}
      </button>
    </div>
  )
}

/** full width on big screens, an icon rail on smaller laptops so the lobby keeps its three columns */
function Sidebar({ route }: { route: Route }) {
  return (
    <aside className="scroll-slim hidden w-[78px] shrink-0 flex-col overflow-y-auto border-r border-white/5 bg-side desk:flex wide:w-[240px]">
      <button onClick={() => go('lobby')} className="px-4 pt-5 pb-4 text-left wide:px-5">
        <img src="/assets/logo.png" alt="LingoPlay" className="h-[50px] w-[46px] object-cover object-left wide:w-auto" />
      </button>
      <nav className="flex flex-col gap-1.5 border-t border-white/5 px-3 pt-4 wide:px-4">
        {NAV.map((item) => {
          const active = item.key === route.name
          return (
            <button
              key={item.key}
              onClick={item.onClick}
              title={item.label}
              className={cx(
                'relative flex h-[50px] items-center justify-center gap-4 rounded-xl text-left text-[16px] transition wide:justify-start wide:px-4',
                active
                  ? 'bg-gradient-to-r from-flame to-flame-2 font-extrabold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_6px_16px_rgba(253,123,58,0.3)]'
                  : 'text-soft hover:bg-white/5',
              )}
            >
              <item.icon size={24} strokeWidth={2.2} className={cx('shrink-0', !active && 'text-[#9fb0d6]')} />
              <span className="hidden wide:inline">{item.label}</span>
              {item.dot && <span className="absolute top-3 right-3 h-2.5 w-2.5 rounded-full bg-[#ff4d5e] wide:right-4" />}
            </button>
          )
        })}
      </nav>

      <div className="mt-auto px-3 pt-6 pb-4 wide:px-4">
        <div className="hidden overflow-hidden rounded-2xl border border-white/10 bg-[#0e1525] wide:block">
          <img src="/assets/side-banner.png" alt="Learn, compete, level up" className="w-full" />
          <div className="px-3 pt-1 pb-4">
            <button
              onClick={() => setUi({ pro: true })}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#7a4a22] bg-gradient-to-b from-[#4a2f22] to-[#33211c] text-[15px] font-extrabold text-gold transition hover:brightness-125"
            >
              <Crown size={18} fill="currentColor" />
              Upgrade to Pro
            </button>
            <p className="mt-3 text-center text-[13px] leading-snug text-mute">
              Unlock unlimited practice, detailed insights, and more!
            </p>
          </div>
        </div>
        <div className="mt-3 hidden wide:block">
          <SoundToggles />
        </div>
        <div className="flex flex-col items-center gap-2 wide:hidden">
          <button
            onClick={() => setUi({ pro: true })}
            title="Upgrade to Pro"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#7a4a22] bg-gradient-to-b from-[#4a2f22] to-[#33211c] text-gold transition hover:brightness-125"
          >
            <Crown size={20} fill="currentColor" />
          </button>
          <SoundToggles compact />
        </div>
      </div>
    </aside>
  )
}

function MobileTop() {
  const p = me()
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/5 bg-side px-3 desk:hidden">
      <img src="/assets/logo.png" alt="LingoPlay" className="h-8" />
      <div className="flex items-center gap-2">
        <button
          onClick={() => setUi({ pro: true })}
          className="flex h-9 items-center gap-1.5 rounded-xl border border-[#7a4a22] bg-[#3b2620] px-2.5 text-[13px] font-extrabold text-gold"
        >
          <Crown size={15} fill="currentColor" />
          Pro
        </button>
        <SoundToggles compact />
        {p && (
          <button onClick={() => setUi({ profile: 'me' })} className="flex items-center gap-2 rounded-full bg-panel py-1 pr-3 pl-1">
            <Avatar size={28} />
            <span className="tabular text-[13px] font-extrabold text-gold">{fmt(p.rating)}</span>
          </button>
        )}
      </div>
    </header>
  )
}

const MOBILE_NAV: { key: string; label: string; icon: LucideIcon; onClick: () => void }[] = [
  { key: 'lobby', label: 'Play', icon: Gamepad2, onClick: () => go('lobby') },
  { key: 'rankings', label: 'Rankings', icon: Trophy, onClick: () => go('rankings') },
  { key: 'players', label: 'Players', icon: Users, onClick: () => go('players') },
  { key: 'profile', label: 'Profile', icon: User, onClick: () => setUi({ profile: 'me' }) },
]

function MobileNav({ route }: { route: Route }) {
  return (
    <nav className="flex shrink-0 border-t border-white/5 bg-side pb-[env(safe-area-inset-bottom)] desk:hidden">
      {MOBILE_NAV.map((item) => {
        const active = item.key === route.name
        return (
          <button
            key={item.key}
            onClick={item.onClick}
            className={cx('flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]', active ? 'font-extrabold text-flame-2' : 'text-mute')}
          >
            <item.icon size={22} strokeWidth={active ? 2.6 : 2.1} />
            {item.label}
          </button>
        )
      })}
    </nav>
  )
}

/** shown on lobby screens while the player still holds a seat in a room */
function SeatBar() {
  useWorld()
  const seat = mySeat()
  if (!seat) return null
  return (
    <button
      onClick={() => go(`room/${seat.id}`)}
      className="flex w-full shrink-0 items-center justify-center gap-2 bg-gradient-to-r from-azure to-grape px-3 py-2 text-[14px] font-extrabold"
    >
      <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
      You have a seat in room #{seat.id} · {MODES[seat.mode].name}
      <span className="rounded-md bg-white/20 px-2 py-0.5">Return</span>
    </button>
  )
}

export function Shell({ route }: { route: Route }) {
  return (
    <div className="flex h-dvh">
      <Sidebar route={route} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTop />
        <SeatBar />
        <div className="min-h-0 flex-1">
          {route.name === 'rankings' ? (
            <Rankings />
          ) : route.name === 'players' ? (
            <div className="h-full p-3 desk:mx-auto desk:max-w-md desk:p-5">
              <OnlinePanel />
            </div>
          ) : (
            <Lobby />
          )}
        </div>
        <MobileNav route={route} />
      </div>
    </div>
  )
}
