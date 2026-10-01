import { Check, CircleCheck, CircleX, CornerDownLeft, Crown, RotateCcw, TriangleAlert, Volume2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { isUnlocked, sfx, speak, stopSpeaking, whenUnlocked } from '../audio/audio'
import { MAX_REPLAYS, REPLAY_COST, TTS_RATE } from '../game/config'
import { listeningQ, vocabQ } from '../game/questions'
import { diffWords, verdict } from '../game/scoring'
import type { Answer, Game, Plan, Player, Reaction, Room, World } from '../game/types'
import { setUi } from '../lib/ui'
import { submitAnswer, takeReplay } from '../sim/actions'
import { typedChars } from '../sim/rooms'
import { Avatar } from '../ui/Avatar'
import { cx } from '../ui/bits'

const LETTERS = ['A', 'B', 'C', 'D']

export interface StageProps {
  w: World
  room: Room
  game: Game
  now: number
  /** the human holds a seat in this game */
  playing: boolean
}

// ---------------------------------------------------------------- shared

export function ReactionBubble({ reaction, now }: { reaction?: Reaction; now: number }) {
  if (!reaction || now - reaction.at > 3200) return null
  return (
    <span
      key={reaction.id}
      className="animate-bubble pointer-events-none absolute bottom-full left-0 z-20 mb-1.5 rounded-xl rounded-bl-sm bg-white px-2.5 py-1 text-[13px] font-extrabold whitespace-nowrap text-[#14203f] shadow-lg"
    >
      {reaction.text}
    </span>
  )
}

export const lastReaction = (room: Room, pid: string) => {
  for (let i = room.reactions.length - 1; i >= 0; i--) if (room.reactions[i].pid === pid) return room.reactions[i]
  return undefined
}

function Verdict({ acc, pts, compact }: { acc: number; pts: number; compact?: boolean }) {
  const v = verdict(acc)
  const Icon = v.tone === 'good' ? CircleCheck : v.tone === 'warn' ? TriangleAlert : CircleX
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.500px] font-extrabold',
        v.tone === 'good' && 'border-[#1f6b4c] bg-[#0d2b24] text-[#5ee0a6]',
        v.tone === 'warn' && 'border-[#7a5a1c] bg-[#2e2512] text-[#fbc94b]',
        v.tone === 'bad' && 'border-[#7a2c3c] bg-[#30141c] text-[#ff8a9c]',
      )}
    >
      <Icon size={14} className="shrink-0" />
      <span className={cx(compact && 'hidden desk:inline')}>{v.label}</span>
      <span className="tabular opacity-90">+{pts}</span>
    </span>
  )
}

/** what a player typed, with the words they got wrong marked */
export function TypedDiff({ target, typed, dark }: { target: string; typed: string; dark?: boolean }) {
  if (!typed.trim()) return <span className={dark ? 'text-mute' : 'text-[#8a94ad]'}>No answer</span>
  const { ops } = diffWords(target, typed)
  return (
    <>
      {ops.map((o, i) => {
        if (o.op === 'ok') return <span key={i}>{o.word} </span>
        if (o.op === 'missing')
          return (
            <span key={i} className="font-extrabold text-[#e5484d]">
              ___{' '}
            </span>
          )
        return (
          <span key={i} className="font-extrabold text-[#e5484d] underline decoration-2 underline-offset-2">
            {o.op === 'wrong' ? o.typed : o.word}{' '}
          </span>
        )
      })}
    </>
  )
}

/** what others see of a bot's answer box: dots instead of letters, plus whether keys are being hit */
function maskTyping(plan: Plan | undefined, now: number) {
  if (!plan || now < plan.startAt) return { masked: '', typing: false }
  const text = String(plan.v)
  if (!plan.segs) {
    const progress = Math.min(1, (now - plan.startAt) / Math.max(1, plan.at - plan.startAt))
    return { masked: text.slice(0, Math.floor(text.length * progress)).replace(/\S/g, '\u2022'), typing: true }
  }
  const chars = Math.min(text.length, typedChars(plan.segs, now))
  return {
    masked: text.slice(0, chars).replace(/\S/g, '\u2022'),
    typing: plan.segs.some((seg) => now >= seg.t0 && now < seg.t1),
  }
}

// ---------------------------------------------------------------- vocabulary

export function VocabStage({ w, room, game, now, playing }: StageProps) {
  const q = vocabQ(room, game.round)
  const answers = game.answers[game.round] ?? {}
  const mine = w.meId ? answers[w.meId] : undefined
  const reveal = game.phase === 'reveal'
  const canAnswer = playing && !reveal && !mine
  const roomId = room.id

  useEffect(() => {
    if (!canAnswer) return
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toUpperCase()
      const idx = LETTERS.indexOf(k) >= 0 ? LETTERS.indexOf(k) : ['1', '2', '3', '4'].indexOf(k)
      if (idx >= 0 && idx < q.choices.length) submitAnswer(roomId, idx)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canAnswer, roomId, q.choices.length])

  const total = room.secs * 1000
  const left = reveal ? 0 : Math.max(0, Math.min(1, (game.end - now) / total))

  return (
    <div className="rounded-3xl border border-white/10 bg-[#0f1830]/90 p-4 shadow-2xl backdrop-blur-md sm:p-6">
      <div className="text-center">
        <div className="text-[13px] font-extrabold tracking-[0.14em] text-[#8fb6ff] uppercase">
          {q.kind === 'en-vi' ? 'What does this word mean?' : 'Which English word is this?'}
        </div>
        <div lang={q.kind === 'en-vi' ? 'en' : 'vi'} className="mt-2 text-[38px] leading-tight font-black break-words sm:mt-3 sm:text-[52px]">
          {q.prompt}
        </div>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10 sm:mt-5">
        <div
          className={cx('h-full rounded-full', left < 0.3 ? 'bg-rose' : 'bg-gradient-to-r from-azure-2 to-[#7fd4ff]')}
          style={{ width: `${left * 100}%`, transition: 'width 120ms linear' }}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:mt-5 sm:grid-cols-2 sm:gap-3">
        {q.choices.map((choice, i) => {
          const isAnswer = i === q.answer
          const picked = mine?.v === i
          const pickers = reveal ? room.players.filter((pid) => answers[pid]?.v === i) : []
          return (
            <button
              key={i}
              disabled={!canAnswer}
              onClick={() => submitAnswer(room.id, i)}
              lang={q.kind === 'en-vi' ? 'vi' : 'en'}
              className={cx(
                'relative flex min-h-[58px] items-center gap-3 rounded-2xl border-2 px-3.5 py-2.5 text-left text-[18px] font-extrabold transition sm:min-h-[68px] sm:text-[20px]',
                reveal && isAnswer && 'border-[#2fbf7f] bg-[#11382b] text-white',
                reveal && !isAnswer && picked && 'animate-shake border-[#e5566b] bg-[#3a1721] text-white',
                reveal && !isAnswer && !picked && 'border-line bg-[#131d38] text-mute',
                !reveal && picked && 'border-azure-2 bg-[#16305f] text-white',
                !reveal && !picked && mine && 'border-line bg-[#131d38] text-mute',
                !reveal && !mine && 'border-[#2c3a63] bg-[#16213f] text-white',
                canAnswer && 'hover:border-azure-2 hover:bg-[#1b2a52] active:scale-[0.985]',
              )}
            >
              <span
                className={cx(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[15px] font-black',
                  reveal && isAnswer ? 'bg-[#2fbf7f] text-[#06281b]' : reveal && picked ? 'bg-[#e5566b] text-white' : 'bg-white/10 text-soft',
                )}
              >
                {reveal && isAnswer ? <Check size={18} strokeWidth={4} /> : reveal && picked ? <X size={18} strokeWidth={4} /> : LETTERS[i]}
              </span>
              <span className="min-w-0 flex-1 break-words">{choice}</span>
              {pickers.length > 0 && (
                <span className="flex -space-x-1.5">
                  {pickers.map((pid) => (
                    <Avatar key={pid} size={24} ring={isAnswer ? '#11382b' : '#131d38'} />
                  ))}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex h-6 items-center justify-center text-[14px] text-soft sm:mt-4">
        {reveal ? (
          playing && mine ? (
            mine.ok ? (
              <span className="animate-pop font-extrabold text-mint">Correct! +{mine.pts} points</span>
            ) : (
              <span className="animate-pop font-extrabold text-[#ff8a9c]">
                {mine.v == null ? 'Out of time' : 'Not quite'} · {q.en} = {q.vi}
              </span>
            )
          ) : (
            <span>
              {q.en} = <span lang="vi">{q.vi}</span>
            </span>
          )
        ) : mine ? (
          <span className="flex items-center gap-2">
            Answer locked in. Waiting for the others
            <span className="typing-dots">
              <span />
              <span />
              <span />
            </span>
          </span>
        ) : playing ? (
          <span className="hidden text-mute sm:inline">Tip: press 1 to 4 on your keyboard</span>
        ) : (
          <span className="text-mute">You are watching this game</span>
        )}
      </div>
    </div>
  )
}

export function VocabPlayerCard({ w, room, game, now, p, rank }: StageProps & { p: Player; rank: number }) {
  const isMe = p.id === w.meId
  const ans = game.answers[game.round]?.[p.id]
  const reveal = game.phase === 'reveal'
  return (
    <div
      className={cx(
        'relative flex min-w-0 flex-1 items-center gap-2 rounded-2xl border-2 bg-[#0f1830]/90 p-2 backdrop-blur-md sm:gap-3 sm:p-3',
        isMe ? 'border-gold/80' : 'border-[#263a70]',
        reveal && ans?.ok && 'shadow-[0_0_0_2px_rgba(47,191,127,0.35)]',
      )}
    >
      <button onClick={() => setUi({ profile: p.id })} className="relative shrink-0">
        <ReactionBubble reaction={lastReaction(room, p.id)} now={now} />
        <Avatar size={46} ring={isMe ? '#fbbf3b' : '#3d59a6'} className="!h-9 !w-9 sm:!h-[46px] sm:!w-[46px]" />
        {rank === 1 && game.scores[p.id] > 0 && (
          <Crown size={17} className="absolute -top-2.5 -right-1.5 rotate-[18deg] text-gold" fill="currentColor" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="truncate text-[13.500px] font-extrabold sm:text-[14.500px]">{isMe ? 'You' : p.name}</span>
          <span className="tabular hidden text-[12px] text-gold sm:inline">{p.rating}</span>
        </div>
        <div className="mt-0.5 flex h-5 items-center text-[12.500px] whitespace-nowrap">
          {reveal && ans ? (
            ans.ok ? (
              <span className="animate-pop tabular font-extrabold text-mint">+{ans.pts}</span>
            ) : (
              <span className="animate-pop font-extrabold text-[#ff8a9c]">{ans.v == null ? 'No answer' : `Picked ${LETTERS[ans.v as number]}`}</span>
            )
          ) : ans ? (
            <span className="flex items-center gap-1 font-bold text-[#8fb6ff]">
              <Check size={14} strokeWidth={3.5} />
              Locked in
            </span>
          ) : (
            <span className="typing-dots text-mute">
              <span />
              <span />
              <span />
            </span>
          )}
        </div>
      </div>
      <div className="tabular text-right text-[18px] leading-none font-black sm:text-[22px]">{game.scores[p.id] ?? 0}</div>
    </div>
  )
}

// ---------------------------------------------------------------- listening

function Wave({ on, flip }: { on: boolean; flip?: boolean }) {
  const heights = [10, 18, 30, 22, 36, 16, 26, 12]
  return (
    <div className={cx('wave flex h-10 items-center gap-[5px]', on && 'on', flip && 'flex-row-reverse')}>
      {heights.map((h, i) => (
        <span key={i} style={{ ['--h' as string]: `${h}px`, animationDelay: `${i * 0.09}s` }} />
      ))}
    </div>
  )
}

export function ListeningStage({ w, room, game, playing }: StageProps) {
  const q = listeningQ(room, game.round)
  const reveal = game.phase === 'reveal'
  const mine = w.meId ? game.answers[game.round]?.[w.meId] : undefined
  const [speaking, setSpeaking] = useState(false)
  const [blocked, setBlocked] = useState(!isUnlocked())
  const rate = TTS_RATE[room.difficulty]
  const round = game.round

  // read the sentence once when the round opens
  useEffect(() => {
    if (reveal) return
    let cancelled = false
    const handlers = { onstart: () => !cancelled && setSpeaking(true), onend: () => !cancelled && setSpeaking(false) }
    whenUnlocked(() => {
      if (cancelled) return
      setBlocked(false)
      speak(q.text, rate, handlers)
    })
    return () => {
      cancelled = true
      stopSpeaking()
      setSpeaking(false)
    }
  }, [round, reveal, q.text, rate])

  const replaysLeft = MAX_REPLAYS - game.replays
  const replay = () => {
    if (playing) {
      if (mine || !takeReplay(room.id)) return
    }
    speak(q.text, rate, { onstart: () => setSpeaking(true), onend: () => setSpeaking(false) })
  }

  const replayDisabled = playing && (replaysLeft <= 0 || !!mine)
  const hint = blocked ? 'Tap anywhere to turn the sound on' : playing ? 'Listen carefully and type what you hear' : 'Listen along with the players'
  const orb = (size: string, icon: number) => (
    <button
      onClick={replay}
      disabled={reveal || replayDisabled}
      className={cx(
        'relative flex shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#2f7bff] to-[#1846c4] shadow-[0_0_0_4px_rgba(127,180,255,0.35),0_0_40px_rgba(79,141,255,0.55)]',
        size,
      )}
      aria-label="Play the sentence"
    >
      {speaking && <span className="animate-pulse-ring absolute inset-0 rounded-full border-4 border-[#9d7bff]" />}
      <Volume2 size={icon} strokeWidth={2.4} />
    </button>
  )
  const replayButton = !reveal && (
    <button
      onClick={replay}
      disabled={replayDisabled}
      className="flex shrink-0 items-center gap-2 rounded-full border border-[#3d6fd6] bg-[#12244d] px-3 py-1.5 text-[13px] font-extrabold text-[#9cc2ff] transition hover:bg-[#183068] disabled:opacity-40 sm:px-4 sm:py-2 sm:text-[14px]"
    >
      <RotateCcw size={16} strokeWidth={2.6} />
      Replay
      {playing && (
        <span className="text-[#6f8fc9]">
          -{REPLAY_COST} pts · {Math.max(0, replaysLeft)} left
        </span>
      )}
    </button>
  )
  const answer = (
    <div className="animate-rise min-w-0">
      <div className="text-[12px] font-extrabold tracking-[0.14em] text-[#8fb6ff] uppercase sm:text-[13px]">The sentence was</div>
      <div className="mt-1 text-[19px] leading-snug font-black sm:mt-1.5 sm:text-[28px]">{q.text}</div>
    </div>
  )

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0f1830]/75 shadow-2xl backdrop-blur-md">
      {/* phones: one compact strip so the answer box stays above the keyboard */}
      <div className="flex items-center gap-3.5 px-3.5 py-3 sm:hidden">
        {orb('h-[58px] w-[58px]', 28)}
        {reveal ? (
          answer
        ) : (
          <div className="min-w-0 flex-1">
            <div className="text-[14.500px] leading-snug font-extrabold">{hint}</div>
            <div className="mt-2">{replayButton}</div>
          </div>
        )}
      </div>

      <div className="hidden flex-col items-center px-6 py-6 sm:flex">
        <div className="absolute top-4 right-4">{replayButton}</div>
        <div className="mt-4 flex items-center gap-6">
          <Wave on={speaking} flip />
          {orb('h-[116px] w-[116px]', 46)}
          <Wave on={speaking} />
        </div>
        {reveal ? (
          <div className="mt-4 w-full max-w-[720px] text-center">{answer}</div>
        ) : (
          <div className="mt-4 text-center text-[20px] font-extrabold">{hint}</div>
        )}
      </div>
    </div>
  )
}

export function ListeningPlayerCard({
  w,
  room,
  game,
  now,
  playing,
  p,
  rank,
}: StageProps & { p: Player; rank: number }) {
  const isMe = p.id === w.meId
  const q = listeningQ(room, game.round)
  const reveal = game.phase === 'reveal'
  const ans: Answer | undefined = game.answers[game.round]?.[p.id]
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const editable = isMe && playing && !reveal && !ans
  const roomId = room.id

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

  const live = maskTyping(game.plans[p.id], now)
  const masked = !isMe && !reveal ? (ans ? String(ans.v ?? '').replace(/\S/g, '\u2022') : live.masked) : ''
  const count = isMe ? (ans ? String(ans.v ?? '').length : text.length) : ans ? String(ans.v ?? '').length : masked.length
  const accent = isMe ? 'border-gold/80' : 'border-[#2b4fa8]'

  return (
    <div className={cx('relative flex min-w-0 flex-col items-center rounded-2xl border-2 bg-[#0f1830]/90 p-3 backdrop-blur-md', accent, isMe && 'col-span-full desk:col-span-1')}>
      <div className={cx('flex w-full items-center gap-3', !isMe && 'flex-col gap-1 desk:flex-col', isMe && 'desk:flex-col desk:gap-1')}>
        <button onClick={() => setUi({ profile: p.id })} className="relative shrink-0">
          <ReactionBubble reaction={lastReaction(room, p.id)} now={now} />
          <Avatar size={58} ring={isMe ? '#fbbf3b' : '#3d59a6'} className={cx(!isMe && '!h-11 !w-11 desk:!h-[58px] desk:!w-[58px]')} />
          {rank === 1 && game.scores[p.id] > 0 && (
            <Crown size={19} className="absolute -top-3 -right-2 rotate-[18deg] text-gold" fill="currentColor" />
          )}
        </button>
        <div className={cx('flex min-w-0 items-baseline gap-1.5', isMe ? 'flex-1 desk:flex-none' : 'max-w-full')}>
          <span className={cx('truncate font-extrabold', isMe ? 'text-[15px]' : 'text-[13.500px] desk:text-[15px]')}>{isMe ? 'You' : p.name}</span>
          <span className={cx('tabular text-[13px] text-gold', !isMe && 'hidden desk:inline')}>{p.rating}</span>
        </div>
        <div className={cx('tabular text-[20px] font-black desk:hidden', !isMe && 'hidden')}>{game.scores[p.id] ?? 0}</div>
      </div>

      <div
        className={cx(
          'mt-2 w-full rounded-xl border-2 bg-[#f6f8fb] text-[#14203f]',
          isMe ? 'min-h-[76px] border-[#f1c14a]' : 'min-h-[52px] border-[#3b63c9] desk:min-h-[76px]',
        )}
      >
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
            className="block h-[72px] w-full resize-none bg-transparent px-3 py-2 text-[17px] leading-snug font-bold outline-none placeholder:font-semibold placeholder:text-[#9aa4bd]"
          />
        ) : (
          <div className={cx('px-3 py-2 leading-snug font-bold break-words', isMe ? 'text-[17px]' : 'text-[14px] desk:text-[16px]')}>
            {reveal ? (
              <TypedDiff target={q.text} typed={String(ans?.v ?? '')} />
            ) : isMe ? (
              String(ans?.v ?? '') || <span className="text-[#9aa4bd]">Watching</span>
            ) : (
              <span className="tracking-[0.08em] text-[#51607f]">
                {masked}
                {!ans && masked && <span className="animate-pulse">|</span>}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="mt-1.5 flex h-6 w-full items-center justify-between text-[12.500px] text-mute">
        {reveal && ans ? (
          <Verdict acc={ans.acc} pts={ans.pts} compact={!isMe} />
        ) : ans ? (
          <span className="flex items-center gap-1 font-bold text-[#8fb6ff]">
            <Check size={14} strokeWidth={3.5} />
            Submitted
          </span>
        ) : isMe ? (
          <span />
        ) : live.typing ? (
          <span>Typing</span>
        ) : masked ? (
          <span>Thinking</span>
        ) : (
          <span>Listening</span>
        )}
        {!reveal && <span className={cx('tabular', !isMe && 'hidden desk:inline')}>{count}/100</span>}
      </div>

      {isMe && playing && (
        <div className="mt-1 flex w-full items-center gap-3 desk:flex-col desk:gap-1.5">
          <button
            onClick={submit}
            disabled={!editable || !text.trim()}
            className="h-11 flex-1 rounded-xl bg-gradient-to-b from-[#ffd53a] to-[#ff9a26] text-[16px] font-black text-[#3a2203] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] transition active:scale-[0.98] disabled:opacity-45 desk:w-full desk:flex-none"
          >
            {ans ? 'Submitted' : 'Submit'}
          </button>
          <span className="hidden items-center gap-1.5 text-[13px] text-soft sm:flex">
            <CornerDownLeft size={14} />
            Enter
          </span>
        </div>
      )}
    </div>
  )
}
