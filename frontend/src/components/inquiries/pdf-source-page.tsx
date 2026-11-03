import { useTranslation } from '@/i18n'
import { memo, useState } from 'react'
import { Page } from 'react-pdf'
import { useHighlightScroll } from '@/hooks/use-highlight-scroll'
import { usePdfPageVisibility } from '@/hooks/use-pdf-source'
import type { Highlight } from '@/lib/inquiry-analysis'
import { pdfRuleSelection } from '@/lib/pdf-rule-selection'
import type { Rule, RuleSource } from '@/lib/rules'
import { PdfHighlights } from './pdf-highlights'
import { PdfRuleAnnotations } from './pdf-rule-annotations'

export const PdfSourcePage = memo(function PdfSourcePage({ number, total, width, aspectRatio, highlights, active, scrollKey, onSelect, marking, rules, onSelectRule, onAnnotate, onSelectionError }: {
  number: number; total: number; width: number; aspectRatio: number; highlights: Highlight[];
  active?: Highlight; scrollKey?: string; onSelect: (highlight: Highlight) => void
  marking: boolean; rules: Rule[]; onSelectRule: (rule: Rule) => void;
  onAnnotate: (source: Pick<RuleSource, 'page' | 'quote' | 'rectangles'>) => void; onSelectionError: (error: string) => void
}) {
  const { t } = useTranslation()
  const [pageAspectRatio, setPageAspectRatio] = useState(aspectRatio)
  const [hasText, setHasText] = useState(true)
  const { ref, visible } = usePdfPageVisibility(number)
  const selected = active?.source.page === number ? active : undefined
  const hasBox = !!selected?.source.rectangles?.length
  const target = selected ? scrollKey ?? selected.id : undefined
  const { ref: activeBox, scroll: scrollToBox } = useHighlightScroll<HTMLButtonElement>(target)
  const { ref: pageHeading, scroll: scrollToPage } = useHighlightScroll<HTMLParagraphElement>(selected && !hasBox ? target : undefined)
  function captureSelection(container: HTMLDivElement) {
    if (!marking) return
    try {
      const selection = pdfRuleSelection(container)
      if (selection) onAnnotate({ ...selection, page: number })
    } catch (error) {
      onSelectionError(error instanceof Error ? error.message : 'Textstelle konnte nicht markiert werden.')
    }
  }
  return (
    <div ref={ref} role="group" aria-label={t('source.pageOf', { number, total })} className={total > 1 ? "space-y-1" : undefined}>
      <p ref={pageHeading} className={total > 1 ? "px-1 text-[11px] text-muted-foreground" : "h-0 overflow-hidden"}>{t('source.pageOf', { number, total })}</p>
      {marking && !hasText ? <p role="status" className="px-1 text-xs text-muted-foreground">Diese Seite enthält keinen auswählbaren Text. Sie können die Regel auf der Seite „Regeln“ anlegen.</p> : null}
      <div className="overflow-hidden bg-white" style={{ aspectRatio: pageAspectRatio }}
        onPointerUp={(event) => captureSelection(event.currentTarget)}
        onKeyUp={(event) => { if (event.key === 'Shift' || event.key === 'Enter') captureSelection(event.currentTarget) }}>
        {visible || selected ? <Page pageNumber={number} suspense={false} width={Math.max(1, width)} renderAnnotationLayer={false}
          onGetTextSuccess={({ items }) => setHasText(items.some((item) => 'str' in item && item.str.trim().length > 0))}
          onLoadSuccess={(page) => {
            const viewport = page.getViewport({ scale: 1 })
            setPageAspectRatio(viewport.width / viewport.height)
          }}
          onRenderSuccess={selected ? (hasBox ? scrollToBox : scrollToPage) : undefined}
          loading={<p role="status" className="p-4">{t('source.loadingPage', { number })}</p>}
          error={<p role="alert" className="p-4">{t('source.pageError', { number })}</p>}>
          <PdfHighlights page={number} highlights={highlights} active={selected} activeRef={activeBox} onSelect={onSelect} marking={marking} />
          <PdfRuleAnnotations rules={rules} marking={marking} onSelect={onSelectRule} />
        </Page> : <p className="p-4 text-sm text-neutral-500">{t('source.page', { number })}</p>}
      </div>
    </div>
  )
})
