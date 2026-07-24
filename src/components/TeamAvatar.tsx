import type { Team } from '../lib/types'
import { membersLabel } from '../lib/utils'

interface Props {
  team: Team
  size?: 'sm' | 'md' | 'lg'
  showMembers?: boolean
  className?: string
}

const sizes = {
  sm: 'h-10 w-10 text-sm',
  md: 'h-14 w-14 text-base',
  lg: 'h-24 w-24 text-2xl',
}

export function TeamAvatar({ team, size = 'md', showMembers = false, className = '' }: Props) {
  const initial = team.name.trim().charAt(0).toUpperCase() || '?'

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {team.photo_url ? (
        <img
          src={team.photo_url}
          alt={team.name}
          className={`${sizes[size]} rounded-full object-cover ring-2 ring-amber/40`}
        />
      ) : (
        <div
          className={`${sizes[size]} flex items-center justify-center rounded-full bg-panel-2 font-display text-amber ring-2 ring-line`}
        >
          {initial}
        </div>
      )}
      <div className="min-w-0">
        <div className="truncate font-display text-xl leading-none tracking-wide text-foam sm:text-2xl">
          {team.name}
        </div>
        {showMembers && (
          <div className="mt-1 truncate text-sm text-muted">{membersLabel(team.members)}</div>
        )}
      </div>
    </div>
  )
}
