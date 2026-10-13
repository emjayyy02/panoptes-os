import { useCallback, useEffect, useRef, useState } from 'react'
import { getIncident, PanoptesApiError } from '../services/panoptesApi'
import type { IncidentDetailResponse } from '../types/panoptes'

interface DetailState {
  id: string | null; revision: number; data: IncidentDetailResponse | null
  loading: boolean; error: string | null; fetchedAt: string | null; notFound: boolean
}
const empty = (id: string | null, revision: number): DetailState => ({ id, revision, data: null, loading: !!id, error: null, fetchedAt: null, notFound: false })

export function useIncidentDetail(id: string | null, revision: number) {
  const [state, setState] = useState(() => empty(id, revision))
  const active = useRef<AbortController | null>(null)
  const load = useCallback((controller: AbortController) => {
    if (!id) return
    void getIncident(id, controller.signal).then(data => {
      if (!controller.signal.aborted) setState({ id, revision, data, loading: false, error: null, fetchedAt: new Date().toISOString(), notFound: false })
    }, error => {
      if (!controller.signal.aborted) setState(previous => ({
        ...(previous.id === id && previous.revision === revision ? previous : empty(id, revision)),
        loading: false, error: error instanceof Error ? error.message : 'Incident request failed.',
        notFound: error instanceof PanoptesApiError && error.status === 404,
      }))
    })
  }, [id, revision])
  useEffect(() => {
    const controller = new AbortController()
    active.current = controller
    void load(controller)
    return () => { controller.abort(); active.current?.abort() }
  }, [load])
  const refresh = useCallback(() => {
    active.current?.abort()
    const controller = new AbortController()
    active.current = controller
    setState(previous => ({ ...(previous.id === id && previous.revision === revision ? previous : empty(id, revision)), loading: !!id }))
    void load(controller)
  }, [id, revision, load])
  const accept = useCallback((data: IncidentDetailResponse) => {
    if (data.incident.incident_id !== id) return
    active.current?.abort()
    setState({ id, revision, data, loading: false, error: null, fetchedAt: new Date().toISOString(), notFound: false })
  }, [id, revision])
  // A changed URL can never expose data from the previous selection, even before effects run.
  return { ...(state.id === id && state.revision === revision ? state : empty(id, revision)), refresh, accept }
}
