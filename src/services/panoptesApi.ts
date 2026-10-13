import { getApiBase } from '../config/env'
import { isIncidentsResponse, isSummaryResponse } from './panoptesContracts'
import type { IncidentsResponse, SummaryResponse } from '../types/panoptes'

async function get<T>(resource: string, validate: (value: unknown) => value is T, signal: AbortSignal): Promise<T> {
  const timeout = AbortSignal.timeout(20_000)
  let response: Response
  try {
    response = await fetch(`${getApiBase()}/${resource}`, {
      signal: AbortSignal.any([signal, timeout]), credentials: 'omit',
    })
  } catch (error) {
    if (signal.aborted) throw error
    if (timeout.aborted) throw new Error(`/${resource} did not respond within 20 seconds. Try refreshing.`)
    if (error instanceof TypeError) throw new Error(`Could not reach /${resource}. Check API availability and browser network errors, then refresh.`)
    throw error
  }
  if (!response.ok) throw new Error(`/${resource} returned HTTP ${response.status}. Try refreshing or check the API.`)
  let payload: unknown
  try { payload = await response.json() }
  catch {
    if (signal.aborted) throw new DOMException('Request cancelled', 'AbortError')
    if (timeout.aborted) throw new Error(`/${resource} response timed out. Try refreshing.`)
    throw new Error(`/${resource} did not return valid JSON (${response.headers.get('content-type') ?? 'unknown content type'}). Check upstream routing.`)
  }
  if (!validate(payload)) throw new Error(`/${resource} response does not match the Panoptes contract. No replacement data has been displayed.`)
  return payload
}
export const getSummary = (signal: AbortSignal): Promise<SummaryResponse> => get('summary', isSummaryResponse, signal)
export const getIncidents = (signal: AbortSignal): Promise<IncidentsResponse> => get('incidents', isIncidentsResponse, signal)
