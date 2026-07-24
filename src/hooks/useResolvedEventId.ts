import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { resolveActiveEventId } from './useEventData'

export function useResolvedEventId(): {
  eventId: string | null
  loading: boolean
  error: string | null
} {
  const [params] = useSearchParams()
  const preferred = params.get('event')
  const [eventId, setEventId] = useState<string | null>(preferred)
  const [loading, setLoading] = useState(!preferred)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const id = await resolveActiveEventId(preferred)
        if (!cancelled) setEventId(id)
      } catch (err) {
        if (!cancelled) {
          setEventId(preferred)
          setError(err instanceof Error ? err.message : 'Failed to resolve event')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [preferred])

  return { eventId, loading, error }
}
