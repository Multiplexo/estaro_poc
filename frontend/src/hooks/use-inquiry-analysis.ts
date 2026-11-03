import { useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useApi } from './use-api'
import { useInquiryProcessing } from './use-inquiry-processing'
import { inquiryResponse, jobSummary, loadAnalysis } from '@/lib/inquiry-api'

export function useInquiryAnalysis(inquiryId: string) {
  const api = useApi()
  const client = useQueryClient()
  const { job, matching } = useInquiryProcessing(inquiryId)
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
    ...inquiry.data, processing_job: job.data ? jobSummary(job.data) : null,
  } : undefined, [inquiry.data, job.data])
  return {
    inquiry: { ...inquiry, data: inquiryData },
    analysis,
  }
}
