import { useQuery } from '@tanstack/react-query'
import { useApi } from './use-api'
import { loadInquiryOverviews, type InquiryOverviewQuery } from '@/lib/inquiry-api'
import type { PageInquiryOverview } from '@/lib/inquiry-models'
import { inquiryOverview } from '@/lib/inquiry-overview'

function overviewPage(page: PageInquiryOverview) {
  return { ...page, items: page.items.map(inquiryOverview) }
}

export function useInquiryOverviews(query: InquiryOverviewQuery) {
  const api = useApi()
  return useQuery({
    queryKey: ['inquiries', 'overview', query],
    queryFn: ({ signal }) => loadInquiryOverviews(api, query, { signal }),
    select: overviewPage,
    refetchInterval: 10000,
  })
}
