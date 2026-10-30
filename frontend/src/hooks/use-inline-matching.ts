import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useApi } from './use-api'
import { candidateQuery, type MasterDataKind } from './use-master-data-search'
import type { MatchCandidate } from '@/lib/inquiry-models'

export function useInlineMatching(kind: MasterDataKind, selectedId: string | undefined, suggestions: MatchCandidate[], onSelect: (id?: string) => void) {
  const api = useApi()
  const [searching, setSearching] = useState(false)
  const suggestion = suggestions.find((entry) => entry.status === 'matching') ?? suggestions[0]
  const displayedId = selectedId ?? suggestion?.id
  const details = useQuery(candidateQuery(api, kind, displayedId))
  return {
    searching, setSearching, details, suggestion: suggestions.find((entry) => entry.id === displayedId),
    selected: !!selectedId,
    accept: () => {
      if (displayedId && details.isSuccess && !details.isFetching) onSelect(displayedId)
    },
    select: (id?: string) => { onSelect(id); setSearching(false) },
  }
}
