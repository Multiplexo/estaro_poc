import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'

export interface CurrentUser {
  id: string
  name: string
  email?: string | null
  roles: ('admin' | 'bearbeiter')[]
  is_admin: boolean
}

export function useCurrentUser() {
  const api = useApi()
  return useQuery({
    queryKey: ['current-user'],
    queryFn: async ({ signal }) => (await api.instance.get<CurrentUser>('/session/me', { signal })).data,
    staleTime: Infinity,
    retry: false,
  })
}

export function useIsAdmin(): boolean {
  return useCurrentUser().data?.is_admin ?? false
}
