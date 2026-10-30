import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useApi } from './use-api'
import { extractionJobsKey, readExtractions, saveExtractions, type TrackedExtraction } from '@/lib/extraction-jobs'

export function useExtractionJobs() {
  const api = useApi()
  const client = useQueryClient()
  const query = useQuery({
    queryKey: extractionJobsKey,
    initialData: readExtractions,
    queryFn: async ({ signal }) => {
      const items = client.getQueryData<TrackedExtraction[]>(extractionJobsKey) ?? []
      const updated = await Promise.all(items.map(async (entry) => {
        if (entry.job.status === 'succeeded' || entry.job.status === 'failed') return entry
        const { data: job } = await api.extractions.getExtractionStatus(entry.job.id, { signal })
        return { ...entry, job }
      }))
      saveExtractions(updated)
      return updated
    },
    refetchInterval: (query) => query.state.data?.some(({ job }) => job.status === 'queued' || job.status === 'running') ? 2000 : false,
  })
  const completed = query.data.filter(({ job }) => job.status === 'succeeded').map(({ job }) => job.id).sort().join(',')
  useEffect(() => {
    if (completed) void client.invalidateQueries({ queryKey: ['inquiries'] })
  }, [client, completed])
  return query
}
