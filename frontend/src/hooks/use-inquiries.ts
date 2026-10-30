import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useApi } from './use-api'
import { loadInquiryOverviews } from '@/lib/inquiry-api'

export const PAGE_SIZE = 25

export function useInquiries() {
  const api = useApi()
  const [page, setPage] = useState(0)
  const query = useQuery({
    queryKey: ['inquiries', 'overview'],
    queryFn: ({ signal }) => loadInquiryOverviews(api, { signal }),
    refetchInterval: 10000,
    select: (items) => ({ items: [...items].reverse().slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), total: items.length }),
  })
  const last = Math.max(0, Math.ceil((query.data?.total ?? 0) / PAGE_SIZE) - 1)
  if (query.data && page > last) setPage(last)
  return { ...query, page, setPage }
}
