import { useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useApi } from './use-api'
import { useInquiryProcessing } from './use-inquiry-processing'
import { inquiryResponse, processingJobSummary, loadAnalysis } from '@/lib/inquiry-api'
import { matchingFinished } from '@/lib/inquiry-processing'

export function useInquiryAnalysis(inquiryId: string) {
  const api = useApi()
  const client = useQueryClient()
  const { job, matching } = useInquiryProcessing(inquiryId)
  const processingReady = job.isSuccess && matching.isSuccess && job.data?.status === 'succeeded' && matchingFinished(matching.data?.status)
  const inquiry = useQuery({
    queryKey: ['inquiry', inquiryId, job.data?.id, processingReady],
    queryFn: async ({ signal }) => inquiryResponse((await api.inquiries.getInquiryById(inquiryId, { signal })).data),
    refetchInterval: 10000,
  })
  const analysis = useQuery({
    queryKey: ['inquiry-analysis', inquiryId, job.data?.id, processingReady],
    queryFn: ({ signal }) => loadAnalysis(api, inquiry.data!, { signal }),
    enabled: !!inquiry.data,
    refetchInterval: 10000,
  })
  const jobId = job.data?.id
  const jobStatus = job.data?.status
  const matchingStatus = matching.data?.status
  useEffect(() => {
    if (jobStatus !== 'succeeded' && jobStatus !== 'failed') return
    void client.invalidateQueries({ queryKey: ['inquiry', inquiryId] })
    void client.invalidateQueries({ queryKey: ['inquiry-analysis', inquiryId] })
    void client.invalidateQueries({ queryKey: ['inquiries'] })
  }, [client, inquiryId, jobId, jobStatus, matchingStatus])
  const inquiryData = useMemo(() => inquiry.data ? {
    ...inquiry.data, processing_job: job.data ? processingJobSummary(job.data, matching.data) : null,
  } : undefined, [inquiry.data, job.data, matching.data])
  return {
    inquiry: { ...inquiry, data: inquiryData },
    analysis,
    reviewReady: processingReady && inquiry.isSuccess && analysis.isSuccess && analysis.data?.job_id === job.data?.id && !!analysis.data?.extraction,
    processingPending: job.isPending || (job.data?.status === 'succeeded' && matching.isPending),
  }
}
