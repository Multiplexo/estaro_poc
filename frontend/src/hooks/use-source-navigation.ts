import { useState } from 'react'
import type { ReadingSource } from '@/lib/inquiry-models'
import type { Highlight } from '@/lib/inquiry-analysis'
import type { SourceSelection } from '@/lib/inquiry-review-state'

export function sourceSelection(sources: ReadingSource[], highlights: Highlight[], selection: SourceSelection) {
  const source = sources.find((source) => source.id === selection.documentId) ?? sources[0]
  const active = highlights.find((highlight) => highlight.id === selection.highlightId && highlight.source.document_id === source?.id)
  return { source, active, scrollKey: active ? `${active.id}-${selection.revision}` : undefined }
}

export interface SourceNavigation extends ReturnType<typeof sourceSelection> {
  selectDocument: (id: string) => void
  selectHighlight: (highlight: Highlight) => void
}

// Standalone source browsing before extraction is available.
export function useSourceNavigation(sources: ReadingSource[], highlights: Highlight[]): SourceNavigation {
  const [selection, setSelection] = useState<SourceSelection>({ revision: 0 })
  return {
    ...sourceSelection(sources, highlights, selection),
    selectDocument: (documentId) => setSelection({ documentId, revision: 0 }),
    selectHighlight: (highlight) => setSelection((current) => ({
      documentId: highlight.source.document_id,
      highlightId: highlight.id, revision: current.revision + 1,
    })),
  }
}
