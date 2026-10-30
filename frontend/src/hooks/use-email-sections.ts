import { useMemo } from 'react'
import type { ReadingSource } from '@/lib/inquiry-models'
import { sectionSegments, type Highlight } from '@/lib/inquiry-analysis'

export function useEmailSections(source: ReadingSource, highlights: Highlight[]) {
  return useMemo(() => {
    const bySection = new Map<string, Highlight[]>()
    for (const highlight of highlights) {
      const id = highlight.source.section_id
      const group = bySection.get(id)
      if (group) group.push(highlight)
      else bySection.set(id, [highlight])
    }
    return (source.sections ?? []).map((section) => ({
      id: section.id,
      segments: sectionSegments(section.text, bySection.get(section.id) ?? []),
    }))
  }, [source.sections, highlights])
}
