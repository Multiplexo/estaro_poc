import { unavailable } from '@/lib/api-capabilities'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SettingsResponse, SettingsUpdate } from '@/lib/inquiry-models'

const queryKey = ['ai-settings'] as const

export function useAiSettings() {
  return useQuery({
    queryKey,
    refetchOnWindowFocus: false,
    queryFn: async () => await unavailable<SettingsResponse>(),
  })
}

export function useAiSettingsEditor(initial: SettingsResponse) {
  const client = useQueryClient()
  const [saved, setSaved] = useState(initial)
  const [values, setValues] = useState<SettingsUpdate>(() => toValues(initial))
  const mutation = useMutation({
    mutationFn: async () => await unavailable<SettingsResponse>(),
    onSuccess: (data) => {
      setSaved(data)
      setValues(toValues(data))
      client.setQueryData(queryKey, data)
    },
  })
  const change = <K extends keyof SettingsUpdate>(key: K, value: SettingsUpdate[K]) => {
    mutation.reset()
    setValues(current => ({ ...current, [key]: value }))
  }
  const changeProvider = (provider: SettingsUpdate['provider']) => {
    mutation.reset()
    setValues(current => ({
      ...current, provider, vision_model: null,
      base_url: provider === 'openai' ? 'https://api.openai.com/v1' : 'http://localhost:11434',
      model: '',
    }))
  }
  return {
    values, change, changeProvider,
    isDirty: JSON.stringify(values) !== JSON.stringify(toValues(saved)),
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    error: mutation.error?.message,
    save: () => { if (!mutation.isPending) mutation.mutate() },
    reset: () => { setValues(toValues(saved)); mutation.reset() },
  }
}

function toValues(settings: SettingsResponse): SettingsUpdate {
  return {
    provider: settings.provider,
    base_url: settings.base_url,
    model: settings.model,
    timeout_seconds: settings.timeout_seconds,
    context_window: settings.context_window,
    max_output_tokens: settings.max_output_tokens,
    vision_enabled: settings.vision_enabled,
    vision_model: settings.vision_model,
    max_visual_pages: settings.max_visual_pages,
  }
}

export type AiSettingsEditor = ReturnType<typeof useAiSettingsEditor>
