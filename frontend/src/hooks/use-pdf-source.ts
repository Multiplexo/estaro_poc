import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useApi } from './use-api'
import type { ReadingPage } from '@/lib/inquiry-models'
import type { Highlight } from '@/lib/inquiry-analysis'

export function usePdfPages(pageCount: number, pages: ReadingPage[], highlights: Highlight[]) {
  return useMemo(() => {
    const pagesByNumber = new Map(pages.map((page) => [page.number, page]))
    const highlightsByPage = new Map<number, Highlight[]>()
    for (const highlight of highlights) {
      if (highlight.source.page == null) continue
      const number = highlight.source.page
      const group = highlightsByPage.get(number)
      if (group) group.push(highlight)
      else highlightsByPage.set(number, [highlight])
    }
    return Array.from({ length: pageCount }, (_, index) => {
      const number = index + 1
      const page = pagesByNumber.get(number)
      return {
        number,
        aspectRatio: page && page.height > 0 ? page.width / page.height : 1 / Math.SQRT2,
        highlights: highlightsByPage.get(number) ?? [],
      }
    })
  }, [pageCount, pages, highlights])
}

export function usePdfSource(inquiryId: string, documentId: string) {
  const api = useApi()
  const [pageCount, setPageCount] = useState(0)
  const query = useQuery({
    queryKey: ['pdf-source', inquiryId, documentId],
    // Load through the API so the document needs a signed-in session; no
    // pre-signed storage links that work without authentication.
    queryFn: () => api.instance.getUri({ url: `/inquiries/${inquiryId}/documents/${documentId}` }),
    staleTime: Infinity,
  })
  const file = useMemo(() => query.data ? { url: query.data } : null, [query.data])
  return { ...query, file, pageCount, onLoadSuccess: ({ numPages }: { numPages: number }) => setPageCount(numPages) }
}

export function usePdfPageVisibility(pageNumber: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(pageNumber === 1)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      root: element.closest('[data-source-scroll]'), rootMargin: '900px 0px',
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return { ref, visible }
}

export function useContainerWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(600)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return { ref, width }
}
