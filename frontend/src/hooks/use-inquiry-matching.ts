import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api'
import { getInquiryMatchingJob, type MatchSelection } from '@/lib/inquiry-processing'
import type { InquiryExtractionSnapshot } from '@/lib/generated/Api'
import { useApi } from './use-api'

export function useInquiryMatching(inquiryId: string, jobId: string | null | undefined, revision: number, { poll = true }: { poll?: boolean } = {}) {
  const api = useApi()
  const client = useQueryClient()
  const job = useQuery({
    queryKey: ['inquiry-matching', inquiryId, jobId],
    queryFn: async ({ signal }) => {
      try {
        return await getInquiryMatchingJob(api, jobId!, { signal })
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null
        throw error
      }
    },
    enabled: !!jobId,
    refetchInterval: (query) => poll ? (query.state.data?.status === 'queued' || query.state.data?.status === 'running' ? 2000 : 10000) : false,
  })
  const selection = useMutation({
    mutationFn: async (candidate: MatchSelection) => {
      if (!jobId) throw new Error('Für diese Anfrage liegt keine zuordenbare Extraktion vor.')
      return (await api.request<InquiryExtractionSnapshot>({
        path: `/extractions/${jobId}/matching/selection`, method: 'PUT',
        body: { ...candidate, revision }, type: 'application/json', format: 'json',
      })).data
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['inquiry', inquiryId] }),
        client.invalidateQueries({ queryKey: ['inquiry-analysis', inquiryId] }),
        client.invalidateQueries({ queryKey: ['inquiries'] }),
      ])
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        void client.invalidateQueries({ queryKey: ['inquiry', inquiryId] })
        void client.invalidateQueries({ queryKey: ['inquiry-analysis', inquiryId] })
      }
    },
  })
  const running = job.data?.status === 'queued' || job.data?.status === 'running'
  return { job, selection, running, available: !!jobId }
}

export type InquiryMatching = ReturnType<typeof useInquiryMatching>
