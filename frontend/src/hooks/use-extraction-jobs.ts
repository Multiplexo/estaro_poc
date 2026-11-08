import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useApi } from './use-api'
import { extractionJobsKey, readExtractions, saveExtractions, type TrackedExtraction } from '@/lib/extraction-jobs'
import { ApiError } from '@/lib/api'
import { getInquiryMatchingJob, matchingFinished } from '@/lib/inquiry-processing'

export function useExtractionJobs() {
  const api = useApi()
  const client = useQueryClient()
  const query = useQuery({
    queryKey: extractionJobsKey,
    initialData: readExtractions,
    queryFn: async ({ signal }) => {
      const items = client.getQueryData<TrackedExtraction[]>(extractionJobsKey) ?? []
      const updated = await Promise.all(items.map(async (entry) => {
        if (entry.job.status === 'failed') return entry
        if (entry.job.status === 'succeeded' && entry.matching?.status === 'succeeded') return entry
        const job = entry.job.status === 'succeeded' ? entry.job : (await api.extractions.getExtractionStatus(entry.job.id, { signal })).data
        if (job.status !== 'succeeded') return { ...entry, job }
        try {
          const matching = await getInquiryMatchingJob(api, job.id, { signal })
          return { ...entry, job, matching: { status: matching.status, error: matching.error } }
        } catch (error) {
          if (error instanceof ApiError && error.status === 404) return { ...entry, job, matching: null }
          throw error
        }
      }))
      saveExtractions(updated)
      return updated
    },
    refetchInterval: (query) => {
      const items = query.state.data ?? []
      if (items.some(({ job, matching }) => job.status === 'queued' || job.status === 'running' || (job.status === 'succeeded' && (!matching || matching.status === 'queued' || matching.status === 'running')))) return 2000
      return items.some(({ matching }) => matching?.status === 'failed') ? 10000 : false
    },
  })
  const completed = query.data.filter(({ job, matching }) => job.status === 'succeeded' && matchingFinished(matching?.status)).map(({ job, matching }) => `${job.id}:${matching!.status}`).sort().join(',')
  useEffect(() => {
    if (completed) void client.invalidateQueries({ queryKey: ['inquiries'] })
  }, [client, completed])
  return query
}
