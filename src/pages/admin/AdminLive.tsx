import { useState } from 'react'
import type { FormEvent } from 'react'
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
  const [busyQueue, setBusyQueue] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showLate, setShowLate] = useState(false)
  const [lateName, setLateName] = useState('')
  const [lateMembers, setLateMembers] = useState(['', '', ''])

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

  async function skipTeam(team: Team) {
    if (!confirm(`Skip ${team.name}? They go to the back of the queue.`)) return
    setBusyQueue(true)
    setError(null)
    const { error: rpcError } = await supabase.rpc('skip_queue_team', {
      p_team_id: team.id,
    })
    setBusyQueue(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    await onChanged()
  }

  async function withdrawTeam(team: Team) {
    if (!confirm(`Mark ${team.name} as left? They leave the rotation.`)) return
    setBusyQueue(true)
    setError(null)
    const { error: rpcError } = await supabase.rpc('withdraw_team', {
      p_team_id: team.id,
    })
    setBusyQueue(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    await onChanged()
  }

  async function addLateTeam(e: FormEvent) {
    e.preventDefault()
    const clean = lateMembers.map((m) => m.trim()).filter(Boolean)
    if (!lateName.trim() || clean.length < 2) {
      setError('Late team needs a name + 2–3 members.')
      return
    }
    setBusyQueue(true)
    setError(null)
    const { error: rpcError } = await supabase.rpc('add_late_team', {
      p_event_id: event.id,
      p_name: lateName.trim(),
      p_members: clean,
    })
    setBusyQueue(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    setLateName('')
    setLateMembers(['', '', ''])
    setShowLate(false)
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
              <div className="mb-4 flex items-center justify-between gap-2">
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
                <div className="space-y-3">
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
                  {event.phase === 'live' && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busyQueue}
                        onClick={() => void withdrawTeam(teamA)}
                        className="tap-target rounded-lg border border-danger/40 px-3 py-2 text-sm text-danger"
                      >
                        {teamA.name} leaves
                      </button>
                      <button
                        type="button"
                        disabled={busyQueue}
                        onClick={() => void withdrawTeam(teamB)}
                        className="tap-target rounded-lg border border-danger/40 px-3 py-2 text-sm text-danger"
                      >
                        {teamB.name} leaves
                      </button>
                    </div>
                  )}
                </div>
              ) : waiting ? (
                <div className="space-y-3 rounded-xl border border-dashed border-live/40 bg-live/5 p-4 text-center">
                  <TeamAvatar team={waiting} className="justify-center" />
                  <p className="text-live">Waiting for next team</p>
                  {event.phase === 'live' && (
                    <button
                      type="button"
                      disabled={busyQueue}
                      onClick={() => void withdrawTeam(waiting)}
                      className="tap-target rounded-lg border border-danger/40 px-3 py-2 text-sm text-danger"
                    >
                      {waiting.name} leaves
                    </button>
                  )}
                </div>
              ) : (
                <p className="py-6 text-center text-muted">No active match</p>
              )}
            </div>
          )
        })}
      </div>

      <aside className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-2xl text-foam">Queue</h3>
          {event.phase === 'live' && (
            <button
              type="button"
              onClick={() => setShowLate((v) => !v)}
              className="tap-target rounded-xl border border-line px-3 py-2 text-sm"
            >
              {showLate ? 'Cancel' : 'Add late team'}
            </button>
          )}
        </div>

        {showLate && (
          <form
            onSubmit={addLateTeam}
            className="space-y-2 rounded-2xl border border-amber/40 bg-panel p-3"
          >
            <p className="text-xs text-muted">Goes to the back of the queue (or fills a waiting table).</p>
            <input
              className="tap-target w-full rounded-xl border border-line bg-ink px-3 py-2"
              placeholder="Team name"
              value={lateName}
              onChange={(e) => setLateName(e.target.value)}
              required
            />
            {lateMembers.map((m, i) => (
              <input
                key={i}
                className="tap-target w-full rounded-xl border border-line bg-ink px-3 py-2"
                placeholder={`Member ${i + 1}${i < 2 ? '' : ' (optional)'}`}
                value={m}
                onChange={(e) => {
                  const next = [...lateMembers]
                  next[i] = e.target.value
                  setLateMembers(next)
                }}
                required={i < 2}
              />
            ))}
            <button
              type="submit"
              disabled={busyQueue}
              className="tap-target w-full rounded-xl bg-amber px-3 py-2 font-semibold text-ink"
            >
              Add to queue
            </button>
          </form>
        )}

        <QueueList
          teams={teams}
          busy={busyQueue || event.phase === 'ended'}
          onSkip={event.phase === 'live' ? (t) => void skipTeam(t) : undefined}
          onWithdraw={event.phase === 'live' ? (t) => void withdrawTeam(t) : undefined}
        />
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
