import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'

export interface FieldCorrections {
  group: 'customer' | 'inquiry' | 'position'
  field: string
  corrections: number
  reviewed: number
}

export interface WeeklyMetrics {
  week: string
  reviewed_inquiries: number
  without_correction: number
  corrections_per_inquiry: number
}

export interface WeeklyCosts {
  week: string
  inquiries: number
  input_tokens: number
  output_tokens: number
  cost_eur: number | null
}

export interface CostMetrics {
  inquiries: number
  input_tokens: number
  output_tokens: number
  input_tokens_per_inquiry: number
  output_tokens_per_inquiry: number
  cost_eur: number | null
  cost_per_inquiry_eur: number | null
  weekly: WeeklyCosts[]
}

export interface PilotMetrics {
  reviewed_inquiries: number
  without_correction: number
  field_corrections: number
  corrections_per_inquiry: number
  customer_reassigned: number
  positions: number
  articles_reassigned: number
  corrections_by_field: FieldCorrections[]
  weekly: WeeklyMetrics[]
  costs: CostMetrics
}

export function usePilotMetrics() {
  const api = useApi()
  return useQuery({
    queryKey: ['pilot-metrics'],
    queryFn: async ({ signal }) => (await api.instance.get<PilotMetrics>('/metrics/pilot', { signal })).data,
  })
}
