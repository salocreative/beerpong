import type { EventTable, Match, Team } from '../lib/types'
import { EventCountdown, MatchTimer } from '../components/MatchTimer'
import { Leaderboard } from '../components/Leaderboard'
import { QueueList } from '../components/QueueList'
import { EmptyState, LoadingState } from '../components/PageShell'
import { TeamAvatar } from '../components/TeamAvatar'
import { useEventData } from '../hooks/useEventData'
import { useResolvedEventId } from '../hooks/useResolvedEventId'
import { isSupabaseConfigured } from '../lib/supabase'

function activeMatchForTable(
  table: EventTable,
  matches: Match[],
  teams: Team[],
): { match: Match; teamA: Team; teamB: Team } | null {
  const match =
    (table.current_match_id
      ? matches.find((m) => m.id === table.current_match_id)
      : null) ??
    matches.find((m) => m.table_id === table.id && !m.ended_at) ??
    null

  if (!match) return null
  const teamA = teams.find((t) => t.id === match.team_a_id)
  const teamB = teams.find((t) => t.id === match.team_b_id)
  if (!teamA || !teamB) return null
  return { match, teamA, teamB }
}

function waitingWinner(table: EventTable, teams: Team[]): Team | null {
  return teams.find((t) => t.state === 'playing' && t.table_id === table.id) ?? null
}

export function DisplayPage() {
  const { eventId, loading: resolving } = useResolvedEventId()
  const { event, teams, tables, matches, loading, error } = useEventData(eventId)

  if (!isSupabaseConfigured()) {
    return <EmptyState message="Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env" />
  }
  if (resolving || loading) return <LoadingState />
  if (error) return <EmptyState message={error} />
  if (!event) return <EmptyState message="No event yet — open #/admin to create one." />

  const isEnded = event.phase === 'ended'

  return (
    <div className="min-h-dvh px-4 py-5 sm:px-8 sm:py-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-muted">Beer Pong</p>
          <h1 className="font-display text-5xl text-amber-hot sm:text-7xl">{event.name}</h1>
          <p className="mt-1 text-sm uppercase tracking-[0.2em] text-live">
            {event.phase === 'live' ? 'Live' : event.phase}
          </p>
        </div>
        <EventCountdown endsAt={event.ends_at} paused={event.phase === 'ended'} />
      </header>

      {isEnded ? (
        <section>
          <h2 className="mb-4 font-display text-4xl text-foam">Final standings</h2>
          <Leaderboard teams={teams} showFunStats />
        </section>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
          <section>
            <h2 className="mb-4 font-display text-3xl text-foam">Now playing</h2>
            <div className="grid gap-4 lg:grid-cols-3">
              {tables.length === 0 ? (
                <p className="text-muted col-span-full">
                  Tables appear when the tournament starts.
                </p>
              ) : (
                tables.map((table) => {
                  const active = activeMatchForTable(table, matches, teams)
                  const waiting = !active ? waitingWinner(table, teams) : null

                  return (
                    <div
                      key={table.id}
                      className="rounded-2xl border border-line bg-panel/80 p-4"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <span className="font-display text-2xl text-amber">
                          Table {table.table_number}
                        </span>
                        {active?.match.timer_enabled && (
                          <MatchTimer
                            startedAt={active.match.started_at}
                            durationSeconds={active.match.timer_duration_seconds ?? 600}
                            enabled
                            pausedAt={
                              event.phase === 'ended' ? event.closed_at : null
                            }
                          />
                        )}
                      </div>

                      {active ? (
                        <div className="space-y-4">
                          <TeamAvatar team={active.teamA} showMembers />
                          <div className="text-center font-display text-2xl text-muted">VS</div>
                          <TeamAvatar team={active.teamB} showMembers />
                        </div>
                      ) : waiting ? (
                        <div className="space-y-3 py-4 text-center">
                          <TeamAvatar team={waiting} className="justify-center" />
                          <p className="text-live">Waiting for next team</p>
                        </div>
                      ) : (
                        <p className="py-8 text-center text-muted">Open</p>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </section>

          <aside className="space-y-6">
            <div>
              <h2 className="mb-3 font-display text-3xl text-foam">Queue</h2>
              <QueueList teams={teams} />
            </div>
            <div>
              <h2 className="mb-3 font-display text-3xl text-foam">Leaderboard</h2>
              <Leaderboard teams={teams} compact showFunStats={false} />
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
