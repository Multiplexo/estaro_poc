import { useQuery } from '@tanstack/react-query'
import { ApiError } from '@/lib/api'
import { getInquiryExtractionJob, getInquiryMatchingJob } from '@/lib/inquiry-processing'
import { useApi } from './use-api'

export function useInquiryProcessing(inquiryId: string, { poll = true }: { poll?: boolean } = {}) {
  const api = useApi()
  const job = useQuery({
    queryKey: ['inquiry-job', inquiryId],
    queryFn: ({ signal }) => getInquiryExtractionJob(api, inquiryId, { signal }),
    refetchInterval: (query) => poll ? (query.state.data?.status === 'queued' || query.state.data?.status === 'running' ? 2000 : 10000) : false,
  })
  const jobId = job.data?.id
  const matching = useQuery({
    queryKey: ['inquiry-matching', inquiryId, jobId],
    queryFn: ({ signal }) => getInquiryMatchingJob(api, jobId!, { signal }),
    enabled: job.data?.status === 'succeeded',
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 3,
    refetchInterval: (query) => poll ? (query.state.data?.status === 'queued' || query.state.data?.status === 'running' ? 2000 : 10000) : false,
  })
  const extracting = job.data?.status === 'queued' || job.data?.status === 'running'
  const matchingActive = job.data?.status === 'succeeded' && (matching.data?.status === 'queued' || matching.data?.status === 'running')
  return { job, matching, extracting, matchingActive }
}
