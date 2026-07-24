import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { TeamAvatar } from '../../components/TeamAvatar'
import { supabase } from '../../lib/supabase'
import type { Event, Team } from '../../lib/types'
import { membersLabel } from '../../lib/utils'

interface Props {
  event: Event
  teams: Team[]
  onChanged: () => Promise<void>
}

function SortableTeamRow({
  team,
  index,
  busy,
  canDelete,
  onDelete,
  onMove,
  isFirst,
  isLast,
}: {
  team: Team
  index: number
  busy: boolean
  canDelete: boolean
  onDelete: () => void
  onMove: (dir: -1 | 1) => void
  isFirst: boolean
  isLast: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: team.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex flex-wrap items-center gap-3 rounded-2xl border bg-panel/80 px-3 py-3 ${
        isDragging
          ? 'z-10 border-amber shadow-lg shadow-amber/10'
          : 'border-line'
      }`}
    >
      <button
        type="button"
        className="tap-target cursor-grab touch-none rounded-lg border border-line px-3 text-muted active:cursor-grabbing"
        aria-label={`Drag ${team.name}`}
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      <span className="w-8 font-display text-2xl text-amber">{index + 1}</span>
      <div className="min-w-0 flex-1">
        <TeamAvatar team={team} size="sm" />
        <p className="mt-1 pl-12 text-xs text-muted">{membersLabel(team.members)}</p>
      </div>
      <div className="flex gap-1">
        <button
          type="button"
          className="tap-target rounded-lg border border-line px-3"
          onClick={() => onMove(-1)}
          disabled={isFirst}
        >
          ↑
        </button>
        <button
          type="button"
          className="tap-target rounded-lg border border-line px-3"
          onClick={() => onMove(1)}
          disabled={isLast}
        >
          ↓
        </button>
        <button
          type="button"
          className="tap-target rounded-lg border border-danger/40 px-3 text-danger"
          onClick={onDelete}
          disabled={busy || !canDelete}
        >
          Delete
        </button>
      </div>
    </li>
  )
}

export function AdminSeeding({ event, teams, onChanged }: Props) {
  const registered = teams.filter((t) => t.state === 'registered' || t.state === 'queued')
  const [order, setOrder] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [members, setMembers] = useState(['', '', ''])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

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
      return arrayMove(prev, i, j)
    })
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setOrder((prev) => {
      const oldIndex = prev.indexOf(String(active.id))
      const newIndex = prev.indexOf(String(over.id))
      if (oldIndex < 0 || newIndex < 0) return prev
      return arrayMove(prev, oldIndex, newIndex)
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
          {registered.length} teams registered. Drag the ⠿ handle to set seeding order, then
          start.
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

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <ol className="space-y-2">
            {orderedTeams.map((team, i) => (
              <SortableTeamRow
                key={team.id}
                team={team}
                index={i}
                busy={busy}
                canDelete={event.phase !== 'live'}
                onDelete={() => void deleteTeam(team.id)}
                onMove={(dir) => move(team.id, dir)}
                isFirst={i === 0}
                isLast={i === orderedTeams.length - 1}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
    </div>
  )
}
