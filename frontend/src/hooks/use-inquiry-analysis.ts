import { useQuery } from '@tanstack/react-query'
import { useApi } from './use-api'
import { inquiryResponse, jobSummary, loadAnalysis } from '@/lib/inquiry-api'

export function useInquiryAnalysis(inquiryId: string) {
  const api = useApi()
  const inquiry = useQuery({
    queryKey: ['inquiry', inquiryId],
    queryFn: async ({ signal }) => inquiryResponse((await api.inquiries.getInquiryById(inquiryId, { signal })).data),
    refetchInterval: 10000,
  })
  const analysis = useQuery({
    queryKey: ['inquiry-analysis', inquiryId],
    queryFn: ({ signal }) => loadAnalysis(api, inquiry.data!, { signal }),
    enabled: !!inquiry.data,
    refetchInterval: 10000,
  })
  const jobId = analysis.data?.job_id
  const job = useQuery({
    queryKey: ['inquiry-job', inquiryId, jobId],
    queryFn: async ({ signal }) => (await api.extractions.getExtractionStatus(jobId!, { signal })).data,
    enabled: !!jobId,
    refetchInterval: (query) => query.state.data?.status === 'queued' || query.state.data?.status === 'running' ? 2000 : false,
  })
  return {
    inquiry: { ...inquiry, data: inquiry.data ? { ...inquiry.data, processing_job: job.data ? jobSummary(job.data) : null } : undefined },
    analysis,
  }
}
