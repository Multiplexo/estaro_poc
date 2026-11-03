import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError, type Inquiry } from '@/lib/api'
import { removeInquiryExtractions } from '@/lib/extraction-jobs'
import { useApi } from './use-api'

export function useDeleteInquiry({ onDeleted }: { onDeleted?: () => void | Promise<void> } = {}) {
  const api = useApi()
  const client = useQueryClient()
  const [inquiry, setInquiry] = useState<Inquiry | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const mutation = useMutation({
    mutationFn: async (id: string) => {
      try {
        await api.inquiries.deleteInquiry(id)
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return
        throw error
      }
    },
    onSuccess: async (_, id) => {
      await removeInquiryExtractions(client, id)
      await onDeleted?.()
      const keys = [['inquiry', id], ['inquiry-analysis', id], ['inquiry-job', id], ['inquiry-matching', id]]
      await Promise.all(keys.map((queryKey) => client.cancelQueries({ queryKey })))
      keys.forEach((queryKey) => client.removeQueries({ queryKey }))
      setInquiry(null)
      await client.invalidateQueries({ queryKey: ['inquiries'] })
    },
    onError: () => { void client.invalidateQueries({ queryKey: ['inquiries'] }) },
  })

  function selectInquiry(selected: Inquiry | null, trigger?: HTMLButtonElement) {
    if (mutation.isPending) return
    if (selected) triggerRef.current = trigger ?? null
    mutation.reset()
    setInquiry(selected)
  }

  return {
    inquiry,
    triggerRef,
    selectInquiry,
    confirm: () => {
      if (inquiry && !mutation.isPending) mutation.mutate(inquiry.id)
    },
    isPending: mutation.isPending,
    error: mutation.error?.message,
  }
}

export type DeleteInquiryController = ReturnType<typeof useDeleteInquiry>
