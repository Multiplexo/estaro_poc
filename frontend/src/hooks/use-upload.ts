import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type FormEvent } from 'react'
import { useApi } from '@/hooks/use-api'
import { trackExtraction } from '@/lib/extraction-jobs'

export function useUpload(onSuccess: () => void) {
  const api = useApi()
  const client = useQueryClient()
  const formRef = useRef<HTMLFormElement>(null)
  const [file, setFile] = useState<File>()
  const [validationError, setValidationError] = useState<string>()
  const mutation = useMutation({
    mutationFn: async (selected: File) => {
      return (await api.extractions.extraction({ file: selected })).data
    },
    onSuccess: async (job, selected) => {
      await trackExtraction(client, job, selected.name)
      setFile(undefined)
      setValidationError(undefined)
      formRef.current?.reset()
      void client.invalidateQueries({ queryKey: ['inquiries'] })
      onSuccess()
    },
  })
  function selectFile(selected?: File) {
    mutation.reset()
    setFile(selected)
    setValidationError(selected && (!/\.(pdf|msg|eml)$/i.test(selected.name) || !selected.size)
      ? 'Bitte eine nicht leere PDF-, MSG- oder EML-Datei auswählen.' : undefined)
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file || mutation.isPending || validationError) return
    mutation.mutate(file)
  }
  return {
    formRef, selectFile, submit, isUploading: mutation.isPending,
    canSubmit: !!file && !validationError,
    error: validationError ?? mutation.error?.message,
  }
}
