import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'

interface OutlookConnection {
  connected: boolean
  configured: boolean
  fetch_enabled: boolean
  fetch_interval_seconds: number
}

const queryKey = ['outlook-connection'] as const

export function useOutlookConnection() {
  const api = useApi()
  return useQuery({
    queryKey,
    queryFn: async ({ signal }) => (await api.instance.get<OutlookConnection>('/auth/connection', { signal })).data,
  })
}

export function useDisconnectOutlook() {
  const api = useApi()
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => api.instance.delete('/auth/connection'),
    onSuccess: () => client.invalidateQueries({ queryKey }),
  })
}
