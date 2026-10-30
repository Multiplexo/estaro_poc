import { useState } from 'react'
import type { ReviewEditor } from './use-inquiry-review'

export function useReviewSections(review: Pick<ReviewEditor, 'activeSection' | 'selectionRevision'>) {
  const [expanded, setExpanded] = useState<string[]>(['customer'])
  const activeSection = review.activeSection
  const [previous, setPrevious] = useState(review.selectionRevision)
  if (review.selectionRevision !== previous) {
    setPrevious(review.selectionRevision)
    if (activeSection && !expanded.includes(activeSection)) setExpanded([activeSection])
  }
  return { expanded, setExpanded }
}
