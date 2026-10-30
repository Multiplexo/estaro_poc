import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useApi } from './use-api'
import { useInquiryAnalysis } from './use-inquiry-analysis'
import { inquiryDetail } from '@/lib/inquiry-detail'

export function useInquiryDetail(inquiryId: string) {
  const api = useApi()
  const { inquiry, analysis } = useInquiryAnalysis(inquiryId)
  const detail = useMemo(() => inquiry.data && analysis.data ? inquiryDetail(inquiry.data, analysis.data) : null, [inquiry.data, analysis.data])
  const customerId = detail?.customerId
  const customer = useQuery({
    queryKey: ['master-data-candidate', 'customers', customerId],
    queryFn: async ({ signal }) => (await api.customers.getCustomerById(customerId!, { signal })).data,
    enabled: !!customerId,
    staleTime: 60_000,
  })
  return { inquiry, analysis, detail, customer }
}
