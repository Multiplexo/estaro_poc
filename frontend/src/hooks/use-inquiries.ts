import { useState } from 'react'
import { useInquiryOverviews } from './use-inquiry-overviews'

export const PAGE_SIZE = 25

export function useInquiries() {
  const [page, setPage] = useState(0)
  const query = useInquiryOverviews({ offset: page * PAGE_SIZE, limit: PAGE_SIZE, sort: 'newest' })
  const last = Math.max(0, Math.ceil((query.data?.total ?? 0) / PAGE_SIZE) - 1)
  if (query.data && page > last) setPage(last)
  return { ...query, page, setPage }
}
