import { useState } from 'react'
import { Leaderboard } from '../components/Leaderboard'
import { EmptyState, LoadingState, PageShell } from '../components/PageShell'
import { QueueList } from '../components/QueueList'
import { RulesContent } from '../components/RulesContent'
import { TeamAvatar } from '../components/TeamAvatar'
import { MatchTimer } from '../components/MatchTimer'
import { useEventData } from '../hooks/useEventData'
import { useResolvedEventId } from '../hooks/useResolvedEventId'
import { isSupabaseConfigured } from '../lib/supabase'
import type { Match, Team } from '../lib/types'

type Tab = 'leaderboard' | 'queue' | 'rules'

export function StatusPage() {
  const { eventId, loading: resolving } = useResolvedEventId()
  const { event, teams, tables, matches, loading, error } = useEventData(eventId)
  const [tab, setTab] = useState<Tab>('leaderboard')

  if (!isSupabaseConfigured()) {
    return <EmptyState message="Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env" />
  }
  if (resolving || loading) return <LoadingState />
  if (error) return <EmptyState message={error} />
  if (!event) return <EmptyState message="No event yet." />

  const nowPlaying = tables
    .map((table) => {
      const match =
        matches.find((m) => m.id === table.current_match_id && !m.ended_at) ??
        matches.find((m) => m.table_id === table.id && !m.ended_at)
      if (!match) {
        const waiting = teams.find((t) => t.state === 'playing' && t.table_id === table.id)
        return { table, match: null as Match | null, waiting: waiting ?? null }
      }
      return {
        table,
        match,
        waiting: null as Team | null,
        teamA: teams.find((t) => t.id === match.team_a_id),
        teamB: teams.find((t) => t.id === match.team_b_id),
      }
    })

  return (
    <PageShell title={event.name}>
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {(
          [
            ['leaderboard', 'Leaderboard'],
            ['queue', 'Queue & Now'],
            ['rules', 'Rules'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`tap-target shrink-0 rounded-full px-4 py-2 text-sm font-medium ${
              tab === id
                ? 'bg-amber text-ink'
                : 'border border-line bg-panel text-foam'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'leaderboard' && <Leaderboard teams={teams} />}

      {tab === 'queue' && (
        <div className="space-y-6">
          <section>
            <h2 className="mb-3 font-display text-2xl text-foam">Now playing</h2>
            <div className="space-y-3">
              {nowPlaying.map((row) => (
                <div
                  key={row.table.id}
                  className="rounded-2xl border border-line bg-panel/80 p-4"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-display text-xl text-amber">
                      Table {row.table.table_number}
                    </span>
                    {row.match?.timer_enabled && (
                      <MatchTimer
                        startedAt={row.match.started_at}
                        durationSeconds={row.match.timer_duration_seconds ?? 600}
                        enabled
                        pausedAt={event.phase === 'ended' ? event.closed_at : null}
                      />
                    )}
                  </div>
                  {row.match && row.teamA && row.teamB ? (
                    <div className="space-y-2">
                      <TeamAvatar team={row.teamA} size="sm" />
                      <div className="pl-12 text-xs text-muted">vs</div>
                      <TeamAvatar team={row.teamB} size="sm" />
                    </div>
                  ) : row.waiting ? (
                    <p className="text-live">
                      {row.waiting.name} waiting for next team
                    </p>
                  ) : (
                    <p className="text-muted">Open</p>
                  )}
                </div>
              ))}
              {nowPlaying.length === 0 && (
                <p className="text-muted">No tables yet.</p>
              )}
            </div>
          </section>
          <section>
            <h2 className="mb-3 font-display text-2xl text-foam">Queue</h2>
            <QueueList teams={teams} />
          </section>
        </div>
      )}

      {tab === 'rules' && <RulesContent />}
    </PageShell>
  )
}
