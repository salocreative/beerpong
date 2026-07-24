import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Event, EventTable, Match, Team } from '../lib/types'

export interface EventData {
  event: Event | null
  teams: Team[]
  tables: EventTable[]
  matches: Match[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

async function fetchEventBundle(eventId: string) {
  const [eventRes, teamsRes, tablesRes, matchesRes] = await Promise.all([
    supabase.from('events').select('*').eq('id', eventId).single(),
    supabase.from('teams').select('*').eq('event_id', eventId).order('created_at'),
    supabase.from('event_tables').select('*').eq('event_id', eventId).order('table_number'),
    supabase
      .from('matches')
      .select('*')
      .eq('event_id', eventId)
      .order('started_at', { ascending: false }),
  ])

  if (eventRes.error) throw eventRes.error
  if (teamsRes.error) throw teamsRes.error
  if (tablesRes.error) throw tablesRes.error
  if (matchesRes.error) throw matchesRes.error

  return {
    event: eventRes.data as Event,
    teams: (teamsRes.data ?? []) as Team[],
    tables: (tablesRes.data ?? []) as EventTable[],
    matches: (matchesRes.data ?? []) as Match[],
  }
}

export async function resolveActiveEventId(
  preferredId?: string | null,
): Promise<string | null> {
  if (preferredId) return preferredId

  const live = await supabase
    .from('events')
    .select('id')
    .eq('phase', 'live')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (live.data?.id) return live.data.id

  const latest = await supabase
    .from('events')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return latest.data?.id ?? null
}

export function useEventData(eventId: string | null | undefined): EventData {
  const [event, setEvent] = useState<Event | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [tables, setTables] = useState<EventTable[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!eventId) {
      setEvent(null)
      setTeams([])
      setTables([])
      setMatches([])
      setLoading(false)
      return
    }

    try {
      const data = await fetchEventBundle(eventId)
      setEvent(data.event)
      setTeams(data.teams)
      setTables(data.tables)
      setMatches(data.matches)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load event')
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    setLoading(true)
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!eventId) return

    const channel = supabase
      .channel(`event-${eventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events', filter: `id=eq.${eventId}` },
        () => {
          void refresh()
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'teams',
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          void refresh()
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_tables',
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          void refresh()
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          void refresh()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [eventId, refresh])

  return { event, teams, tables, matches, loading, error, refresh }
}

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}
