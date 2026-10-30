import type { QueryClient } from '@tanstack/react-query'
import type { ExtractionJobStatus } from './generated/Api'

export type TrackedExtraction = { job: ExtractionJobStatus; filename: string }
export const extractionJobsKey = ['extraction-jobs'] as const
const storageKey = 'estaro.extraction-jobs.v1'

export function readExtractions(): TrackedExtraction[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]')
    if (!Array.isArray(value)) return []
    return value.filter((entry): entry is TrackedExtraction =>
      typeof entry?.filename === 'string' && typeof entry?.job?.id === 'string' &&
      ['queued', 'running', 'succeeded', 'failed'].includes(entry?.job?.status))
  } catch {
    return []
  }
}

export function saveExtractions(items: TrackedExtraction[]): void {
  try { localStorage.setItem(storageKey, JSON.stringify(items)) } catch { /* Tracking remains available in the query cache. */ }
}

export async function trackExtraction(client: QueryClient, job: ExtractionJobStatus, filename: string): Promise<void> {
  await client.cancelQueries({ queryKey: extractionJobsKey })
  client.setQueryData<TrackedExtraction[]>(extractionJobsKey, (previous) => {
    const items = [{ job, filename }, ...(previous ?? readExtractions()).filter((entry) => entry.job.id !== job.id)]
    saveExtractions(items)
    return items
  })
  void client.invalidateQueries({ queryKey: extractionJobsKey })
}
