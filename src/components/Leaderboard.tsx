import type { Team } from '../lib/types'
import { estimatedCans, formatDuration, rankTeams } from '../lib/utils'

interface Props {
  teams: Team[]
  compact?: boolean
  showFunStats?: boolean
}

export function Leaderboard({ teams, compact = false, showFunStats = true }: Props) {
  const ranked = rankTeams(teams)

  if (ranked.length === 0) {
    return <p className="text-muted">No teams yet.</p>
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-panel/80">
      <table className="w-full text-left">
        <thead className="border-b border-line text-xs uppercase tracking-[0.15em] text-muted">
          <tr>
            <th className="px-3 py-3 font-medium">#</th>
            <th className="px-3 py-3 font-medium">Team</th>
            <th className="px-3 py-3 font-medium text-right">W</th>
            {!compact && <th className="px-3 py-3 font-medium text-right">L</th>}
            {showFunStats && !compact && (
              <>
                <th className="hidden px-3 py-3 font-medium text-right sm:table-cell">GP</th>
                <th className="hidden px-3 py-3 font-medium text-right md:table-cell">Time</th>
                <th className="hidden px-3 py-3 font-medium text-right lg:table-cell">Cans</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {ranked.map((team, i) => (
            <tr key={team.id} className="border-b border-line/60 last:border-0">
              <td className="px-3 py-3 font-display text-xl text-amber">{i + 1}</td>
              <td className="px-3 py-3">
                <div className="flex items-center gap-2">
                  {team.photo_url ? (
                    <img
                      src={team.photo_url}
                      alt=""
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : null}
                  <span className="font-medium text-foam">{team.name}</span>
                </div>
              </td>
              <td className="px-3 py-3 text-right font-display text-2xl text-live">
                {team.wins}
              </td>
              {!compact && (
                <td className="px-3 py-3 text-right text-muted">{team.losses}</td>
              )}
              {showFunStats && !compact && (
                <>
                  <td className="hidden px-3 py-3 text-right text-muted sm:table-cell">
                    {team.games_played}
                  </td>
                  <td className="hidden px-3 py-3 text-right text-muted md:table-cell">
                    {formatDuration(team.total_seconds_played)}
                  </td>
                  <td className="hidden px-3 py-3 text-right text-muted lg:table-cell">
                    ~{estimatedCans(team.games_played)}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
