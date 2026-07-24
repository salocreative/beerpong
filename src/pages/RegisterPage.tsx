import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { EmptyState, LoadingState, PageShell } from '../components/PageShell'
import { useEventData } from '../hooks/useEventData'
import { useResolvedEventId } from '../hooks/useResolvedEventId'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

const REDIRECT_SECONDS = 4

function statusPath(eventId: string) {
  return `/status?event=${eventId}`
}

export function RegisterPage() {
  const navigate = useNavigate()
  const { eventId, loading: resolving } = useResolvedEventId()
  const { event, loading, error, refresh } = useEventData(eventId)
  const [params] = useSearchParams()

  const [teamName, setTeamName] = useState('')
  const [members, setMembers] = useState(['', '', ''])
  const [photo, setPhoto] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)

  const canRegister = event?.phase === 'registration' || event?.phase === 'seeding'
  const liveOrEnded = event?.phase === 'live' || event?.phase === 'ended'

  const memberCount = useMemo(
    () => members.map((m) => m.trim()).filter(Boolean).length,
    [members],
  )

  // Once the tournament is live (or ended), send phones to the status board.
  useEffect(() => {
    if (!eventId || !liveOrEnded) return
    navigate(statusPath(eventId), { replace: true })
  }, [eventId, liveOrEnded, navigate])

  // After a successful signup, auto-open status so teams don't get stuck.
  useEffect(() => {
    if (!done || !eventId || countdown === null) return
    if (countdown <= 0) {
      navigate(statusPath(eventId))
      return
    }
    const id = window.setTimeout(() => setCountdown((c) => (c === null ? c : c - 1)), 1000)
    return () => window.clearTimeout(id)
  }, [done, eventId, countdown, navigate])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!eventId || !event) return

    const cleanMembers = members.map((m) => m.trim()).filter(Boolean)
    if (!teamName.trim()) {
      setFormError('Team name is required.')
      return
    }
    if (cleanMembers.length < 2 || cleanMembers.length > 3) {
      setFormError('Enter 2 or 3 member names.')
      return
    }

    setSubmitting(true)
    setFormError(null)

    try {
      let photoUrl: string | null = null
      if (photo) {
        if (photo.size > 5 * 1024 * 1024) {
          throw new Error('Photo must be under 5MB.')
        }
        const ext = photo.name.split('.').pop()?.toLowerCase() || 'jpg'
        const path = `${eventId}/${crypto.randomUUID()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('team-photos')
          .upload(path, photo, { contentType: photo.type, upsert: false })
        if (uploadError) throw uploadError
        const { data } = supabase.storage.from('team-photos').getPublicUrl(path)
        photoUrl = data.publicUrl
      }

      const { error: insertError } = await supabase.from('teams').insert({
        event_id: eventId,
        name: teamName.trim(),
        members: cleanMembers,
        photo_url: photoUrl,
        state: 'registered',
      })
      if (insertError) throw insertError

      setDone(true)
      setCountdown(REDIRECT_SECONDS)
      void refresh()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isSupabaseConfigured()) {
    return <EmptyState message="Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env" />
  }
  if (resolving || loading) return <LoadingState />
  if (error) return <EmptyState message={error} />
  if (!event) {
    return (
      <EmptyState
        message={
          params.get('event')
            ? 'Event not found. Check the QR code.'
            : 'No event yet. Create one in the admin panel.'
        }
      />
    )
  }

  // Brief flash before redirect when live/ended
  if (liveOrEnded && eventId) {
    return <LoadingState />
  }

  if (done && eventId) {
    return (
      <PageShell title="You're in">
        <div className="mx-auto max-w-lg space-y-5 rounded-2xl border border-live/40 bg-live/10 p-6">
          <p className="text-lg text-foam">
            <span className="font-display text-3xl text-live">{teamName}</span> is registered
            for {event.name}.
          </p>
          <p className="text-muted">
            Opening the live board
            {countdown !== null && countdown > 0 ? ` in ${countdown}…` : '…'}
          </p>
          <Link
            to={statusPath(eventId)}
            className="tap-target flex w-full items-center justify-center rounded-xl bg-amber px-4 py-4 text-lg font-semibold text-ink"
          >
            Go to live status
          </Link>
          <button
            type="button"
            onClick={() => setCountdown(null)}
            className="w-full text-sm text-muted underline"
          >
            Stay on this page
          </button>
        </div>
      </PageShell>
    )
  }

  if (!canRegister && eventId) {
    return (
      <PageShell title="Registration closed">
        <div className="mx-auto max-w-lg space-y-5 rounded-2xl border border-line bg-panel p-6">
          <p className="text-foam">
            {event.name} is already in <span className="text-amber">{event.phase}</span>.
          </p>
          <Link
            to={statusPath(eventId)}
            className="tap-target flex w-full items-center justify-center rounded-xl bg-amber px-4 py-4 text-lg font-semibold text-ink"
          >
            View live status
          </Link>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell title="Register">
      <p className="mb-6 text-muted">{event.name}</p>

      <form onSubmit={onSubmit} className="mx-auto max-w-lg space-y-5">
        <label className="block">
          <span className="mb-2 block text-xs uppercase tracking-[0.15em] text-muted">
            Team name
          </span>
          <input
            className="tap-target w-full rounded-xl border border-line bg-panel px-4 py-3 text-lg outline-none focus:border-amber"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            disabled={submitting}
            required
            autoComplete="off"
          />
        </label>

        <fieldset className="space-y-3">
          <legend className="mb-2 text-xs uppercase tracking-[0.15em] text-muted">
            Members (2–3)
          </legend>
          {members.map((member, i) => (
            <input
              key={i}
              className="tap-target w-full rounded-xl border border-line bg-panel px-4 py-3 outline-none focus:border-amber"
              placeholder={`Player ${i + 1}${i < 2 ? '' : ' (optional)'}`}
              value={member}
              onChange={(e) => {
                const next = [...members]
                next[i] = e.target.value
                setMembers(next)
              }}
              disabled={submitting}
              required={i < 2}
            />
          ))}
          <p className="text-sm text-muted">{memberCount} / 3 filled</p>
        </fieldset>

        <label className="block">
          <span className="mb-2 block text-xs uppercase tracking-[0.15em] text-muted">
            Team photo (optional)
          </span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-amber file:px-3 file:py-2 file:font-medium file:text-ink"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            disabled={submitting}
          />
        </label>

        {formError && <p className="text-danger">{formError}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="tap-target w-full rounded-xl bg-amber px-4 py-4 text-lg font-semibold text-ink disabled:opacity-50"
        >
          {submitting ? 'Submitting…' : 'Register team'}
        </button>
      </form>
    </PageShell>
  )
}
