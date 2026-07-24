export type TeamState = 'registered' | 'queued' | 'playing'
export type EventPhase = 'registration' | 'seeding' | 'live' | 'ended'

export interface Event {
  id: string
  name: string
  phase: EventPhase
  starts_at: string | null
  ends_at: string | null
  timer_enabled: boolean
  timer_duration_seconds: number
  table_count: number
  created_at: string
}

export interface Team {
  id: string
  event_id: string
  name: string
  members: string[]
  photo_url: string | null
  state: TeamState
  table_id: string | null
  queue_sequence: number | null
  wins: number
  losses: number
  games_played: number
  total_seconds_played: number
  created_at: string
}

export interface EventTable {
  id: string
  event_id: string
  table_number: number
  current_match_id: string | null
}

export interface Match {
  id: string
  event_id: string
  table_id: string
  round_number: number
  team_a_id: string
  team_b_id: string
  winner_id: string | null
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
  timer_enabled: boolean
  timer_duration_seconds: number | null
  is_seeding: boolean
}

export interface MatchWithTeams extends Match {
  team_a?: Team
  team_b?: Team
}
