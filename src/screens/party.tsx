import { Castle, Check, CornerDownLeft, Crown, EyeOff, Flag, Heart, RotateCcw, Timer, Volume2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { isUnlocked, sfx, speak, stopSpeaking, whenUnlocked } from '../audio/audio'
import {
  BAND_NAMES,
  BOSS_PASS,
  CHECKPOINT_EVERY,
  DIFFICULTIES,
  HOTSEAT_POINTS,
  isCheckpoint,
  LEVELS,
  MAX_REPLAYS,
  PICK_MS,
  REPLAY_COST,
  STUMP_SHARE,
  towerBand,
  TOWER_MAX_LIVES,
  TTS_RATE,
} from '../game/config'
import type { Game, Room, Turn, World } from '../game/types'
import { setUi } from '../lib/ui'
import { pickSentence, submitAnswer, takeReplay } from '../sim/actions'
import { turnsTaken, typedChars } from '../sim/rooms'
import { Avatar } from '../ui/Avatar'
import { cx } from '../ui/bits'
import { lastReaction, ReactionBubble, TypedDiff, Verdict, VocabStage, type StageProps } from './stages'

const panel = 'rounded-2xl border border-white/10 bg-[#0b1426]/88 backdrop-blur-md'

/** the light colour each game shines on its player */
const TONE = {
  spotlight: { ring: '#ffd45e', text: 'text-[#ffd45e]', beam: '255, 226, 150', tag: 'On stage' },
  hotseat: { ring: '#ff7d8e', text: 'text-[#ff9aa8]', beam: '255, 150, 160', tag: 'In the hot seat' },
  tower: { ring: '#7cc8ff', text: 'text-[#9ad4ff]', beam: '150, 205, 255', tag: 'Boss floor' },
} as const
type Tone = (typeof TONE)[keyof typeof TONE]
const toneOf = (room: Room): Tone => TONE[room.mode as keyof typeof TONE] ?? TONE.spotlight

const seated = (room: Room, game: Game) => (game.order ?? room.players).filter((p) => room.players.includes(p))
const nameOf = (w: World, pid: string) => (pid === w.meId ? 'You' : (w.players[pid]?.name ?? 'Someone'))
const levelName = (level: number) => DIFFICULTIES[LEVELS[Math.min(2, level)]].name
const rateOf = (turn: Turn) => TTS_RATE[LEVELS[Math.min(2, turn.level)]]

/** plays the sentence once when a turn opens; everyone at the table hears it */
function useSentenceAudio(text: string | undefined, rate: number, on: boolean) {
  const [speaking, setSpeaking] = useState(false)
  const [blocked, setBlocked] = useState(!isUnlocked())
  useEffect(() => {
    if (!on || !text) return
    let cancelled = false
    const handlers = { onstart: () => !cancelled && setSpeaking(true), onend: () => !cancelled && setSpeaking(false) }
    whenUnlocked(() => {
      if (cancelled) return
      setBlocked(false)
      speak(text, rate, handlers)
    })
    return () => {
      cancelled = true
      stopSpeaking()
      setSpeaking(false)
    }
  }, [on, text, rate])
  const replay = () => text && speak(text, rate, { onstart: () => setSpeaking(true), onend: () => setSpeaking(false) })
  return { speaking, blocked, replay }
}

function TimeBar({ game, now, total, tone }: { game: Game; now: number; total: number; tone: string }) {
  const left = Math.max(0, Math.min(1, (game.end - now) / total))
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div className="h-full rounded-full" style={{ width: `${left * 100}%`, background: left < 0.25 ? '#f0566a' : tone, transition: 'width 120ms linear' }} />
    </div>
  )
}

// ---------------------------------------------------------------- header

function TurnHeader({ w, room, game, now, playing }: StageProps) {
  const turn = game.turns![game.round]
  const seats = seated(room, game)
  const total = room.rounds * seats.length
  const live = game.phase === 'question' || game.phase === 'pick'
  const secsLeft = Math.max(0, Math.ceil((game.end - now) / 1000))
  const mine = playing && turn.pid === w.meId && game.phase === 'question' && !game.answers[game.round]?.[turn.pid]
  const urgent = live && secsLeft <= 3
  const lastTick = useRef(0)
  useEffect(() => {
    if (mine && urgent && secsLeft > 0 && lastTick.current !== secsLeft) {
      lastTick.current = secsLeft
      sfx('tick')
    }
  }, [mine, urgent, secsLeft])

  return (
    <div className={cx(panel, 'flex items-center gap-3 px-3.5 py-2.5 sm:gap-5 sm:px-6 sm:py-3')}>
      <div className="min-w-0 flex-1">
        <div className="text-[17px] leading-tight font-black sm:text-[20px]">
          Round {Math.min(room.rounds, Math.floor(game.round / Math.max(1, seats.length)) + 1)} <span className="font-bold text-soft">/ {room.rounds}</span>
          <span className="ml-3 text-[13px] font-bold text-mute">
            turn {Math.min(total, game.round + 1)} of {total}
          </span>
        </div>
        <div className="mt-2 flex gap-[3px] sm:gap-1">
          {Array.from({ length: total }, (_, i) => {
            const t = game.turns![i]
            const a = t ? game.answers[i]?.[t.pid] : undefined
            const done = i < game.round || (i === game.round && game.phase === 'reveal')
            return (
              <span
                key={i}
                title={t ? nameOf(w, t.pid) : undefined}
                className={cx(
                  'h-1.5 min-w-0 flex-1 rounded-full',
                  done ? (a && a.acc >= 0.999 ? 'bg-mint' : a && a.acc >= 0.7 ? 'bg-gold' : 'bg-rose') : i === game.round ? 'bg-white' : 'bg-[#33496f]',
                )}
              />
            )
          })}
        </div>
      </div>
      <div className={cx('tabular flex w-[74px] items-center justify-end gap-2 text-[24px] font-black sm:w-[96px] sm:text-[30px]', urgent ? 'text-rose' : 'text-[#f9b550]')}>
        <Timer size={26} strokeWidth={2.4} className={cx('text-white', urgent && 'animate-pulse')} />
        {live ? `${secsLeft}s` : <span className="text-[15px] font-extrabold text-soft sm:text-[17px]">Next</span>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- the stage

/**
 * One player in the light, typing a sentence everyone at the table just heard.
 * Used by Spotlight, Hot Seat and the boss floor of Tower Climb.
 */
function SpotStage({ w, room, game, now, playing, turn }: StageProps & { turn: Turn }) {
  const tone = toneOf(room)
  const actor = w.players[turn.pid]
  const reveal = game.phase === 'reveal'
  const ans = game.answers[game.round]?.[turn.pid]
  const onStage = playing && turn.pid === w.meId
  const editable = onStage && !reveal && !ans
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const roomId = room.id
  const { speaking, blocked, replay } = useSentenceAudio(turn.text, rateOf(turn), game.phase === 'question')

  useEffect(() => {
    if (editable) inputRef.current?.focus()
  }, [editable])

  // time is up: whatever has been typed so far is the answer
  useEffect(() => {
    if (editable && text.trim() && now >= game.end - 250) submitAnswer(roomId, text)
  }, [editable, text, now, game.end, roomId])

  const submit = () => {
    if (!editable || !text.trim()) return
    submitAnswer(room.id, text)
    sfx('pop')
  }
  const replaysLeft = MAX_REPLAYS - game.replays
  const onReplay = () => {
    if (!editable || !takeReplay(room.id)) return
    replay()
  }

  // a bot's typing shows letter by letter, hesitations and corrections included
  const plan = game.plans[turn.pid]
  const liveText = ans ? String(ans.v ?? '') : plan?.segs ? String(plan.v).slice(0, typedChars(plan.segs, now)) : ''
  const typing = !ans && !!plan?.segs?.some((seg) => now >= seg.t0 && now < seg.t1)
  const status = ans ? 'Submitted' : typing ? 'Typing' : liveText ? 'Thinking' : speaking ? 'Listening' : 'Getting ready'

  const picker = turn.picker ? w.players[turn.picker] : null
  // in Hot Seat everyone except the player in the seat can read the sentence
  const audienceSees = room.mode === 'hotseat' && w.meId !== turn.pid && !reveal && !!turn.text
  const worth = room.mode === 'hotseat' ? HOTSEAT_POINTS[turn.level] : null

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#04060d]/93 shadow-2xl">
      <div className="spot-beam" style={{ ['--beam' as string]: tone.beam }} />
      <div className="relative flex flex-col items-center px-4 pt-5 pb-5 sm:px-8 sm:pt-6 sm:pb-6">
        <span className={cx('rounded-full border border-current/40 px-3 py-1 text-[11.500px] font-black tracking-[0.18em] uppercase', tone.text)}>
          {turn.boss ? TONE.tower.tag : tone.tag}
        </span>

        <button onClick={() => setUi({ profile: turn.pid })} className="animate-pop relative mt-3">
          <ReactionBubble reaction={lastReaction(room, turn.pid)} now={now} />
          <span className="spot-halo" style={{ ['--beam' as string]: tone.beam }} />
          <Avatar size={104} ring={tone.ring} className="relative !h-[76px] !w-[76px] sm:!h-[104px] sm:!w-[104px]" />
        </button>
        <div className="mt-2.5 flex items-baseline gap-2">
          <span className="text-[22px] leading-tight font-black sm:text-[27px]">{onStage ? "You're up" : (actor?.name ?? 'Player')}</span>
          <span className="tabular text-[14px] font-bold text-gold">{actor?.rating}</span>
        </div>
        <div className="mt-0.5 min-h-[20px] text-center text-[13.500px] text-soft">
          {room.mode === 'hotseat' && picker ? (
            <>
              <b className="text-white">{nameOf(w, picker.id)}</b> picked {onStage ? 'you' : 'them'} {turn.level === 0 ? 'an' : 'a'}{' '}
              <b className={tone.text}>{levelName(turn.level).toLowerCase()}</b> sentence, worth up to {worth}
            </>
          ) : turn.boss ? (
            <>Type the last sentence at least {Math.round(BOSS_PASS * 100)}% right and the team reaches the top</>
          ) : onStage ? (
            'Everyone at the table is watching you type'
          ) : (
            <>Everyone hears it. Only {actor?.name} can answer.</>
          )}
        </div>

        {reveal ? (
          <div className="animate-rise mt-4 w-full max-w-[640px] text-center">
            <div className="text-[12px] font-extrabold tracking-[0.14em] text-[#8fb6ff] uppercase">The sentence was</div>
            <div className="mt-1 text-[20px] leading-snug font-black sm:text-[25px]">{turn.text}</div>
          </div>
        ) : (
          <div className="mt-3.5 flex items-center gap-3">
            <button
              onClick={onReplay}
              disabled={!editable || replaysLeft <= 0}
              className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#2f7bff] to-[#1846c4] shadow-[0_0_0_3px_rgba(127,180,255,0.3)] disabled:cursor-default"
              aria-label="Play the sentence again"
            >
              {speaking && <span className="animate-pulse-ring absolute inset-0 rounded-full border-[3px] border-[#9d7bff]" />}
              <Volume2 size={21} strokeWidth={2.4} />
            </button>
            <div className={cx('wave flex h-8 items-center gap-[4px]', speaking && 'on')}>
              {[10, 18, 26, 16, 28, 14, 22, 12, 20].map((h, i) => (
                <span key={i} style={{ ['--h' as string]: `${h}px`, animationDelay: `${i * 0.09}s` }} />
              ))}
            </div>
            <span className="text-[13.500px] leading-tight font-bold text-soft">
              {blocked ? 'Tap anywhere to turn the sound on' : speaking ? 'Listen...' : editable ? 'Type what you heard' : 'Sentence played'}
              {editable && !speaking && !blocked && (
                <span className="block text-[12px] font-semibold text-mute sm:hidden">
                  Tap the speaker to replay ({Math.max(0, replaysLeft)} left, -{REPLAY_COST} pts)
                </span>
              )}
            </span>
            {editable && (
              <button
                onClick={onReplay}
                disabled={replaysLeft <= 0}
                className="hidden items-center gap-1.5 rounded-full border border-[#3d6fd6] bg-[#12244d] px-3 py-1.5 text-[12.500px] font-extrabold whitespace-nowrap text-[#9cc2ff] disabled:opacity-40 sm:flex"
              >
                <RotateCcw size={14} strokeWidth={2.6} />
                Replay
                <span className="text-[#6f8fc9]">
                  -{REPLAY_COST} · {Math.max(0, replaysLeft)} left
                </span>
              </button>
            )}
          </div>
        )}

        {audienceSees && (
          <div className="mt-3 flex max-w-[640px] items-start gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-[14px]">
            <EyeOff size={16} className="mt-0.5 shrink-0 text-mute" />
            <span>
              <span className="text-mute">Hidden from {actor?.name}: </span>
              <b>{turn.text}</b>
            </span>
          </div>
        )}

        <div className="mt-3.5 w-full max-w-[640px]">
          <div className="rounded-2xl border-2 bg-[#f6f8fb] text-[#14203f]" style={{ borderColor: tone.ring }}>
            {editable ? (
              <textarea
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value.replace(/\n/g, '').slice(0, 100))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    submit()
                  }
                }}
                rows={2}
                placeholder="Type what you hear..."
                autoCapitalize="sentences"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className="block h-[84px] w-full resize-none bg-transparent px-4 py-3 text-[20px] leading-snug font-bold outline-none placeholder:font-semibold placeholder:text-[#9aa4bd]"
              />
            ) : (
              <div className="min-h-[84px] px-4 py-3 text-[20px] leading-snug font-bold break-words">
                {reveal ? (
                  turn.void ? (
                    <span className="text-[#8a94ad]">Left the game</span>
                  ) : (
                    <TypedDiff target={turn.text ?? ''} typed={String(ans?.v ?? '')} />
                  )
                ) : (
                  <>
                    {onStage ? String(ans?.v ?? '') : liveText}
                    {!ans && <span className="animate-pulse text-[#9aa4bd]">|</span>}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="mt-2.5 flex min-h-[44px] items-center gap-3">
            {reveal ? (
              <div className="animate-pop flex w-full flex-wrap items-center justify-center gap-2">
                {ans && <Verdict acc={ans.acc} pts={ans.pts} />}
                {room.mode === 'hotseat' && picker && (turn.bonus ?? 0) > 0 && (
                  <span className="rounded-full border border-[#7a2c3c] bg-[#30141c] px-2.5 py-1 text-[12.500px] font-extrabold text-[#ff9aa8]">
                    {nameOf(w, picker.id)} +{turn.bonus} for the misses
                  </span>
                )}
              </div>
            ) : editable ? (
              <>
                <div className="flex-1">
                  <TimeBar game={game} now={now} total={turn.secs * 1000} tone={tone.ring} />
                </div>
                <span className="hidden items-center gap-1.5 text-[13px] text-soft sm:flex">
                  <CornerDownLeft size={14} />
                  Enter
                </span>
                <button
                  onClick={submit}
                  disabled={!text.trim()}
                  className="h-11 rounded-xl bg-gradient-to-b from-[#ffd53a] to-[#ff9a26] px-7 text-[16px] font-black text-[#3a2203] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] transition active:scale-[0.98] disabled:opacity-45"
                >
                  Submit
                </button>
              </>
            ) : (
              <>
                <span className="flex w-[96px] shrink-0 items-center gap-1.5 text-[13px] font-bold text-soft">
                  {ans ? <Check size={15} strokeWidth={3.5} className="text-[#8fb6ff]" /> : null}
                  {onStage ? 'Submitted' : status}
                </span>
                <div className="flex-1">
                  <TimeBar game={game} now={now} total={turn.secs * 1000} tone={tone.ring} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Hot Seat: the challenger picks

function PickStage({ w, room, game, now, playing, turn }: StageProps & { turn: Turn }) {
  const tone = toneOf(room)
  const target = w.players[turn.pid]
  const picker = turn.picker ? w.players[turn.picker] : null
  const iPick = playing && turn.picker === w.meId
  const iSit = turn.pid === w.meId
  const roomId = room.id
  const count = turn.options?.length ?? 0

  useEffect(() => {
    if (!iPick) return
    const onKey = (e: KeyboardEvent) => {
      const i = ['1', '2', '3'].indexOf(e.key)
      if (i >= 0 && i < count) pickSentence(roomId, i)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [iPick, roomId, count])

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#04060d]/93 px-4 py-5 shadow-2xl sm:px-8 sm:py-6">
      <div className="spot-beam" style={{ ['--beam' as string]: tone.beam }} />
      <div className="relative">
        <div className="flex items-center justify-center gap-4 sm:gap-7">
          <div className="flex w-[110px] flex-col items-center text-center">
            <span className="relative">
              <ReactionBubble reaction={picker ? lastReaction(room, picker.id) : undefined} now={now} />
              <Avatar size={56} ring="#8fb6ff" />
            </span>
            <span className="mt-1.5 max-w-full truncate text-[14px] font-extrabold">{picker ? nameOf(w, picker.id) : ''}</span>
            <span className="text-[11.500px] font-bold tracking-wide text-[#8fb6ff] uppercase">Challenger</span>
          </div>
          <span className="typing-dots text-soft">
            <span />
            <span />
            <span />
          </span>
          <div className="flex w-[110px] flex-col items-center text-center">
            <span className="relative">
              <ReactionBubble reaction={lastReaction(room, turn.pid)} now={now} />
              <span className="spot-halo" style={{ ['--beam' as string]: tone.beam }} />
              <Avatar size={72} ring={tone.ring} className="relative" />
            </span>
            <span className="mt-1.5 max-w-full truncate text-[15px] font-extrabold">{nameOf(w, turn.pid)}</span>
            <span className={cx('text-[11.500px] font-bold tracking-wide uppercase', tone.text)}>In the hot seat</span>
          </div>
        </div>

        <h3 className="mt-4 text-center text-[19px] leading-tight font-black sm:text-[22px]">
          {iPick ? `Pick a sentence for ${target?.name}` : iSit ? `${picker?.name} is choosing your sentence` : `${picker?.name} is choosing a sentence for ${target?.name}`}
        </h3>
        <p className="mx-auto mt-1 max-w-[520px] text-center text-[13.500px] text-soft">
          {iPick
            ? `Harder sentences are worth more to them, but you earn ${Math.round(STUMP_SHARE * 100)}% of whatever they miss.`
            : iSit
              ? 'You only get to hear it. Get ready.'
              : 'They hear it once and type it with everyone watching.'}
        </p>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
          {turn.options?.map((option, i) => (
            <button
              key={i}
              disabled={!iPick}
              onClick={() => pickSentence(room.id, i)}
              className={cx(
                'flex flex-col rounded-2xl border-2 bg-[#101a33] p-3 text-left transition sm:min-h-[112px]',
                iPick ? 'border-[#33437a] hover:border-[#ff7d8e] hover:bg-[#1a2444] active:scale-[0.985]' : 'border-[#232e52]',
              )}
            >
              <span className="flex items-center justify-between text-[12.500px] font-black tracking-wide uppercase">
                <span className={['text-[#5ee0a6]', 'text-[#fbc94b]', 'text-[#ff8196]'][option.level]}>{levelName(option.level)}</span>
                <span className="tabular text-soft">up to {HOTSEAT_POINTS[option.level]}</span>
              </span>
              {iSit ? (
                <span className="mt-2 flex flex-1 items-center justify-center rounded-xl border border-dashed border-white/15 text-[13px] text-mute">
                  <EyeOff size={15} className="mr-1.5" />
                  Hidden from you
                </span>
              ) : (
                <span className="mt-2 text-[15px] leading-snug font-bold">{option.text}</span>
              )}
              {iPick && <span className="mt-auto hidden pt-2 text-[12px] text-mute sm:block">Press {i + 1}</span>}
            </button>
          ))}
        </div>
        <div className="mt-4">
          <TimeBar game={game} now={now} total={PICK_MS} tone={tone.ring} />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- the rest of the table

function Audience({ w, room, game, now, turn, label }: StageProps & { turn: Turn; label: string }) {
  const seats = seated(room, game)
  const i = seats.indexOf(turn.pid)
  const upNext = seats.length > 1 ? seats[(i + 1) % seats.length] : null
  const others = seats.filter((p) => p !== turn.pid)
  if (!others.length) return null
  return (
    <div className={cx(panel, 'px-2.5 py-2.5')} aria-label={label}>
      <div className="no-scrollbar -mt-9 flex gap-2.5 overflow-x-auto pt-9">
        {others.map((pid) => {
          const p = w.players[pid]
          if (!p) return null
          const isMe = pid === w.meId
          const tag = room.mode === 'hotseat' && pid === turn.picker ? 'Challenger' : pid === upNext && room.mode !== 'hotseat' ? 'Up next' : null
          return (
            <button
              key={pid}
              onClick={() => setUi({ profile: pid })}
              className={cx(
                'relative flex min-w-[172px] flex-1 items-center gap-2.5 rounded-xl border bg-[#101a33]/90 px-2.5 py-2 text-left whitespace-nowrap',
                isMe ? 'border-gold/70' : 'border-white/10',
              )}
            >
              <span className="relative shrink-0">
                <ReactionBubble reaction={lastReaction(room, pid)} now={now} />
                <Avatar size={36} />
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[13.500px] font-extrabold">{isMe ? 'You' : p.name}</span>
                <span className={cx('block text-[11.500px] font-bold', tag ? 'text-[#8fb6ff]' : 'text-mute')}>{tag ?? 'Watching'}</span>
              </span>
              <span className="tabular text-[16px] font-black">
                {room.mode === 'tower' ? (
                  <span className="text-[13px] font-bold text-soft">{Math.round((game.scores[pid] ?? 0) / 100)} right</span>
                ) : (
                  (game.scores[pid] ?? 0)
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** right-hand column for Spotlight and Hot Seat: who is up, who is next */
export function TurnQueue({ w, room, game }: { w: World; room: Room; game: Game }) {
  const turn = game.turns?.[game.round]
  const seats = seated(room, game)
  if (!turn) return null
  const i = Math.max(0, seats.indexOf(turn.pid))
  const rotation = [...seats.slice(i), ...seats.slice(0, i)]
  return (
    <div className={cx(panel, 'scroll-slim min-h-0 flex-1 overflow-y-auto p-3.5')}>
      <h3 className="text-[16px] font-extrabold">Turn order</h3>
      <div className="mt-2 space-y-1">
        {rotation.map((pid, k) => {
          const p = w.players[pid]
          if (!p) return null
          const taken = turnsTaken(game, pid)
          return (
            <div key={pid} className={cx('flex items-center gap-2.5 rounded-xl px-2 py-1.5', k === 0 && 'bg-white/10')}>
              <Avatar size={30} ring={k === 0 ? toneOf(room).ring : undefined} />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[13.500px] font-extrabold">{pid === w.meId ? 'You' : p.name}</span>
                <span className={cx('block text-[11.500px] font-bold', k === 0 ? toneOf(room).text : 'text-mute')}>
                  {k === 0 ? 'On stage now' : k === 1 ? 'Up next' : `In ${k} turns`}
                </span>
              </span>
              <span className="tabular text-[12.500px] text-soft">
                {Math.min(taken, room.rounds)}/{room.rounds}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Tower Climb

const BAND_COLOR = ['#32d583', '#fbbf3b', '#fd7b3a', '#f0566a', '#b58cff']

function Lives({ lives, lost, gained }: { lives: number; lost?: boolean; gained?: boolean }) {
  const slots = Math.max(3, lives + (lost ? 1 : 0))
  return (
    <span className={cx('flex items-center gap-1', lost && 'animate-shake')} title={`${lives} team ${lives === 1 ? 'life' : 'lives'} left`}>
      {Array.from({ length: Math.min(TOWER_MAX_LIVES, slots) }, (_, i) => (
        <Heart
          key={i}
          size={22}
          strokeWidth={2.4}
          className={cx(i < lives ? 'text-[#ff5d73]' : 'text-white/20', gained && i === lives - 1 && 'animate-pop')}
          fill={i < lives ? 'currentColor' : 'none'}
        />
      ))}
    </span>
  )
}

function TowerHeader({ w, room, game, now, playing, turn }: StageProps & { turn: Turn }) {
  const top = room.rounds
  const floor = game.floor ?? 0
  const reveal = game.phase === 'reveal'
  const secsLeft = Math.max(0, Math.ceil((game.end - now) / 1000))
  const band = towerBand(turn.floor ?? floor + 1, top)
  const mine = playing && turn.pid === w.meId && !reveal && !game.answers[game.round]?.[turn.pid]
  const urgent = !reveal && secsLeft <= 3
  const lastTick = useRef(0)
  useEffect(() => {
    if (mine && urgent && secsLeft > 0 && lastTick.current !== secsLeft) {
      lastTick.current = secsLeft
      sfx('tick')
    }
  }, [mine, urgent, secsLeft])
  const nextCheck = Math.ceil((floor + 1) / CHECKPOINT_EVERY) * CHECKPOINT_EVERY

  return (
    <div className={cx(panel, 'px-3.5 py-2.5 sm:px-6 sm:py-3')}>
      <div className="flex items-center gap-3 sm:gap-5">
        <Castle size={26} className="hidden shrink-0 text-[#9ad4ff] sm:block" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2.5 text-[17px] leading-tight font-black sm:text-[20px]">
            Floor {Math.min(top, turn.floor ?? floor + 1)} <span className="font-bold text-soft">/ {top}</span>
            <span className="rounded-md px-1.5 py-0.5 text-[11.500px] font-black tracking-wide uppercase" style={{ color: BAND_COLOR[band], background: `${BAND_COLOR[band]}22` }}>
              {BAND_NAMES[band]}
            </span>
          </div>
          <div className="mt-0.5 hidden text-[12.500px] text-mute sm:block">
            {isCheckpoint(nextCheck, top) ? `Checkpoint on floor ${nextCheck}: the team earns a life` : 'The top floor is a boss sentence'}
          </div>
        </div>
        <Lives lives={game.lives ?? 0} lost={reveal && turn.passed === false} gained={reveal && turn.gained} />
        <div className="hidden h-9 w-px bg-white/10 sm:block" />
        <div className={cx('tabular flex w-[70px] items-center justify-end gap-2 text-[24px] font-black sm:w-[92px] sm:text-[30px]', urgent ? 'text-rose' : 'text-[#f9b550]')}>
          <Timer size={26} strokeWidth={2.4} className={cx('text-white', urgent && 'animate-pulse')} />
          {reveal ? <span className="text-[15px] font-extrabold text-soft sm:text-[17px]">Next</span> : `${secsLeft}s`}
        </div>
      </div>
      {/* phones have no room for the tower itself, so the climb is a strip */}
      <div className="mt-2.5 flex gap-[3px] desk:hidden">
        {Array.from({ length: top }, (_, i) => (
          <span
            key={i}
            className={cx('h-1.5 min-w-0 flex-1 rounded-full', i < floor ? 'bg-mint' : i === floor ? 'bg-white' : isCheckpoint(i + 1, top) ? 'bg-[#5b7fd6]' : 'bg-[#33496f]')}
          />
        ))}
      </div>
    </div>
  )
}

function TowerStage(props: StageProps & { turn: Turn }) {
  const { w, room, game, now, playing, turn } = props
  const actor = w.players[turn.pid]
  const reveal = game.phase === 'reveal'
  const onStage = playing && turn.pid === w.meId
  const lives = game.lives ?? 0
  const top = room.rounds

  return (
    <>
      <TowerHeader {...props} />
      {turn.kind === 'listen' ? (
        <SpotStage key={game.round} {...props} />
      ) : (
        <>
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#04060d]/90 px-4 py-3">
            <div className="relative flex items-center gap-3.5">
              <button onClick={() => setUi({ profile: turn.pid })} className="relative shrink-0">
                <ReactionBubble reaction={lastReaction(room, turn.pid)} now={now} />
                <span className="spot-halo" style={{ ['--beam' as string]: TONE.tower.beam }} />
                <Avatar size={58} ring={TONE.tower.ring} className="relative" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="text-[11.500px] font-black tracking-[0.16em] text-[#9ad4ff] uppercase">Climbing for the team</div>
                <div className="truncate text-[20px] leading-tight font-black sm:text-[23px]">
                  {onStage ? "It's on you" : (actor?.name ?? 'Player')} <span className="tabular text-[14px] font-bold text-gold">{actor?.rating}</span>
                </div>
                <div className="text-[13px] text-soft">
                  {lives === 1 ? 'Last life. One wrong answer ends the climb.' : 'Right: everyone goes up a floor. Wrong: the team loses a life.'}
                </div>
              </div>
            </div>
          </div>
          <VocabStage key={game.round} {...props} question={turn.vq} solo={turn.pid} secs={turn.secs} />
        </>
      )}
      {reveal && !turn.void && (
        <div
          className={cx(
            'animate-pop flex items-center justify-center gap-2.5 rounded-2xl border px-4 py-3 text-center text-[17px] font-black',
            turn.passed ? 'border-[#1f6b4c] bg-[#0d2b24]/95 text-[#5ee0a6]' : 'border-[#7a2c3c] bg-[#30141c]/95 text-[#ff8a9c]',
          )}
        >
          {turn.passed ? (
            <>
              {(game.floor ?? 0) >= top ? 'The team reached the top!' : `Up to floor ${(game.floor ?? 0) + 1}`}
              {turn.gained && (
                <span className="flex items-center gap-1.5 rounded-full bg-black/25 px-2.5 py-1 text-[13px]">
                  <Flag size={14} />
                  Checkpoint: +1 life
                </span>
              )}
            </>
          ) : lives <= 0 ? (
            'No lives left. The climb is over.'
          ) : (
            `A life lost. ${lives} left.`
          )}
        </div>
      )}
      <Audience {...props} label="The team" />
    </>
  )
}

/** right-hand column: the tower itself, floor by floor */
export function TowerColumn({ w, room, game }: { w: World; room: Room; game: Game }) {
  const top = room.rounds
  const floor = game.floor ?? 0
  const turn = game.turns?.[game.round]
  return (
    <div className={cx(panel, 'flex min-h-0 flex-1 flex-col p-3')}>
      <div className="flex items-center justify-between px-1 pb-2">
        <h3 className="text-[16px] font-extrabold">The tower</h3>
        <Lives lives={game.lives ?? 0} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col-reverse gap-[3px]">
        {Array.from({ length: top }, (_, i) => {
          const n = i + 1
          const band = towerBand(n, top)
          const cleared = n <= floor
          const current = n === floor + 1
          const check = isCheckpoint(n, top)
          return (
            <div
              key={n}
              className={cx(
                'relative flex min-h-[18px] flex-1 items-center gap-2 overflow-hidden rounded-md border pr-2 pl-3 text-[12px] font-bold',
                current ? 'border-white/70 bg-white/15 text-white' : cleared ? 'border-transparent bg-[#12382c] text-[#7fe3b6]' : 'border-transparent bg-white/[0.045] text-mute',
              )}
            >
              <span className="absolute inset-y-0 left-0 w-1" style={{ background: BAND_COLOR[band], opacity: cleared || current ? 1 : 0.45 }} />
              <span className="tabular w-5">{n}</span>
              {n === top ? (
                <span className="flex items-center gap-1 text-[#c9a8ff]">
                  <Crown size={12} fill="currentColor" />
                  Boss
                </span>
              ) : check ? (
                <span className={cx('flex items-center gap-1', cleared ? 'text-[#7fe3b6]' : 'text-[#8fb6ff]')}>
                  <Flag size={11} />
                  +1 life
                </span>
              ) : null}
              <span className="ml-auto flex items-center gap-1.5">
                {current && turn && <span className="max-w-[92px] truncate">{nameOf(w, turn.pid)}</span>}
                {current && <Avatar size={16} />}
                {cleared && <Check size={13} strokeWidth={3.5} />}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- entry point

/** the centre column for every turn-based game */
export function PartyStage(props: StageProps) {
  const { room, game } = props
  const turn = game.turns?.[game.round]
  if (!turn) return null
  if (room.mode === 'tower') return <TowerStage {...props} turn={turn} />
  return (
    <>
      <TurnHeader {...props} />
      {game.phase === 'pick' ? <PickStage key={`pick-${game.round}`} {...props} turn={turn} /> : <SpotStage key={game.round} {...props} turn={turn} />}
      <Audience {...props} turn={turn} label={room.mode === 'hotseat' ? 'At the table' : 'In the audience'} />
    </>
  )
}
