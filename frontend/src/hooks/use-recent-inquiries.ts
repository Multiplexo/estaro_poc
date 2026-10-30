import { useQuery } from '@tanstack/react-query'
import { useApi } from './use-api'
import { loadInquiryOverviews } from '@/lib/inquiry-api'

export function useRecentInquiries() {
  const api = useApi()
  return useQuery({
    queryKey: ['inquiries', 'overview'],
    queryFn: ({ signal }) => loadInquiryOverviews(api, { signal }),
    select: (items) => ({ items: [...items].reverse().slice(0, 10), total: items.length }),
    refetchInterval: 10000,
  })
}
