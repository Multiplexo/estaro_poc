import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useApi } from './use-api'
import type { ApiClient } from '@/lib/api'
import { loadAll } from '@/lib/inquiry-api'
import type { MasterDataCandidate } from '@/lib/master-data-candidate'

export type MasterDataKind = 'customers' | 'articles'
export const candidatePageSize = 10

export function candidateQuery(api: ApiClient, kind: MasterDataKind, id?: string) {
  return {
    queryKey: ['master-data-candidate', kind, id],
    staleTime: 60_000,
    queryFn: async ({ signal }: { signal: AbortSignal }) => kind === 'customers'
      ? (await api.customers.getCustomerById(id!, { signal })).data
      : (await api.articles.getArticleById(Number(id!), { signal })).data,
    enabled: !!id,
  }
}

export function useMasterDataSearch(kind: MasterDataKind, initialSearch: string) {
  const api = useApi()
  const [search, setSearch] = useState(initialSearch.slice(0, 200))
  const [term, setTerm] = useState(search.trim())
  const [offset, setOffset] = useState(0)
  useEffect(() => {
    const timer = window.setTimeout(() => setTerm(search.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [search])
  const results = useQuery({
    queryKey: ['master-data-search', kind, term, offset],
    queryFn: async ({ signal }) => {
      const items = await loadAll<MasterDataCandidate>((params) => kind === 'customers'
        ? api.customers.listCustomers(params, { signal })
        : api.articles.listArticles(params, { signal }))
      const filtered = items.filter((item) => Object.values(item).some((value) =>
        typeof value === 'string' && value.toLocaleLowerCase('de-DE').includes(term.toLocaleLowerCase('de-DE'))))
      return { items: filtered.slice(offset, offset + candidatePageSize), total: filtered.length }
    },
    enabled: term === search.trim(),
  })
  return {
    search, setSearch: (value: string) => { setSearch(value); setOffset(0) },
    results, offset, setOffset, waiting: term !== search.trim(),
  }
}
