import { useState } from 'react'
import { MatchTimer } from '../../components/MatchTimer'
import { QueueList } from '../../components/QueueList'
import { TeamAvatar } from '../../components/TeamAvatar'
import { supabase } from '../../lib/supabase'
import type { Event, EventTable, Match, Team } from '../../lib/types'

interface Props {
  event: Event
  teams: Team[]
  tables: EventTable[]
  matches: Match[]
  onChanged: () => Promise<void>
}

export function AdminLive({ event, teams, tables, matches, onChanged }: Props) {
  const [busyMatch, setBusyMatch] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function declareWinner(matchId: string, winnerId: string, teamName: string) {
    if (!confirm(`Confirm winner: ${teamName}?`)) return
    setBusyMatch(matchId)
    setError(null)
    const { error: rpcError } = await supabase.rpc('complete_match', {
      p_match_id: matchId,
      p_winner_id: winnerId,
    })
    setBusyMatch(null)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    await onChanged()
  }

  if (event.phase !== 'live' && event.phase !== 'ended') {
    return (
      <p className="text-muted">
        Tournament isn’t live yet. Seed teams and hit Start Tournament.
      </p>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      <div className="space-y-4">
        {error && <p className="text-danger">{error}</p>}
        {tables.map((table) => {
          const match =
            matches.find((m) => m.id === table.current_match_id && !m.ended_at) ??
            matches.find((m) => m.table_id === table.id && !m.ended_at)
          const waiting = !match
            ? teams.find((t) => t.state === 'playing' && t.table_id === table.id)
            : null
          const teamA = match ? teams.find((t) => t.id === match.team_a_id) : null
          const teamB = match ? teams.find((t) => t.id === match.team_b_id) : null

          return (
            <div key={table.id} className="rounded-2xl border border-line bg-panel p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-3xl text-amber">Table {table.table_number}</h3>
                {match?.timer_enabled && (
                  <MatchTimer
                    startedAt={match.started_at}
                    durationSeconds={match.timer_duration_seconds ?? event.timer_duration_seconds}
                    enabled
                    large
                    pausedAt={event.phase === 'ended' ? event.closed_at : null}
                  />
                )}
              </div>

              {match && teamA && teamB ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <WinnerButton
                    team={teamA}
                    disabled={busyMatch === match.id || event.phase === 'ended'}
                    onClick={() => void declareWinner(match.id, teamA.id, teamA.name)}
                  />
                  <WinnerButton
                    team={teamB}
                    disabled={busyMatch === match.id || event.phase === 'ended'}
                    onClick={() => void declareWinner(match.id, teamB.id, teamB.name)}
                  />
                </div>
              ) : waiting ? (
                <div className="rounded-xl border border-dashed border-live/40 bg-live/5 p-4 text-center">
                  <TeamAvatar team={waiting} className="justify-center" />
                  <p className="mt-3 text-live">Waiting for next team</p>
                </div>
              ) : (
                <p className="py-6 text-center text-muted">No active match</p>
              )}
            </div>
          )
        })}
      </div>

      <aside>
        <h3 className="mb-3 font-display text-2xl text-foam">Queue</h3>
        <QueueList teams={teams} />
      </aside>
    </div>
  )
}

function WinnerButton({
  team,
  disabled,
  onClick,
}: {
  team: Team
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="tap-target rounded-2xl border-2 border-amber/50 bg-ink p-4 text-left transition hover:border-amber hover:bg-amber/10 disabled:opacity-50"
    >
      <TeamAvatar team={team} showMembers />
      <div className="mt-4 font-display text-2xl text-amber">Winner →</div>
    </button>
  )
}
