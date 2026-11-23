import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'

export type FeedbackKind = 'bug' | 'change' | 'domain'

export interface FeedbackInput {
  kind: FeedbackKind
  message: string
  inquiry_id?: string | null
  target?: string | null
  page?: string | null
}

export interface Feedback extends FeedbackInput {
  id: string
  created_at: string
  user_name: string
  forwarded_at?: string | null
}

const queryKey = ['feedback'] as const

export function useSendFeedback() {
  const api = useApi()
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (input: FeedbackInput) => (await api.instance.post<Feedback>('/feedback', input)).data,
    onSuccess: () => client.invalidateQueries({ queryKey }),
  })
}

export function useFeedbackList(enabled: boolean) {
  const api = useApi()
  return useQuery({
    queryKey,
    queryFn: async ({ signal }) => (await api.instance.get<Feedback[]>('/feedback', { signal })).data,
    enabled,
  })
}

const INQUIRY_PATH = /^\/anfragen\/([0-9a-f-]{36})/i

export function inquiryIdFromPath(path: string): string | null {
  return INQUIRY_PATH.exec(path)?.[1] ?? null
}
