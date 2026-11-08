import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from './use-api'
import { useInquiryProcessing } from './use-inquiry-processing'
import { retryInquiryMatching } from '@/lib/inquiry-processing'
import { extractionJobsKey, saveExtractions, type TrackedExtraction } from '@/lib/extraction-jobs'

export function useRetryInquiryMatching(inquiryId: string) {
  const api = useApi()
  const client = useQueryClient()
  const { job, matching } = useInquiryProcessing(inquiryId, { poll: false })
  const retry = useMutation({
    mutationFn: () => {
      if (!job.data || job.data.status !== 'succeeded') throw new Error('Für diese Anfrage liegt keine abgeschlossene Extraktion vor.')
      return retryInquiryMatching(api, job.data.id)
    },
    onSuccess: async (result) => {
      const queryKey = ['inquiry-matching', inquiryId, result.extraction_job_id]
      await Promise.all([
        client.cancelQueries({ queryKey }),
        client.cancelQueries({ queryKey: extractionJobsKey }),
      ])
      client.setQueryData(queryKey, result)
      client.setQueryData<TrackedExtraction[]>(extractionJobsKey, (items) => {
        if (!items) return items
        const updated = items.map((entry) => entry.job.id === result.extraction_job_id
          ? { ...entry, matching: { status: result.status, error: result.error } } : entry)
        saveExtractions(updated)
        return updated
      })
      await Promise.all([
        client.invalidateQueries({ queryKey }),
        client.invalidateQueries({ queryKey: extractionJobsKey }),
        client.invalidateQueries({ queryKey: ['inquiries'] }),
      ])
    },
    onError: () => { void client.invalidateQueries({ queryKey: ['inquiry-matching', inquiryId] }) },
  })
  return { failed: job.data?.status === 'succeeded' && matching.data?.status === 'failed', retry }
}
