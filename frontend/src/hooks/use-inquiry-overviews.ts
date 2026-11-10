import { useCallback } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from '@/i18n'
import { useQuery } from '@tanstack/react-query'
import { useApi } from './use-api'
import { loadInquiryOverviews, type InquiryOverviewQuery } from '@/lib/inquiry-api'
import type { PageInquiryOverview } from '@/lib/inquiry-models'
import { inquiryOverview } from '@/lib/inquiry-overview'

function overviewPage(page: PageInquiryOverview, t: TFunction) {
  return { ...page, items: page.items.map((inquiry) => inquiryOverview(inquiry, t)) }
}

export function useInquiryOverviews(query: InquiryOverviewQuery) {
  const { t } = useTranslation()
  const select = useCallback((page: PageInquiryOverview) => overviewPage(page, t), [t])
  const api = useApi()
  return useQuery({
    queryKey: ['inquiries', 'overview', query],
    queryFn: ({ signal }) => loadInquiryOverviews(api, query, { signal }),
    select,
    refetchInterval: 10000,
  })
}
