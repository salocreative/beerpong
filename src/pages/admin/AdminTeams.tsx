import { useState } from 'react'
import type { FormEvent } from 'react'
import { estimatedCans, formatDuration, membersLabel } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import type { Event, Team } from '../../lib/types'

interface Props {
  event: Event
  teams: Team[]
  onChanged: () => Promise<void>
}

export function AdminTeams({ event, teams, onChanged }: Props) {
  const [editing, setEditing] = useState<Team | null>(null)
  const [name, setName] = useState('')
  const [members, setMembers] = useState(['', '', ''])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function startEdit(team: Team) {
    setEditing(team)
    setName(team.name)
    setMembers([team.members[0] ?? '', team.members[1] ?? '', team.members[2] ?? ''])
    setError(null)
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault()
    if (!editing) return
    const clean = members.map((m) => m.trim()).filter(Boolean)
    if (!name.trim() || clean.length < 2) {
      setError('Name + 2–3 members required.')
      return
    }
    setBusy(true)
    const { error: updateError } = await supabase
      .from('teams')
      .update({ name: name.trim(), members: clean })
      .eq('id', editing.id)
    setBusy(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setEditing(null)
    await onChanged()
  }

  async function remove(team: Team) {
    if (!confirm(`Delete ${team.name}?`)) return
    setBusy(true)
    const { error: delError } = await supabase.from('teams').delete().eq('id', team.id)
    setBusy(false)
    if (delError) {
      setError(delError.message)
      return
    }
    await onChanged()
  }

  return (
    <div className="space-y-4">
      <p className="text-muted">{teams.length} teams · event {event.phase}</p>
      {error && <p className="text-danger">{error}</p>}

      {editing && (
        <form
          onSubmit={saveEdit}
          className="space-y-3 rounded-2xl border border-amber/40 bg-panel p-4"
        >
          <h3 className="font-display text-2xl text-amber">Edit {editing.name}</h3>
          <input
            className="tap-target w-full rounded-xl border border-line bg-ink px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {members.map((m, i) => (
            <input
              key={i}
              className="tap-target w-full rounded-xl border border-line bg-ink px-3 py-2"
              value={m}
              onChange={(e) => {
                const next = [...members]
                next[i] = e.target.value
                setMembers(next)
              }}
            />
          ))}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="tap-target rounded-xl bg-amber px-4 py-2 font-semibold text-ink"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="tap-target rounded-xl border border-line px-4 py-2"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-3 py-3">Team</th>
              <th className="px-3 py-3">State</th>
              <th className="px-3 py-3 text-right">W</th>
              <th className="px-3 py-3 text-right">L</th>
              <th className="px-3 py-3 text-right">GP</th>
              <th className="px-3 py-3 text-right">Time</th>
              <th className="px-3 py-3 text-right">Cans</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => (
              <tr key={team.id} className="border-b border-line/50">
                <td className="px-3 py-3">
                  <div className="font-medium">{team.name}</div>
                  <div className="text-xs text-muted">{membersLabel(team.members)}</div>
                </td>
                <td className="px-3 py-3 text-muted">{team.state}</td>
                <td className="px-3 py-3 text-right text-live">{team.wins}</td>
                <td className="px-3 py-3 text-right">{team.losses}</td>
                <td className="px-3 py-3 text-right">{team.games_played}</td>
                <td className="px-3 py-3 text-right">
                  {formatDuration(team.total_seconds_played)}
                </td>
                <td className="px-3 py-3 text-right">
                  ~{estimatedCans(team.games_played)}
                </td>
                <td className="px-3 py-3 text-right">
                  <button
                    type="button"
                    className="mr-2 text-amber"
                    onClick={() => startEdit(team)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="text-danger"
                    disabled={busy}
                    onClick={() => void remove(team)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
