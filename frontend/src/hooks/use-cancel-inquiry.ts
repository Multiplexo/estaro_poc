import { unavailable } from '@/lib/api-capabilities'
import { useMutation, useQueryClient } from '@tanstack/react-query'

export function useCancelInquiry() {
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: (_id: string) => unavailable<void>(),
    onSettled: async (_, __, id) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['inquiries'] }),
        client.invalidateQueries({ queryKey: ['inquiry', id] }),
        client.invalidateQueries({ queryKey: ['inquiry-job', id] }),
        client.invalidateQueries({ queryKey: ['inquiry-analysis', id] }),
      ])
    },
  })

  return {
    cancel: (id: string) => { if (!mutation.isPending) mutation.mutate(id) },
    isPending: mutation.isPending,
    error: mutation.error?.message,
  }
}
