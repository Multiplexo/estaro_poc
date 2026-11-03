import type { Ref } from 'react'
import { sourceAccent, type Highlight } from '@/lib/inquiry-analysis'

export function PdfHighlights({ page, highlights, active, activeRef, onSelect, marking = false }: {
  page: number; highlights: Highlight[]; active?: Highlight; activeRef?: Ref<HTMLButtonElement>; onSelect: (highlight: Highlight) => void; marking?: boolean
}) {
  const boxes = new Map<string, { box: NonNullable<Highlight['source']['rectangles']>[number]; entries: Highlight[] }>()
  for (const highlight of highlights) {
    if (highlight.source.page !== page) continue
    for (const box of highlight.source.rectangles ?? []) {
      const key = `${box.x}:${box.y}:${box.width}:${box.height}`
      const existing = boxes.get(key)
      if (existing) existing.entries.push(highlight)
      else boxes.set(key, { box, entries: [highlight] })
    }
  }
  return (
    <div className="pointer-events-none absolute inset-0 z-10" role="group" aria-label="Extrahierte Angaben im PDF">
      {[...boxes].map(([key, { box, entries }]) => {
        const selected = entries.find((entry) => entry.id === active?.id)
        const highlight = selected ?? entries[0]
        const label = entries.map((entry) => `${entry.label}: ${entry.source.quote}`).join('; ')
        return <button key={key} ref={selected ? activeRef : undefined}
          type="button" aria-label={label} aria-pressed={!!selected}
          disabled={marking}
          title={label} onClick={() => onSelect(entries[(entries.indexOf(highlight) + (selected ? 1 : 0)) % entries.length])}
          className={`${marking ? '' : 'pointer-events-auto cursor-pointer'} absolute rounded-sm border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700 ${selected ? 'z-10 outline-2 outline-orange-700' : 'hover:outline-2 hover:outline-orange-700/60'}`}
          style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.width * 100}%`, height: `${box.height * 100}%`, borderColor: selected ? sourceAccent : `${highlight.color}99`, backgroundColor: `${highlight.color}${selected ? '66' : '33'}` }} />
      })}
    </div>
  )
}
