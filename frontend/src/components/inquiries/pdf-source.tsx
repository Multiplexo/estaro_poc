import { useTranslation } from '@/i18n'
import { Document, pdfjs } from 'react-pdf'
import { useCallback, useMemo, useState } from 'react'
import { Highlighter, ListChecks } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import 'react-pdf/dist/Page/TextLayer.css'
import { Button } from '@/components/ui/button'
import { RuleEditorDialog } from '@/components/rules/rule-editor-dialog'
import { useContainerWidth, usePdfPages, usePdfSource } from '@/hooks/use-pdf-source'
import { useRules } from '@/hooks/use-rules'
import type { ReadingPage } from '@/lib/inquiry-models'
import type { Highlight } from '@/lib/inquiry-analysis'
import type { Rule, RuleSource } from '@/lib/rules'
import { PdfSourcePage } from './pdf-source-page'

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
const noRules: Rule[] = []

export default function PdfSource({ inquiryId, documentId, pages, highlights, active, scrollKey, onSelect }: {
  inquiryId: string; documentId: string; pages: ReadingPage[]; highlights: Highlight[]; active?: Highlight; scrollKey?: string; onSelect: (highlight: Highlight) => void
}) {
  const { t } = useTranslation()
  const query = usePdfSource(inquiryId, documentId)
  const rules = useRules(documentId)
  const [marking, setMarking] = useState(false)
  const [editor, setEditor] = useState<{ rule?: Rule; source?: RuleSource } | null>(null)
  const [message, setMessage] = useState('')
  const [selectionError, setSelectionError] = useState('')
  const { ref, width } = useContainerWidth()
  const pageCount = query.pageCount || pages.length
  const sourcePages = usePdfPages(pageCount, pages, highlights)
  const rulesByPage = useMemo(() => {
    const grouped = new Map<number, Rule[]>()
    for (const rule of rules.data ?? noRules) {
      const page = rule.source?.page
      if (page == null) continue
      const group = grouped.get(page)
      if (group) group.push(rule)
      else grouped.set(page, [rule])
    }
    return grouped
  }, [rules.data])
  const selectRule = useCallback((rule: Rule) => setEditor({ rule }), [])
  const annotate = useCallback((source: Pick<RuleSource, 'page' | 'quote' | 'rectangles'>) => {
    setSelectionError('')
    setEditor({ source: { ...source, inquiry_id: inquiryId, document_id: documentId } })
    window.getSelection()?.removeAllRanges()
  }, [inquiryId, documentId])
  return (
    <div ref={ref} className="min-w-0">
      <div className="sticky top-0 z-30 mb-3 space-y-2 rounded-lg border bg-card p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant={marking ? 'default' : 'outline'} aria-pressed={marking} disabled={!query.file}
            onClick={() => { setMarking(!marking); setMessage(''); setSelectionError(''); window.getSelection()?.removeAllRanges() }}>
            <Highlighter aria-hidden="true" />{marking ? 'Markieren beenden' : 'Text markieren & Regel erstellen'}
          </Button>
          <Button size="sm" variant="ghost" render={<Link to="/regeln" />}><ListChecks aria-hidden="true" />Regeln</Button>
        </div>
        <p className="text-xs text-muted-foreground">{marking ? 'Markieren Sie Text auf einer PDF-Seite. Anschließend können Sie eine Regel dazu formulieren.' : 'Blaue Markierungen zeigen Regeln. Zum Bearbeiten anklicken.'}</p>
        {message ? <p role="status" className="text-xs text-muted-foreground">{message}</p> : null}
        {selectionError ? <p role="alert" className="text-xs text-destructive">{selectionError}</p> : null}
        {rules.isError ? <p role="alert" className="text-xs text-destructive">Regel-Markierungen konnten nicht geladen werden. <button type="button" className="underline" onClick={() => void rules.refetch()}>Erneut versuchen</button></p> : null}
      </div>
      {query.isPending ? <p role="status">{t('source.loadingPdf')}</p> : null}
      {query.isError ? <p role="alert" className="text-destructive">{query.error.message}</p> : null}
      {query.file ? (
        <Document file={query.file} onLoadSuccess={query.onLoadSuccess} suspense={false} loading={t('source.loadingPdf')} error={<p role="alert">{t('source.pdfError')}</p>}>
          <div className="space-y-4">
            {sourcePages.map(({ number, aspectRatio, highlights: pageHighlights }) => {
              const selected = active?.source.page === number
              return <PdfSourcePage key={number} number={number} total={pageCount} width={width} aspectRatio={aspectRatio}
                highlights={pageHighlights} active={selected ? active : undefined} scrollKey={selected ? scrollKey : undefined} onSelect={onSelect}
                marking={marking} rules={rulesByPage.get(number) ?? noRules} onSelectRule={selectRule}
                onSelectionError={setSelectionError} onAnnotate={annotate} />
            })}
          </div>
        </Document>
      ) : null}
      {editor ? <RuleEditorDialog rule={editor.rule} source={editor.source} onClose={() => setEditor(null)} onSaved={() => {
        setMarking(false)
        setMessage('Regel gespeichert. Aktive Regeln gelten für künftige Durchläufe.')
      }} /> : null}
    </div>
  )
}
