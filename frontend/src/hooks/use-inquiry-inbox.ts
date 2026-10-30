import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useApi } from '@/hooks/use-api'
import { PAGE_SIZE } from '@/hooks/use-inquiries'
import { inquiryOverview } from '@/lib/inquiry-overview'
import type { InquiryOverview } from '@/lib/inquiry-models'
import { loadInquiryOverviews } from '@/lib/inquiry-api'

export type InboxSort = 'newest' | 'oldest' | 'customer'
export type InboxStatus = InquiryOverview['review_status'] | 'all'


export function useInquiryInbox() {
  const api = useApi()
  const [view, setView] = useState('list')
  const [search, setSearch] = useState('')
  const [term, setTerm] = useState('')
  const [sort, setSort] = useState<InboxSort>('newest')
  const [status, setStatus] = useState<InboxStatus>('all')
  const [page, setPage] = useState(0)
  useEffect(() => {
    const timer = window.setTimeout(() => setTerm(search.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [search])
  const query = useQuery({
    queryKey: ['inquiries', 'overview'],
    queryFn: ({ signal }) => loadInquiryOverviews(api, { signal }),
    refetchInterval: 10000,
    select: (data) => {
      const text = term.toLocaleLowerCase('de-DE')
      const items = data.filter((item) =>
        (status === 'all' || item.review_status === status) &&
        [item.customer_name, item.email, item.subject, item.reference_number, ...item.documents.map((document) => document.filename)]
          .some((value) => value?.toLocaleLowerCase('de-DE').includes(text)))
      items.sort((a, b) => sort === 'customer'
        ? (a.customer_name ?? '').localeCompare(b.customer_name ?? '', 'de')
        : (sort === 'oldest' ? 1 : -1) * (a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)))
      return { total: items.length, items: items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(inquiryOverview) }
    },
  })
  if (query.data && !query.isPlaceholderData) {
    const last = Math.max(0, Math.ceil(query.data.total / PAGE_SIZE) - 1)
    if (page > last) setPage(last)
  }
  return {
    query, view, setView, search, sort, status, page, setPage,
    waiting: term !== search.trim(),
    setSearch: (value: string) => { setSearch(value); setPage(0) },
    setSort: (value: InboxSort) => { setSort(value); setPage(0) },
    setStatus: (value: InboxStatus) => { setStatus(value); setPage(0) },
  }
}

export type InquiryInboxController = ReturnType<typeof useInquiryInbox>
