import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { TeamAvatar } from '../../components/TeamAvatar'
import { supabase } from '../../lib/supabase'
import type { Event, Team } from '../../lib/types'
import { membersLabel } from '../../lib/utils'

interface Props {
  event: Event
  teams: Team[]
  onChanged: () => Promise<void>
}

export function AdminSeeding({ event, teams, onChanged }: Props) {
  const registered = teams.filter((t) => t.state === 'registered' || t.state === 'queued')
  const [order, setOrder] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [members, setMembers] = useState(['', '', ''])

  useEffect(() => {
    setOrder((prev) => {
      const ids = teams.map((t) => t.id)
      const kept = prev.filter((id) => ids.includes(id))
      const missing = ids.filter((id) => !kept.includes(id))
      return [...kept, ...missing]
    })
  }, [teams])

  const orderedTeams = order
    .map((id) => teams.find((t) => t.id === id))
    .filter((t): t is Team => Boolean(t))

  function move(id: string, dir: -1 | 1) {
    setOrder((prev) => {
      const i = prev.indexOf(id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  async function addTeam(e: FormEvent) {
    e.preventDefault()
    const clean = members.map((m) => m.trim()).filter(Boolean)
    if (!name.trim() || clean.length < 2) {
      setError('Name + at least 2 members required.')
      return
    }
    setBusy(true)
    setError(null)
    const { error: insertError } = await supabase.from('teams').insert({
      event_id: event.id,
      name: name.trim(),
      members: clean,
      state: 'registered',
    })
    setBusy(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setName('')
    setMembers(['', '', ''])
    setShowAdd(false)
    await onChanged()
  }

  async function deleteTeam(id: string) {
    if (!confirm('Delete this team?')) return
    setBusy(true)
    const { error: delError } = await supabase.from('teams').delete().eq('id', id)
    setBusy(false)
    if (delError) {
      setError(delError.message)
      return
    }
    await onChanged()
  }

  async function startTournament() {
    if (orderedTeams.length < 2) {
      setError('Need at least 2 teams.')
      return
    }
    if (!confirm(`Start tournament with ${orderedTeams.length} teams in this order?`)) return
    setBusy(true)
    setError(null)
    const { error: rpcError } = await supabase.rpc('start_tournament', {
      p_event_id: event.id,
      ordered_team_ids: orderedTeams.map((t) => t.id),
    })
    setBusy(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    await onChanged()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted">
          {registered.length} teams registered. Drag order via ↑↓ after the physical seeding game,
          then start.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            className="tap-target rounded-xl border border-line px-4 py-2"
          >
            Add team
          </button>
          <button
            type="button"
            disabled={busy || event.phase === 'ended' || orderedTeams.length < 2}
            onClick={() => void startTournament()}
            className="tap-target rounded-xl bg-live px-4 py-2 font-semibold text-ink disabled:opacity-40"
          >
            Start tournament
          </button>
        </div>
      </div>

      {showAdd && (
        <form
          onSubmit={addTeam}
          className="space-y-3 rounded-2xl border border-line bg-panel p-4"
        >
          <input
            className="tap-target w-full rounded-xl border border-line bg-ink px-3 py-2"
            placeholder="Team name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          {members.map((m, i) => (
            <input
              key={i}
              className="tap-target w-full rounded-xl border border-line bg-ink px-3 py-2"
              placeholder={`Member ${i + 1}`}
              value={m}
              onChange={(e) => {
                const next = [...members]
                next[i] = e.target.value
                setMembers(next)
              }}
              required={i < 2}
            />
          ))}
          <button
            type="submit"
            disabled={busy}
            className="tap-target rounded-xl bg-amber px-4 py-2 font-semibold text-ink"
          >
            Save team
          </button>
        </form>
      )}

      {error && <p className="text-danger">{error}</p>}

      <ol className="space-y-2">
        {orderedTeams.map((team, i) => (
          <li
            key={team.id}
            className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-panel/80 px-3 py-3"
          >
            <span className="font-display text-2xl text-amber w-8">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <TeamAvatar team={team} size="sm" />
              <p className="mt-1 pl-12 text-xs text-muted">{membersLabel(team.members)}</p>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                className="tap-target rounded-lg border border-line px-3"
                onClick={() => move(team.id, -1)}
                disabled={i === 0}
              >
                ↑
              </button>
              <button
                type="button"
                className="tap-target rounded-lg border border-line px-3"
                onClick={() => move(team.id, 1)}
                disabled={i === orderedTeams.length - 1}
              >
                ↓
              </button>
              <button
                type="button"
                className="tap-target rounded-lg border border-danger/40 px-3 text-danger"
                onClick={() => void deleteTeam(team.id)}
                disabled={busy || event.phase === 'live'}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
