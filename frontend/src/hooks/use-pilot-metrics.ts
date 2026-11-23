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
}

export function usePilotMetrics() {
  const api = useApi()
  return useQuery({
    queryKey: ['pilot-metrics'],
    queryFn: async ({ signal }) => (await api.instance.get<PilotMetrics>('/metrics/pilot', { signal })).data,
  })
}
