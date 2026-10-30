import { useEffect, useState } from 'react'
import { PAGE_SIZE } from '@/hooks/use-inquiries'
import type { InquiryOverview } from '@/lib/inquiry-models'
import { useInquiryOverviews } from './use-inquiry-overviews'

export type InboxSort = 'newest' | 'oldest' | 'customer'
export type InboxStatus = InquiryOverview['review_status'] | 'all'


export function useInquiryInbox() {
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
  const query = useInquiryOverviews({ offset: page * PAGE_SIZE, limit: PAGE_SIZE, search: term, sort, status })
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
