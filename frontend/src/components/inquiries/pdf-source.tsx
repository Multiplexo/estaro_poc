import { useTranslation } from '@/i18n'
import { Document, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import { useContainerWidth, usePdfPages, usePdfSource } from '@/hooks/use-pdf-source'
import type { ReadingPage } from '@/lib/inquiry-models'
import type { Highlight } from '@/lib/inquiry-analysis'
import { PdfSourcePage } from './pdf-source-page'

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

export default function PdfSource({ inquiryId, documentId, pages, highlights, active, scrollKey, onSelect }: {
  inquiryId: string; documentId: string; pages: ReadingPage[]; highlights: Highlight[]; active?: Highlight; scrollKey?: string; onSelect: (highlight: Highlight) => void
}) {
  const { t } = useTranslation()
  const query = usePdfSource(inquiryId, documentId)
  const { ref, width } = useContainerWidth()
  const pageCount = query.pageCount || pages.length
  const sourcePages = usePdfPages(pageCount, pages, highlights)
  return (
    <div ref={ref} className="min-w-0">
      {query.isPending ? <p role="status">{t('source.loadingPdf')}</p> : null}
      {query.isError ? <p role="alert" className="text-destructive">{query.error.message}</p> : null}
      {query.file ? (
        <Document file={query.file} onLoadSuccess={query.onLoadSuccess} suspense={false} loading={t('source.loadingPdf')} error={<p role="alert">{t('source.pdfError')}</p>}>
          <div className="space-y-4">
            {sourcePages.map(({ number, aspectRatio, highlights: pageHighlights }) => {
              const selected = active?.source.page === number
              return <PdfSourcePage key={number} number={number} total={pageCount} width={width} aspectRatio={aspectRatio}
                highlights={pageHighlights} active={selected ? active : undefined} scrollKey={selected ? scrollKey : undefined} onSelect={onSelect} />
            })}
          </div>
        </Document>
      ) : null}
    </div>
  )
}
