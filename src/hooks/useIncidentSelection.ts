import { useCallback, useEffect, useRef, useState } from 'react'
import { incidentHref } from '../utils/incidentPresentation'

const readId = () => new URLSearchParams(window.location.search).get('incident_id') || null
export function useIncidentSelection() {
  const [selection, setSelection] = useState(() => ({ id: readId(), revision: 0 }))
  const opener = useRef<HTMLElement | null>(null)
  const closing = useRef(false)
  const previousId = useRef(selection.id)
  const sync = useCallback(() => { closing.current = false; setSelection(previous => ({ id: readId(), revision: previous.revision + 1 })) }, [])
  useEffect(() => {
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [sync])
  useEffect(() => {
    if (previousId.current && !selection.id) {
      const frame = requestAnimationFrame(() => {
        const target = opener.current?.isConnected ? opener.current : document.getElementById('recent-title')
        target?.focus({ preventScroll: true })
      })
      previousId.current = selection.id
      return () => cancelAnimationFrame(frame)
    }
    previousId.current = selection.id
  }, [selection.id])
  const open = useCallback((id: string, element: HTMLElement) => {
    if (readId() === id) return
    opener.current = element
    window.history.pushState({ ...window.history.state, panoptesIncidentEntry: id }, '', incidentHref(id))
    sync()
  }, [sync])
  const close = useCallback(() => {
    if (closing.current) return
    if (readId() && window.history.state?.panoptesIncidentEntry === readId()) {
      closing.current = true
      window.history.back()
    } else {
      const url = new URL(window.location.href)
      url.searchParams.delete('incident_id')
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
      sync()
    }
  }, [sync])
  return { ...selection, open, close }
}
