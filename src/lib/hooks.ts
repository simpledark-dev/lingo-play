import { useEffect, useRef, useState } from 'react'

/** current time, refreshed on an interval, for countdowns and progress bars */
export function useNow(intervalMs = 100) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

// ---------------------------------------------------------------- pretend network
// There is no backend yet. These make every "server call" take as long as a real one would,
// so the loading states are in place (and felt) before the API exists.

const latency = (min: number, max: number) => min + Math.random() * (max - min)

/**
 * Wraps an action in a short request delay. Returns [pending, run]; calls made while one is in flight are ignored.
 */
export function usePending(min = 350, max = 750) {
  const [pending, setPending] = useState(false)
  const busy = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const run = (action: () => void) => {
    if (busy.current) return
    busy.current = true
    setPending(true)
    setTimeout(() => {
      busy.current = false
      action()
      if (mounted.current) setPending(false)
    }, latency(min, max))
  }
  return [pending, run] as const
}

/** true while the data for `key` is "loading": on mount and again whenever the key changes */
export function useLoading(key: string | number, min = 400, max = 800) {
  const [loaded, setLoaded] = useState<string | number | null>(null)
  useEffect(() => {
    const id = setTimeout(() => setLoaded(key), latency(min, max))
    return () => clearTimeout(id)
  }, [key, min, max])
  return loaded !== key
}
