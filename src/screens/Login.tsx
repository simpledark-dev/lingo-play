import { ArrowRight, Mail } from 'lucide-react'
import { usePending } from '../lib/hooks'
import { comingSoon } from '../lib/ui'
import { loginAsGuest } from '../sim/actions'
import { useWorld } from '../sim/store'
import { Avatar } from '../ui/Avatar'
import { Spinner } from '../ui/bits'

export function Login() {
  const w = useWorld()
  const [signingIn, signIn] = usePending(500, 900)
  const players = Object.values(w.players)
  const online = players.filter((p) => p.online).length
  const live = Object.values(w.rooms).filter((r) => r.status === 'playing').length
  const faces = players.filter((p) => p.online).slice(0, 5)

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <img src="/assets/game-bg.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0b1224]/80 via-[#0b1224]/70 to-[#0b1224]/95" />

      <div className="animate-rise relative w-full max-w-[420px] rounded-3xl border border-white/10 bg-[#0d162b]/90 p-7 shadow-2xl backdrop-blur-md sm:p-9">
        <img src="/assets/logo.png" alt="LingoPlay" className="mx-auto h-[52px]" />
        <h1 className="mt-6 text-center text-[34px] leading-[1.05] font-black tracking-tight">
          Play together.
          <br />
          <span className="text-flame-2">Learn faster.</span>
        </h1>
        <p className="mx-auto mt-3 max-w-[300px] text-center text-[15px] text-soft">
          Live English battles against real players. Win games, raise your rating, climb the ranks.
        </p>

        <button
          onClick={() => signIn(loginAsGuest)}
          disabled={signingIn}
          className="group mt-7 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-flame-2 to-flame py-4 text-lg font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_10px_24px_rgba(253,123,58,0.35)] transition active:scale-[0.98] disabled:opacity-80"
        >
          {signingIn ? (
            <>
              <Spinner size={20} />
              Setting up your profile...
            </>
          ) : (
            <>
              Play as guest
              <ArrowRight size={20} strokeWidth={3} className="transition group-hover:translate-x-1" />
            </>
          )}
        </button>
        <button
          onClick={() => comingSoon('Sign in with email')}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-3.5 text-[15px] font-bold text-soft transition hover:bg-white/10"
        >
          <Mail size={17} />
          Sign in with email
          <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] tracking-wide text-mute uppercase">Soon</span>
        </button>
        <p className="mt-4 text-center text-[13px] text-mute">No account needed. We will pick a name for you.</p>

        <div className="mt-6 flex items-center justify-center gap-3 border-t border-white/10 pt-5">
          <div className="flex -space-x-2">
            {faces.map((p) => (
              <Avatar key={p.id} size={28} ring="#0d162b" />
            ))}
          </div>
          <div className="text-[13px] leading-tight text-soft">
            <span className="inline-flex items-center gap-1.5 font-extrabold text-white">
              <span className="h-2 w-2 rounded-full bg-mint" />
              {online} players online
            </span>
            <div className="text-mute">{live} games in progress</div>
          </div>
        </div>
      </div>
    </div>
  )
}
