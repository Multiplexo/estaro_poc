import { useCallback, useEffect, useRef } from 'react'
import { scrollBehavior } from '@/lib/motion'

export function useHighlightScroll<T extends HTMLElement>(highlightId?: string) {
  const ref = useRef<T>(null)
  const scroll = useCallback(() => {
    const element = ref.current
    if (!element) return
    const container = element.closest<HTMLElement>('[data-source-scroll]')
    if (container) {
      const offset = element.getBoundingClientRect().top - container.getBoundingClientRect().top
      container.scrollTo({ top: container.scrollTop + offset - (container.clientHeight - element.offsetHeight) / 2, behavior: scrollBehavior() })
    } else {
      element.scrollIntoView({ block: 'center', behavior: scrollBehavior() })
    }
  }, [])
  useEffect(() => {
    if (highlightId) scroll()
  }, [highlightId, scroll])
  return { ref, scroll }
}
