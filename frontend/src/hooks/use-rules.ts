import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteRule, listRules, saveRule, type RuleInput, type RuleSource } from '@/lib/rules'
import { useApi } from './use-api'

export function useRules(documentId?: string) {
  const api = useApi()
  return useQuery({
    queryKey: ['rules', documentId ?? 'all'],
    queryFn: ({ signal }) => listRules(api, documentId, signal),
  })
}

export function useSaveRule() {
  const api = useApi()
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ input, ruleId, source }: { input: RuleInput; ruleId?: string; source?: RuleSource }) => saveRule(api, input, ruleId, source),
    onSuccess: () => client.invalidateQueries({ queryKey: ['rules'] }),
  })
}

export function useDeleteRule() {
  const api = useApi()
  const client = useQueryClient()
  return useMutation({
    mutationFn: (ruleId: string) => deleteRule(api, ruleId),
    onSuccess: () => client.invalidateQueries({ queryKey: ['rules'] }),
  })
}
