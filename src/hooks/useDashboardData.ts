import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { getIncidents, getSummary } from '../services/panoptesApi'
import type { IncidentsResponse, SummaryResponse } from '../types/panoptes'

export interface ResourceState<T> { data: T | null; loading: boolean; error: string | null; fetchedAt: string | null }
const initial = <T,>(): ResourceState<T> => ({ data: null, loading: true, error: null, fetchedAt: null })
export function useDashboardData() {
  const [summary, setSummary] = useState(initial<SummaryResponse>)
  const [incidents, setIncidents] = useState(initial<IncidentsResponse>)
  const active = useRef<AbortController | null>(null)
  const loadData = useCallback(() => {
    active.current?.abort()
    const controller = new AbortController()
    active.current = controller
    const load = async <T,>(read: (signal: AbortSignal) => Promise<T>, update: Dispatch<SetStateAction<ResourceState<T>>>) => {
      try {
        const data = await read(controller.signal)
        if (!controller.signal.aborted) update({ data, loading: false, error: null, fetchedAt: new Date().toISOString() })
      } catch (error) {
        if (!controller.signal.aborted) update(previous => ({ ...previous, loading: false, error: error instanceof Error ? error.message : 'Request failed. Try refreshing.' }))
      }
    }
    void load(getSummary, setSummary)
    void load(getIncidents, setIncidents)
  }, [])
  const refresh = useCallback(() => {
    setSummary(previous => ({ ...previous, loading: true }))
    setIncidents(previous => ({ ...previous, loading: true }))
    loadData()
  }, [loadData])
  useEffect(() => { loadData(); return () => active.current?.abort() }, [loadData])
  return { summary, incidents, refresh, refreshing: summary.loading || incidents.loading }
}
