import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api'
import { restartInquiryExtraction } from '@/lib/inquiry-processing'
import { useApi } from './use-api'
import { useInquiryProcessing } from './use-inquiry-processing'

export function useReprocessInquiry(inquiryId: string, { poll = true }: { poll?: boolean } = {}) {
  const api = useApi()
  const client = useQueryClient()
  const { job, matching, extracting, matchingActive } = useInquiryProcessing(inquiryId, { poll })
  const restart = useMutation({
    mutationFn: () => restartInquiryExtraction(api, inquiryId),
    onSuccess: async (job) => {
      await client.cancelQueries({ queryKey: ['inquiry-job', inquiryId] })
      client.setQueryData(['inquiry-job', inquiryId], job)
    },
    onError: () => { void client.invalidateQueries({ queryKey: ['inquiry-job', inquiryId] }) },
  })
  const busy = restart.isPending || extracting || matchingActive
  const checkingMatching = job.data?.status === 'succeeded' && matching.isPending
  const matchingError = matching.error instanceof ApiError && matching.error.status === 404 ? null : matching.error
  const error = restart.error?.message ?? job.error?.message ?? matchingError?.message
  const failedStep = job.data?.status === 'failed' ? 'Die Extraktion ist fehlgeschlagen. Du kannst die Verarbeitung erneut starten.'
    : matching.data?.status === 'failed' ? 'Das Matching ist fehlgeschlagen. Du kannst die Verarbeitung erneut starten.' : undefined

  return {
    start: () => restart.mutate(),
    busy,
    disabled: busy || job.isPending || job.isError || checkingMatching || !!matchingError || !job.data,
    error: error ?? failedStep,
    label: restart.isPending ? 'Verarbeitung wird gestartet …' : extracting ? 'Extraktion läuft …' : matchingActive ? 'Matching läuft …' : 'Extraktion und Matching erneut starten',
  }
}
