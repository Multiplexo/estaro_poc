import { useTranslation } from '@/i18n'
import { lazy, memo, Suspense, useMemo } from 'react'
import { Download, FileText, Info, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover'
import { useDocumentDownload } from '@/hooks/use-document-download'
import type { SourceNavigation } from '@/hooks/use-source-navigation'
import type { ReadingPage, ReadingSource } from '@/lib/inquiry-models'
import type { Highlight } from '@/lib/inquiry-analysis'
import { EmailSource } from './email-source'

const PdfSource = lazy(() => import('./pdf-source'))
const noPages: ReadingPage[] = []

export const SourcePanel = memo(function SourcePanel({ inquiryId, sources, highlights, navigation }: {
  inquiryId: string; sources: ReadingSource[]; highlights: Highlight[]; navigation: SourceNavigation
}) {
  const { t } = useTranslation()
  const download = useDocumentDownload(inquiryId)
  const { source, active, scrollKey, selectDocument, selectHighlight } = navigation
  const sourceId = source?.id
  const sourceHighlights = useMemo(() => highlights.filter((highlight) => highlight.source.document_id === sourceId), [highlights, sourceId])
  if (!source) return <p className="text-sm text-muted-foreground">{t('source.notReady')}</p>
  return <section aria-label={t('source.original')} className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border bg-card">
    <header className="flex min-h-12 shrink-0 items-center gap-2 border-b px-3 py-1.5">
      {source.file_type === 'pdf' ? <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
      {sources.length > 1 ? <NativeSelect aria-label={t('source.chooseFile')} title={source.filename} value={source.id} onChange={(event) => selectDocument(event.target.value)} className="min-w-0 flex-1 [&_select]:truncate [&_select]:border-transparent [&_select]:text-sm">
        {sources.map((document) => <NativeSelectOption key={document.id} value={document.id}>{document.file_type === 'pdf' ? t('source.pdf') : t('source.email')} · {document.filename}</NativeSelectOption>)}
      </NativeSelect> : <h2 className="min-w-0 flex-1 truncate text-sm font-medium" title={source.filename}>{source.filename}</h2>}
      {source.warnings?.length ? <Popover><PopoverTrigger render={<Button variant="ghost" size="icon" className="size-9 text-amber-700" aria-label={t('source.warnings', { count: source.warnings.length })} title={t('source.warningsTitle')} />}><Info aria-hidden="true" /></PopoverTrigger>
        <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] p-4"><PopoverTitle>{t('source.warningsTitle')}</PopoverTitle><div className="max-h-56 space-y-2 overflow-y-auto text-xs text-muted-foreground">{source.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div></PopoverContent>
      </Popover> : null}
      <Button variant="ghost" size="icon" className="size-9 text-muted-foreground" aria-label={t('source.downloadOriginal')} title={t('source.download')} disabled={!download.available || download.pending !== null} onClick={() => void download.download({ ...source, inquiry_id: inquiryId })}><Download aria-hidden="true" /></Button>
    </header>
    {download.error ? <p role="alert" className="px-3 py-2 text-xs text-destructive">{download.error}</p> : null}
    <div data-source-scroll role="region" aria-label={t('source.documentRegion')} tabIndex={0} className="max-h-[75dvh] min-h-64 flex-1 overflow-auto bg-muted/40 p-3 focus-visible:outline-2 focus-visible:outline-blue-600 lg:max-h-none lg:min-h-0">
      {source.file_type === 'pdf' ? <Suspense fallback={<p role="status">{t('source.loadingPdf')}</p>}>
        <PdfSource key={source.id} inquiryId={inquiryId} documentId={source.id} pages={source.pages ?? noPages}
          highlights={sourceHighlights} active={active} scrollKey={scrollKey} onSelect={selectHighlight} />
      </Suspense> : <EmailSource key={source.id} source={source} highlights={sourceHighlights} active={active} scrollKey={scrollKey} onSelect={selectHighlight} />}
    </div>
  </section>
})
