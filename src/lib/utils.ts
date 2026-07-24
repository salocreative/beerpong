import type { Team } from './types'

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${m}:${rem.toString().padStart(2, '0')}`
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const rem = s % 60
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`
  }
  return `${m}:${rem.toString().padStart(2, '0')}`
}

export function rankTeams(teams: Team[]): Team[] {
  return [...teams]
    .filter((t) => t.state !== 'withdrawn' || t.games_played > 0)
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins
      if (a.losses !== b.losses) return a.losses - b.losses
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })
}

export function queueTeams(teams: Team[]): Team[] {
  return teams
    .filter((t) => t.state === 'queued')
    .sort((a, b) => (a.queue_sequence ?? 0) - (b.queue_sequence ?? 0))
}

export function activeTables<T extends { table_number: number }>(
  tables: T[],
  tableCount: number,
): T[] {
  return tables
    .filter((t) => t.table_number <= tableCount)
    .sort((a, b) => a.table_number - b.table_number)
}

export function estimatedCans(gamesPlayed: number): number {
  return gamesPlayed * 2
}

export function membersLabel(members: string[]): string {
  return members.filter(Boolean).join(' · ')
}

export function toLocalInputValue(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fromLocalInputValue(value: string): string | null {
  if (!value) return null
  return new Date(value).toISOString()
}
