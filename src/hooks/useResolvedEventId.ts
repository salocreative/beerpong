import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { resolveActiveEventId } from './useEventData'

export function useResolvedEventId(): {
  eventId: string | null
  loading: boolean
} {
  const [params] = useSearchParams()
  const preferred = params.get('event')
  const [eventId, setEventId] = useState<string | null>(preferred)
  const [loading, setLoading] = useState(!preferred)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      const id = await resolveActiveEventId(preferred)
      if (!cancelled) {
        setEventId(id)
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [preferred])

  return { eventId, loading }
}
