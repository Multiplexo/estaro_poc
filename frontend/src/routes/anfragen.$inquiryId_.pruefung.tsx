import { useTranslation } from '@/i18n'
import { createFileRoute } from '@tanstack/react-router'
import { InquiryWorkspace } from '@/components/inquiries/inquiry-workspace'
import { SourcePanel } from '@/components/inquiries/source-panel'
import { useInquiryAnalysis } from '@/hooks/use-inquiry-analysis'
import { useSourceNavigation } from '@/hooks/use-source-navigation'

export const Route = createFileRoute('/anfragen/$inquiryId_/pruefung')({ component: InquiryDetail })

function InquiryDetail() {
  const { t } = useTranslation()
  const { inquiryId } = Route.useParams()
  const { inquiry, analysis } = useInquiryAnalysis(inquiryId)
  const data = analysis.data
  const navigation = useSourceNavigation(data?.sources ?? [], [])
  return (
    <div className="space-y-4 lg:flex lg:h-[calc(100dvh-8rem)] lg:min-h-[36rem] lg:flex-col lg:space-y-0 lg:gap-4">
      <header className="min-w-0 shrink-0">
        <h1 className="text-xl font-semibold tracking-tight">Anfrage prüfen</h1>
        <p className="text-sm text-muted-foreground">Daten prüfen und Stammdaten zuordnen</p>
      </header>
      {inquiry.isError || analysis.isError ? <p role="alert" className="text-destructive">{inquiry.error?.message ?? analysis.error?.message}</p> : null}
      {inquiry.isPending || analysis.isPending ? <p role="status">{t('review.loading')}</p> : null}
      {data?.extraction ? <InquiryWorkspace key={`${inquiryId}:${data.job_id}`} inquiryId={inquiryId} inquiry={inquiry.data} analysis={{ ...data, extraction: data.extraction }} /> : (
        <div className="grid min-w-0 gap-6 lg:grid-cols-2">
          <section><h2 className="text-xl font-semibold">{t('review.information')}</h2><p className="mt-3 text-base text-muted-foreground">{inquiry.data?.processing_job?.status === 'cancelled' ? t('review.cancelled') : inquiry.data?.processing_job?.status === 'failed' ? t('review.failed') : inquiry.data?.processing_job?.status === 'completed' || !inquiry.data?.processing_job ? t('review.noExtraction') : t('review.processing')}</p></section>
          <SourcePanel inquiryId={inquiryId} sources={data?.sources ?? []} highlights={[]} navigation={navigation} />
        </div>
      )}
    </div>
  )
}
