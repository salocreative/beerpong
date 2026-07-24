import type { Team } from '../lib/types'
import { queueTeams } from '../lib/utils'

interface Props {
  teams: Team[]
  onSkip?: (team: Team) => void
  onWithdraw?: (team: Team) => void
  busy?: boolean
}

export function QueueList({ teams, onSkip, onWithdraw, busy }: Props) {
  const queue = queueTeams(teams)
  const admin = Boolean(onSkip || onWithdraw)

  if (queue.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-panel/50 px-4 py-6 text-center text-muted">
        Queue empty
      </div>
    )
  }

  return (
    <ol className="space-y-2">
      {queue.map((team, i) => (
        <li
          key={team.id}
          className={`flex flex-wrap items-center gap-3 rounded-xl border px-3 py-3 ${
            i === 0
              ? 'border-live/50 bg-live/10'
              : 'border-line bg-panel/70'
          }`}
        >
          <span className="font-display text-xl text-amber w-8">{i + 1}</span>
          {team.photo_url ? (
            <img
              src={team.photo_url}
              alt=""
              className="h-9 w-9 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-panel-2 text-sm text-amber">
              {team.name.charAt(0)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{team.name}</div>
            {i === 0 && (
              <div className="text-xs uppercase tracking-wider text-live">Next up</div>
            )}
          </div>
          {admin && (
            <div className="flex w-full gap-2 sm:w-auto">
              {onSkip && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onSkip(team)}
                  className="tap-target flex-1 rounded-lg border border-line px-3 py-2 text-sm sm:flex-none"
                  title="Can't find them — send to back of queue"
                >
                  Skip
                </button>
              )}
              {onWithdraw && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onWithdraw(team)}
                  className="tap-target flex-1 rounded-lg border border-danger/40 px-3 py-2 text-sm text-danger sm:flex-none"
                >
                  Leave
                </button>
              )}
            </div>
          )}
        </li>
      ))}
    </ol>
  )
}
