import { BarChart3, BookOpen, CalendarDays, Check, CircleCheck, Crown, Dumbbell, Info, Lock, LoaderCircle, Sparkles, Swords, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { DEFAULT_SECS, DIFFICULTIES, MODES, ROUND_OPTIONS, SECS_OPTIONS, TOPICS } from '../game/config'
import type { Difficulty, Invite, Mode, RoomTopic } from '../game/types'
import { usePending } from '../lib/hooks'
import { go, setUi, showToast, useUi } from '../lib/ui'
import { acceptInvite, declineInvite, hostRoom } from '../sim/actions'
import { useWorld } from '../sim/store'
import { Avatar } from '../ui/Avatar'
import { cx, DifficultyChip, ModeIcon, Spinner } from '../ui/bits'
import { Modal } from '../ui/Modal'
import { PlayerModal } from './PlayerModal'

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T
  options: [T, string][]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex rounded-xl bg-[#0b1224] p-1">
      {options.map(([v, label]) => (
        <button
          key={String(v)}
          onClick={() => onChange(v)}
          className={cx(
            'h-9 flex-1 rounded-lg text-[14px] transition',
            v === value ? 'bg-gradient-to-b from-azure-2 to-azure font-extrabold text-white shadow' : 'text-soft hover:text-white',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

const Label = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-2 text-[13px] font-extrabold tracking-wide text-mute uppercase">{children}</div>
)

function CreateRoomModal({ inviteId }: { inviteId?: string }) {
  const w = useWorld()
  const target = inviteId ? w.players[inviteId] : null
  const [mode, setMode] = useState<Mode>('vocab')
  const [topic, setTopic] = useState<RoomTopic>('random')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [rounds, setRounds] = useState(10)
  const [secs, setSecs] = useState(DEFAULT_SECS.vocab.medium)
  const [max, setMax] = useState(target ? 2 : 4)
  const [priv, setPriv] = useState(!!target)
  const close = () => setUi({ create: null })

  // time per round follows the mode and level until the player overrides it
  const pickMode = (m: Mode) => {
    setMode(m)
    setSecs(DEFAULT_SECS[m][difficulty])
  }
  const pickDifficulty = (d: Difficulty) => {
    setDifficulty(d)
    setSecs(DEFAULT_SECS[mode][d])
  }

  const [creating, run] = usePending(450, 800)
  const create = () =>
    run(() => {
      const id = hostRoom({ mode, topic, difficulty, rounds, secs, max, priv }, target?.id)
      close()
      if (id != null) go(`room/${id}`)
    })

  return (
    <Modal onClose={close} className="sm:max-w-[560px]">
      <div className="p-5 sm:p-7">
        <h2 className="flex items-center gap-2.5 text-[24px] font-black">
          {target ? (
            <>
              <Swords size={24} className="text-azure-2" />
              Challenge {target.name}
            </>
          ) : (
            'Create Room'
          )}
        </h2>
        <p className="mt-1 text-[14px] text-mute">
          {target ? 'Pick the game. They get an invite as soon as the room opens.' : 'Set up a game and wait for players to join.'}
        </p>

        <div className="mt-5 space-y-5">
          <div>
            <Label>Game</Label>
            <div className="grid grid-cols-2 gap-2.5">
              {(['vocab', 'listening'] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => pickMode(m)}
                  className={cx(
                    'relative rounded-2xl border-2 p-3.5 text-left transition',
                    mode === m ? 'border-azure-2 bg-[#16264d]' : 'border-line bg-[#131d38] hover:border-[#3a4568]',
                  )}
                >
                  <ModeIcon mode={m} size={40} />
                  <div className="mt-2.5 text-[15.500px] font-extrabold">{MODES[m].name}</div>
                  <div className="mt-0.5 text-[12.500px] leading-snug text-mute">{MODES[m].blurb}</div>
                  {mode === m && (
                    <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-azure-2">
                      <Check size={13} strokeWidth={4} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Topic</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(TOPICS) as RoomTopic[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTopic(t)}
                  className={cx(
                    'h-9 rounded-full border px-3.5 text-[14px] transition',
                    topic === t ? 'border-flame bg-flame/15 font-extrabold text-flame-2' : 'border-line bg-[#131d38] text-soft hover:text-white',
                  )}
                >
                  {TOPICS[t]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Level</Label>
            <Segmented
              value={difficulty}
              onChange={pickDifficulty}
              options={(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => [d, DIFFICULTIES[d].name])}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Rounds</Label>
              <Segmented value={rounds} onChange={setRounds} options={ROUND_OPTIONS.map((n) => [n, String(n)])} />
            </div>
            <div>
              <Label>Seconds</Label>
              <Segmented value={secs} onChange={setSecs} options={SECS_OPTIONS[mode].map((n) => [n, String(n)])} />
            </div>
            <div>
              <Label>Players</Label>
              <Segmented value={max} onChange={setMax} options={[2, 3, 4].map((n) => [n, String(n)])} />
            </div>
          </div>

          <button
            onClick={() => setPriv(!priv)}
            className="flex w-full items-center gap-3 rounded-2xl border border-line bg-[#131d38] px-4 py-3 text-left"
            role="switch"
            aria-checked={priv}
          >
            <Lock size={18} className={priv ? 'text-flame-2' : 'text-mute'} />
            <span className="flex-1">
              <span className="block text-[14.500px] font-extrabold">Invite only</span>
              <span className="block text-[12.500px] text-mute">Only players you invite can take a seat.</span>
            </span>
            <span className={cx('relative h-6 w-11 rounded-full transition', priv ? 'bg-flame' : 'bg-[#2c3554]')}>
              <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all', priv ? 'left-[22px]' : 'left-0.5')} />
            </span>
          </button>
        </div>

        <button
          onClick={create}
          disabled={creating}
          className="mt-6 flex h-[52px] w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-b from-flame-2 to-flame text-[17px] font-black shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_10px_24px_rgba(253,123,58,0.3)] transition active:scale-[0.985] disabled:opacity-80"
        >
          {creating && <Spinner size={19} />}
          {creating ? 'Creating room...' : target ? 'Send challenge' : 'Create room'}
        </button>
      </div>
    </Modal>
  )
}

const PERKS = [
  { icon: BookOpen, title: 'Learn', text: 'Guided lessons that follow the words and sounds you keep missing.' },
  { icon: Dumbbell, title: 'Unlimited practice', text: 'Solo drills for every game mode, with no daily limit.' },
  { icon: BarChart3, title: 'Detailed insights', text: 'See exactly which topics and skills cost you rating.' },
  { icon: CalendarDays, title: 'Daily challenge archive', text: 'Replay any past challenge and beat your old score.' },
]

function ProModal() {
  const close = () => setUi({ pro: false })
  return (
    <Modal onClose={close} sheet={false} className="max-w-[440px]">
      <div className="bg-gradient-to-b from-[#3b2a16] to-transparent px-6 pt-8 pb-2 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-b from-[#ffd766] to-[#f59e0b] text-[#4a2c05] shadow-[0_10px_30px_rgba(251,191,59,0.35)]">
          <Crown size={34} fill="currentColor" />
        </span>
        <h2 className="mt-4 text-[26px] font-black">
          LingoPlay <span className="text-gold">Pro</span>
        </h2>
        <p className="mx-auto mt-1 max-w-[300px] text-[14.500px] text-soft">For players who want to learn and practice between battles.</p>
      </div>
      <div className="space-y-2.5 px-6 pt-3">
        {PERKS.map((perk) => (
          <div key={perk.title} className="flex items-start gap-3 rounded-2xl border border-line bg-[#131d38] p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2b2416] text-gold">
              <perk.icon size={20} />
            </span>
            <div>
              <div className="text-[15px] font-extrabold">{perk.title}</div>
              <div className="text-[13px] leading-snug text-mute">{perk.text}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="p-6">
        <button
          onClick={() => {
            close()
            showToast('Thanks! We will let you know when Pro launches', 'good')
          }}
          className="flex h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-[#ffd766] to-[#f59e0b] text-[16px] font-black text-[#3b2405]"
        >
          <Sparkles size={18} />
          Notify me at launch
        </button>
        <p className="mt-3 text-center text-[12.500px] text-mute">Pro is not available yet. Playing online stays free.</p>
      </div>
    </Modal>
  )
}

export function Toasts() {
  const { toasts } = useUi()
  const w = useWorld()
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[70] flex flex-col items-center gap-2 px-3">
      {toasts.map((t) => {
        const p = t.pid ? w.players[t.pid] : null
        return (
          <div
            key={t.id}
            className="animate-rise flex max-w-full items-center gap-2.5 rounded-2xl border border-[#34436f] bg-[#16203d] py-2.5 pr-4 pl-3 text-[14.500px] shadow-2xl"
          >
            {p ? (
              <Avatar size={26} />
            ) : t.tone === 'good' ? (
              <CircleCheck size={20} className="text-mint" />
            ) : t.tone === 'bad' ? (
              <TriangleAlert size={20} className="text-rose" />
            ) : (
              <Info size={20} className="text-azure-2" />
            )}
            <span className="min-w-0">{t.text}</span>
          </div>
        )
      })}
    </div>
  )
}

function InviteCard({ invite, now }: { invite: Invite; now: number }) {
  const w = useWorld()
  const [joining, run] = usePending(300, 550)
  const from = w.players[invite.from]
  const room = w.rooms[invite.roomId]
  if (!from || !room) return null
  const left = Math.max(0, 1 - (now - invite.at) / 40_000)
  return (
    <div className="animate-rise overflow-hidden rounded-2xl border border-[#3d59a6] bg-[#14203f] shadow-2xl">
      <div className="flex items-center gap-3 p-3.5">
        <button onClick={() => setUi({ profile: from.id })}>
          <Avatar size={44} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14.500px]">
            <span className="font-extrabold">{from.name}</span> <span className="text-soft">invited you</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-[12.500px] text-mute">
            <ModeIcon mode={room.mode} size={20} />
            <span className="truncate">
              {MODES[room.mode].name} · {TOPICS[room.topic]}
            </span>
            <DifficultyChip difficulty={room.difficulty} className="!px-1.5 !py-0 !text-[11px]" />
          </div>
        </div>
      </div>
      <div className="flex gap-2 px-3.5 pb-3.5">
        <button
          onClick={() => declineInvite(invite.id)}
          disabled={joining}
          className="h-9 flex-1 rounded-xl bg-raise text-[14px] font-bold text-soft hover:text-white"
        >
          Decline
        </button>
        <button
          onClick={() =>
            run(() => {
              const id = acceptInvite(invite.id)
              if (id != null) go(`room/${id}`)
            })
          }
          disabled={joining}
          className="flex h-9 flex-1 items-center justify-center rounded-xl bg-gradient-to-b from-flame-2 to-flame text-[14px] font-extrabold"
        >
          {joining ? <Spinner size={17} /> : 'Join'}
        </button>
      </div>
      <div className="h-1 bg-white/5">
        <div className="h-full bg-azure-2" style={{ width: `${left * 100}%` }} />
      </div>
    </div>
  )
}

/** invitations from other players, stacked in the corner */
function Invites() {
  const w = useWorld()
  const [, force] = useState(0)
  useEffect(() => {
    if (!w.invites.length) return
    const id = setInterval(() => force((n) => n + 1), 200)
    return () => clearInterval(id)
  }, [w.invites.length])
  if (!w.invites.length) return null
  const now = Date.now()
  return (
    <div className="fixed inset-x-3 bottom-[76px] z-40 flex flex-col gap-2 desk:inset-x-auto desk:right-5 desk:bottom-5 desk:w-[340px]">
      {w.invites.map((inv) => (
        <InviteCard key={inv.id} invite={inv} now={now} />
      ))}
    </div>
  )
}

function Matching() {
  return (
    <div className="animate-fade fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-[#070b16]/85 backdrop-blur-sm">
      <LoaderCircle size={54} className="animate-spin text-azure-2" strokeWidth={2.4} />
      <div className="text-[20px] font-black">Finding a game...</div>
      <div className="text-[14px] text-mute">Looking for an open room</div>
    </div>
  )
}

export function Overlays() {
  const ui = useUi()
  return (
    <>
      {location.hash.startsWith('#/room/') ? null : <Invites />}
      {ui.create && <CreateRoomModal key={ui.create.inviteId ?? 'new'} inviteId={ui.create.inviteId} />}
      {ui.profile && <PlayerModal key={ui.profile} id={ui.profile} />}
      {ui.pro && <ProModal />}
      {ui.matching && <Matching />}
      <Toasts />
    </>
  )
}
