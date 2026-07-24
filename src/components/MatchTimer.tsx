import { formatClock } from '../lib/utils'
import { useNow } from '../hooks/useEventData'

interface Props {
  startedAt: string
  durationSeconds: number
  enabled: boolean
  large?: boolean
  /** When set, freeze the countdown at this timestamp (e.g. event closed_at). */
  pausedAt?: string | null
}

export function MatchTimer({
  startedAt,
  durationSeconds,
  enabled,
  large,
  pausedAt,
}: Props) {
  const nowLive = useNow()
  if (!enabled) return null

  const frozen = Boolean(pausedAt)
  const referenceMs = frozen ? new Date(pausedAt!).getTime() : nowLive
  const elapsed = Math.floor((referenceMs - new Date(startedAt).getTime()) / 1000)
  const remaining = durationSeconds - elapsed
  const overtime = remaining < 0
  const display = Math.abs(remaining)

  return (
    <div
      className={`font-display tabular-nums ${
        large ? 'text-5xl sm:text-6xl' : 'text-3xl'
      } ${overtime ? 'text-danger' : frozen ? 'text-amber' : 'text-live'}`}
    >
      {frozen && (
        <span className="mr-2 align-middle text-xs uppercase tracking-[0.15em] text-muted">
          Paused
        </span>
      )}
      {overtime ? '+' : ''}
      {formatClock(display)}
    </div>
  )
}

interface CountdownProps {
  endsAt: string | null
  label?: string
  paused?: boolean
}

export function EventCountdown({ endsAt, label = 'Ends in', paused }: CountdownProps) {
  const now = useNow()
  if (!endsAt) return null

  if (paused) {
    return (
      <div className="text-center">
        <div className="text-xs uppercase tracking-[0.2em] text-muted">{label}</div>
        <div className="font-display text-4xl text-amber">Paused</div>
      </div>
    )
  }

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
