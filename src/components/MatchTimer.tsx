import { formatClock } from '../lib/utils'
import { useNow } from '../hooks/useEventData'

interface Props {
  startedAt: string
  durationSeconds: number
  enabled: boolean
  large?: boolean
}

export function MatchTimer({ startedAt, durationSeconds, enabled, large }: Props) {
  const now = useNow()
  if (!enabled) return null

  const elapsed = Math.floor((now - new Date(startedAt).getTime()) / 1000)
  const remaining = durationSeconds - elapsed
  const overtime = remaining < 0
  const display = Math.abs(remaining)

  return (
    <div
      className={`font-display tabular-nums ${
        large ? 'text-5xl sm:text-6xl' : 'text-3xl'
      } ${overtime ? 'text-danger' : 'text-live'}`}
    >
      {overtime ? '+' : ''}
      {formatClock(display)}
    </div>
  )
}

interface CountdownProps {
  endsAt: string | null
  label?: string
}

export function EventCountdown({ endsAt, label = 'Ends in' }: CountdownProps) {
  const now = useNow()
  if (!endsAt) return null

  const remaining = Math.floor((new Date(endsAt).getTime() - now) / 1000)
  if (remaining <= 0) {
    return (
      <div className="text-center">
        <div className="text-xs uppercase tracking-[0.2em] text-muted">{label}</div>
        <div className="font-display text-4xl text-danger">Time</div>
      </div>
    )
  }

  return (
    <div className="text-center">
      <div className="text-xs uppercase tracking-[0.2em] text-muted">{label}</div>
      <div className="font-display text-4xl text-amber-hot tabular-nums">
        {formatClock(remaining)}
      </div>
    </div>
  )
}
