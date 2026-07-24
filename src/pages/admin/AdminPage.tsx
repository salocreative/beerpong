import { useState } from 'react'
import type { FormEvent } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { EmptyState, LoadingState, PageShell } from '../../components/PageShell'
import { useEventData } from '../../hooks/useEventData'
import { useResolvedEventId } from '../../hooks/useResolvedEventId'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import type { Event } from '../../lib/types'
import { AdminLive } from './AdminLive'
import { AdminSeeding } from './AdminSeeding'
import { AdminSettings } from './AdminSettings'
import { AdminTeams } from './AdminTeams'

type Tab = 'seeding' | 'live' | 'teams' | 'settings'

export function AdminPage() {
  const { eventId: resolvedId, loading: resolving } = useResolvedEventId()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const eventId = selectedId ?? resolvedId
  const data = useEventData(eventId)
  const [tab, setTab] = useState<Tab>('seeding')
  const [events, setEvents] = useState<Event[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('Beer Pong Night')
  const [createError, setCreateError] = useState<string | null>(null)

  async function loadEvents() {
    const { data: rows, error } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) setEvents((rows ?? []) as Event[])
  }

  async function createEvent(e: FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)
    try {
      const { data: created, error } = await supabase
        .from('events')
        .insert({
          name: name.trim() || 'Beer Pong Night',
          phase: 'registration',
          table_count: 3,
          timer_enabled: false,
          timer_duration_seconds: 600,
        })
        .select('*')
        .single()
      if (error) throw error

      const event = created as Event
      const tables = Array.from({ length: event.table_count }, (_, i) => ({
        event_id: event.id,
        table_number: i + 1,
      }))
      const { error: tableError } = await supabase.from('event_tables').insert(tables)
      if (tableError) throw tableError

      setSelectedId(event.id)
      await loadEvents()
      await data.refresh()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not create event')
    } finally {
      setCreating(false)
    }
  }

  if (!isSupabaseConfigured()) {
    return <EmptyState message="Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env" />
  }

  if (resolving || (eventId && data.loading)) return <LoadingState />

  if (!eventId || !data.event) {
    if (events === null) {
      void loadEvents()
    }
    return (
      <PageShell title="Admin">
        <div className="mx-auto max-w-lg space-y-6">
          <p className="text-muted">No active event. Create one to get started.</p>
          <form onSubmit={createEvent} className="space-y-4 rounded-2xl border border-line bg-panel p-5">
            <label className="block">
              <span className="mb-2 block text-xs uppercase tracking-[0.15em] text-muted">
                Event name
              </span>
              <input
                className="tap-target w-full rounded-xl border border-line bg-ink px-4 py-3 outline-none focus:border-amber"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
            {createError && <p className="text-danger">{createError}</p>}
            <button
              type="submit"
              disabled={creating}
              className="tap-target w-full rounded-xl bg-amber px-4 py-3 font-semibold text-ink disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Create event'}
            </button>
          </form>
          {events && events.length > 0 && (
            <div className="space-y-2">
              <h2 className="font-display text-2xl text-foam">Past events</h2>
              {events.map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => setSelectedId(ev.id)}
                  className="tap-target flex w-full items-center justify-between rounded-xl border border-line bg-panel px-4 py-3 text-left"
                >
                  <span>{ev.name}</span>
                  <span className="text-sm text-muted">{ev.phase}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </PageShell>
    )
  }

  const event = data.event
  const registerUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${import.meta.env.BASE_URL}#/register?event=${event.id}`
      : `#/register?event=${event.id}`

  return (
    <PageShell
      title="Admin"
      action={
        <span className="rounded-full border border-line px-3 py-1 text-xs uppercase tracking-wider text-muted">
          {event.phase}
        </span>
      }
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl text-amber-hot">{event.name}</h2>
          <p className="text-sm text-muted">Unlisted admin — don’t share this URL.</p>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-line bg-panel p-3">
          <QRCodeSVG value={registerUrl} size={88} bgColor="#141812" fgColor="#f3e6c8" />
          <div className="max-w-[14rem]">
            <p className="text-xs uppercase tracking-wider text-muted">Registration QR</p>
            <p className="break-all text-xs text-foam/80">{registerUrl}</p>
          </div>
        </div>
      </div>

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {(
          [
            ['seeding', 'Registration & Seeding'],
            ['live', 'Live'],
            ['teams', 'Teams'],
            ['settings', 'Settings'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`tap-target shrink-0 rounded-full px-4 py-2 text-sm font-medium ${
              tab === id ? 'bg-amber text-ink' : 'border border-line bg-panel text-foam'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'seeding' && (
        <AdminSeeding
          event={event}
          teams={data.teams}
          onChanged={data.refresh}
        />
      )}
      {tab === 'live' && (
        <AdminLive
          event={event}
          teams={data.teams}
          tables={data.tables}
          matches={data.matches}
          onChanged={data.refresh}
        />
      )}
      {tab === 'teams' && (
        <AdminTeams event={event} teams={data.teams} onChanged={data.refresh} />
      )}
      {tab === 'settings' && (
        <AdminSettings event={event} onChanged={data.refresh} />
      )}
    </PageShell>
  )
}
