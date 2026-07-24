import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import type { Event, EventTable } from '../../lib/types'
import { fromLocalInputValue, toLocalInputValue } from '../../lib/utils'

interface Props {
  event: Event
  tables: EventTable[]
  onChanged: () => Promise<void>
}

export function AdminSettings({ event, tables, onChanged }: Props) {
  const [timerEnabled, setTimerEnabled] = useState(event.timer_enabled)
  const [duration, setDuration] = useState(event.timer_duration_seconds)
  const [tableCount, setTableCount] = useState(event.table_count)
  const [startsAt, setStartsAt] = useState(toLocalInputValue(event.starts_at))
  const [endsAt, setEndsAt] = useState(toLocalInputValue(event.ends_at))
  const [name, setName] = useState(event.name)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setTimerEnabled(event.timer_enabled)
    setDuration(event.timer_duration_seconds)
    setTableCount(event.table_count)
    setStartsAt(toLocalInputValue(event.starts_at))
    setEndsAt(toLocalInputValue(event.ends_at))
    setName(event.name)
  }, [event])

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setMessage(null)

    const count = Math.max(1, Math.min(10, Math.floor(tableCount) || 1))

    if (count < event.table_count) {
      const busyHigher = tables.filter(
        (t) => t.table_number > count && t.current_match_id !== null,
      )
      if (busyHigher.length > 0) {
        setBusy(false)
        setError(
          `Can't reduce to ${count} tables while table ${busyHigher
            .map((t) => t.table_number)
            .join(', ')} still has an active match.`,
        )
        return
      }
    }

    const { error: updateError } = await supabase
      .from('events')
      .update({
        name: name.trim(),
        timer_enabled: timerEnabled,
        timer_duration_seconds: Math.max(30, duration),
        table_count: count,
        starts_at: fromLocalInputValue(startsAt),
        ends_at: fromLocalInputValue(endsAt),
      })
      .eq('id', event.id)

    if (updateError) {
      setBusy(false)
      setError(updateError.message)
      return
    }

    // Ensure event_tables rows exist for 1..count
    const existing = new Set(tables.map((t) => t.table_number))
    const missing = []
    for (let n = 1; n <= count; n++) {
      if (!existing.has(n)) {
        missing.push({ event_id: event.id, table_number: n })
      }
    }
    if (missing.length > 0) {
      const { error: insertError } = await supabase.from('event_tables').insert(missing)
      if (insertError) {
        setBusy(false)
        setError(insertError.message)
        return
      }
    }

    setBusy(false)
    setTableCount(count)
    setMessage(
      count !== event.table_count
        ? `Saved. Now using ${count} table${count === 1 ? '' : 's'}.`
        : 'Saved. New matches will use the updated timer settings.',
    )
    await onChanged()
  }

  async function endEvent() {
    if (!confirm('End the event, pause all timers, and freeze the leaderboard?')) return
    setBusy(true)
    setError(null)
    setMessage(null)
    const { error: rpcError } = await supabase.rpc('end_event', {
      p_event_id: event.id,
    })
    setBusy(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    setMessage('Event ended. Timers paused.')
    await onChanged()
  }

  async function resetEvent() {
    if (
      !confirm(
        'Reset this event? This deletes ALL teams, matches, and queue data. Settings (name, times, timer) are kept. This cannot be undone.',
      )
    ) {
      return
    }
    if (!confirm('Really clear everything and start fresh registration?')) return

    setBusy(true)
    setError(null)
    setMessage(null)
    const { error: rpcError } = await supabase.rpc('reset_event', {
      p_event_id: event.id,
    })
    setBusy(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    setMessage('Event reset. Registration is open again.')
    await onChanged()
  }

  async function reopenRegistration() {
    if (event.phase === 'live') {
      if (!confirm('Move back to registration? Live matches will not be cleared.')) return
    }
    setBusy(true)
    setError(null)
    const { error: updateError } = await supabase
      .from('events')
      .update({ phase: 'registration', closed_at: null })
      .eq('id', event.id)
    setBusy(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    await onChanged()
  }

  return (
    <form onSubmit={save} className="mx-auto max-w-xl space-y-5">
      <label className="block">
        <span className="mb-2 block text-xs uppercase tracking-[0.15em] text-muted">
          Event name
        </span>
        <input
          className="tap-target w-full rounded-xl border border-line bg-panel px-4 py-3 outline-none focus:border-amber"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-xs uppercase tracking-[0.15em] text-muted">
          Number of tables
        </span>
        <input
          type="number"
          min={1}
          max={10}
          className="tap-target w-full rounded-xl border border-line bg-panel px-4 py-3 outline-none focus:border-amber"
          value={tableCount}
          onChange={(e) => setTableCount(Number(e.target.value))}
        />
        <span className="mt-1 block text-sm text-muted">
          1–10. Adds tables immediately; reducing hides higher tables (blocked if they have an
          active match).
        </span>
      </label>

      <label className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-panel px-4 py-4">
        <span>
          <span className="block font-medium">Match timer</span>
          <span className="text-sm text-muted">Visual countdown only — never auto-decides</span>
        </span>
        <input
          type="checkbox"
          checked={timerEnabled}
          onChange={(e) => setTimerEnabled(e.target.checked)}
          className="h-5 w-5 accent-amber"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-xs uppercase tracking-[0.15em] text-muted">
          Timer duration (seconds)
        </span>
        <input
          type="number"
          min={30}
          step={30}
          className="tap-target w-full rounded-xl border border-line bg-panel px-4 py-3 outline-none focus:border-amber"
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-xs uppercase tracking-[0.15em] text-muted">
            Starts at
          </span>
          <input
            type="datetime-local"
            className="tap-target w-full rounded-xl border border-line bg-panel px-4 py-3 outline-none focus:border-amber"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs uppercase tracking-[0.15em] text-muted">
            Ends at
          </span>
          <input
            type="datetime-local"
            className="tap-target w-full rounded-xl border border-line bg-panel px-4 py-3 outline-none focus:border-amber"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </label>
      </div>

      {error && <p className="text-danger">{error}</p>}
      {message && <p className="text-live">{message}</p>}

      <button
        type="submit"
        disabled={busy}
        className="tap-target w-full rounded-xl bg-amber px-4 py-3 font-semibold text-ink disabled:opacity-50"
      >
        {busy ? 'Saving…' : 'Save settings'}
      </button>

      <div className="flex flex-wrap gap-2 border-t border-line pt-5">
        <button
          type="button"
          disabled={busy || event.phase === 'ended'}
          onClick={() => void endEvent()}
          className="tap-target rounded-xl bg-danger px-4 py-3 font-semibold text-ink disabled:opacity-40"
        >
          End event
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void reopenRegistration()}
          className="tap-target rounded-xl border border-line px-4 py-3"
        >
          Back to registration
        </button>
      </div>

      <div className="space-y-3 rounded-2xl border border-danger/30 bg-danger/5 p-4">
        <div>
          <h3 className="font-display text-2xl text-danger">Reset event</h3>
          <p className="mt-1 text-sm text-muted">
            Clears all teams, matches, and queue. Returns to registration so you can run a fresh
            night. Event name and timer settings are kept.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void resetEvent()}
          className="tap-target w-full rounded-xl border border-danger bg-ink px-4 py-3 font-semibold text-danger disabled:opacity-40"
        >
          Reset & clear all teams
        </button>
      </div>
    </form>
  )
}
