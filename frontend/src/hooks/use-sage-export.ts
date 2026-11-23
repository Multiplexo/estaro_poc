import { useMutation } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'

function filenameFrom(disposition: string | undefined, fallback: string): string {
  const match = disposition?.match(/filename="([^"]+)"/)
  return match?.[1] ?? fallback
}

export function useSageExport(inquiryId: string) {
  const api = useApi()
  return useMutation({
    mutationFn: async () => {
      const response = await api.instance.get<Blob>(`/inquiries/${inquiryId}/export`, { responseType: 'blob' })
      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.download = filenameFrom(response.headers['content-disposition'] as string | undefined, 'sage-import.csv')
      document.body.append(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    },
  })
}
