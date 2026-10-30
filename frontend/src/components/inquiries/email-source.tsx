import { useTranslation } from '@/i18n'
import { useHighlightScroll } from '@/hooks/use-highlight-scroll'
import { useEmailSections } from '@/hooks/use-email-sections'
import type { ReadingSource } from '@/lib/inquiry-models'
import type { Highlight } from '@/lib/inquiry-analysis'

export function EmailSource({ source, highlights, active, scrollKey, onSelect }: {
  source: ReadingSource; highlights: Highlight[]; active?: Highlight; scrollKey?: string; onSelect: (highlight: Highlight) => void
}) {
  const { t } = useTranslation()
  const { ref: activeSection } = useHighlightScroll<HTMLParagraphElement>(scrollKey ?? active?.id)
  const sections = useEmailSections(source, highlights)
  return (
    <article aria-label={t('source.emailView')} className="space-y-1 rounded-lg border bg-background p-5 text-base leading-relaxed">
      {sections.map((section) => {
        const isActive = active?.source.section_id === section.id
        return (
          <p key={section.id} ref={isActive ? activeSection : undefined} className="min-h-5 whitespace-pre-wrap break-words">
            {section.segments.map((segment) => {
              const highlight = segment.highlights.find((highlight) => highlight.id === active?.id) ?? segment.highlights[0]
              const isSelected = highlight?.id === active?.id
              return highlight ? (
                <button key={segment.start} type="button" onClick={() => onSelect(highlight)} title={segment.highlights.map((highlight) => highlight.label).join(', ')}
                  className={`rounded-sm text-left whitespace-pre-wrap focus-visible:outline-2 focus-visible:outline-orange-700 ${isSelected ? 'outline-2 outline-orange-700' : ''}`}
                  style={{ backgroundColor: `${highlight.color}${isSelected ? '99' : '66'}` }}>{segment.text}</button>
              ) : <span key={segment.start}>{segment.text}</span>
            })}
          </p>
        )
      })}
    </article>
  )
}
