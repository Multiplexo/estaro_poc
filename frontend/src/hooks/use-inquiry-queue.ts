import { useState } from 'react'
import { useExtractionJobs } from './use-extraction-jobs'
import { PAGE_SIZE } from './use-inquiries'
import { jobSummary } from '@/lib/inquiry-api'
import type { Inquiry } from '@/lib/api'

export function useInquiryQueue() {
  const query = useExtractionJobs()
  const [page, setPage] = useState(0)
  const jobs = query.data.filter(({ job }) => job.status !== 'succeeded')
  const items: Inquiry[] = jobs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(({ job, filename }) => ({
    id: job.inquiry_id ?? job.id, created_at: job.created_at, processing_job: jobSummary(job),
    documents: job.document_id ? [{ id: job.document_id, inquiry_id: job.inquiry_id ?? '', filename, file_type: 'pdf' }] : [],
  }))
  const last = Math.max(0, Math.ceil(jobs.length / PAGE_SIZE) - 1)
  if (page > last) setPage(last)
  return { ...query, data: { items, total: jobs.length }, isPlaceholderData: false, page, setPage }
}
export type InquiryQueueController = ReturnType<typeof useInquiryQueue>
