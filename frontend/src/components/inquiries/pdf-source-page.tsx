import { useTranslation } from '@/i18n'
import { memo, useState } from 'react'
import { Page } from 'react-pdf'
import { useHighlightScroll } from '@/hooks/use-highlight-scroll'
import { usePdfPageVisibility } from '@/hooks/use-pdf-source'
import type { Highlight } from '@/lib/inquiry-analysis'
import { PdfHighlights } from './pdf-highlights'

export const PdfSourcePage = memo(function PdfSourcePage({ number, total, width, aspectRatio, highlights, active, scrollKey, onSelect }: {
  number: number; total: number; width: number; aspectRatio: number; highlights: Highlight[];
  active?: Highlight; scrollKey?: string; onSelect: (highlight: Highlight) => void
}) {
  const { t } = useTranslation()
  const [pageAspectRatio, setPageAspectRatio] = useState(aspectRatio)
  const { ref, visible } = usePdfPageVisibility(number)
  const selected = active?.source.page === number ? active : undefined
  const hasBox = !!selected?.source.rectangles?.length
  const target = selected ? scrollKey ?? selected.id : undefined
  const { ref: activeBox, scroll: scrollToBox } = useHighlightScroll<HTMLButtonElement>(target)
  const { ref: pageHeading, scroll: scrollToPage } = useHighlightScroll<HTMLParagraphElement>(selected && !hasBox ? target : undefined)
  return (
    <div ref={ref} role="group" aria-label={t('source.pageOf', { number, total })} className={total > 1 ? "space-y-1" : undefined}>
      <p ref={pageHeading} className={total > 1 ? "px-1 text-[11px] text-muted-foreground" : "h-0 overflow-hidden"}>{t('source.pageOf', { number, total })}</p>
      <div className="overflow-hidden bg-white" style={{ aspectRatio: pageAspectRatio }}>
        {visible || selected ? <Page pageNumber={number} suspense={false} width={Math.max(1, width)} renderAnnotationLayer={false}
          onLoadSuccess={(page) => {
            const viewport = page.getViewport({ scale: 1 })
            setPageAspectRatio(viewport.width / viewport.height)
          }}
          onRenderSuccess={selected ? (hasBox ? scrollToBox : scrollToPage) : undefined}
          loading={<p role="status" className="p-4">{t('source.loadingPage', { number })}</p>}
          error={<p role="alert" className="p-4">{t('source.pageError', { number })}</p>}>
          <PdfHighlights page={number} highlights={highlights} active={selected} activeRef={activeBox} onSelect={onSelect} />
        </Page> : <p className="p-4 text-sm text-neutral-500">{t('source.page', { number })}</p>}
      </div>
    </div>
  )
})
