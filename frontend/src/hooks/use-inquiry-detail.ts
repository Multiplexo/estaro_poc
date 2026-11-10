import { useTranslation } from '@/i18n'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useApi } from './use-api'
import { useInquiryAnalysis } from './use-inquiry-analysis'
import { inquiryDetail } from '@/lib/inquiry-detail'

export function useInquiryDetail(inquiryId: string) {
  const { t } = useTranslation()
  const api = useApi()
  const { inquiry, analysis, reviewReady } = useInquiryAnalysis(inquiryId)
  const detail = useMemo(() => inquiry.data && analysis.data ? inquiryDetail(inquiry.data, analysis.data, t) : null, [inquiry.data, analysis.data, t])
  const customerId = detail?.customerId
  const customer = useQuery({
    queryKey: ['master-data-candidate', 'customers', customerId],
    queryFn: async ({ signal }) => (await api.customers.getCustomerById(customerId!, { signal })).data,
    enabled: !!customerId,
    staleTime: 60_000,
  })
  return { inquiry, analysis, detail, customer, reviewReady }
}
