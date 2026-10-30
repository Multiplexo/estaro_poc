import { useTranslation } from '@/i18n'
import { createFileRoute, Link } from '@tanstack/react-router'
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
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <Link to="/anfragen/$inquiryId" params={{ inquiryId }} className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline underline-offset-4">{t('navigation.backToOverview')}</Link>
            <h1 className="text-2xl font-semibold">Extraktion</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Extrahierte Angaben bearbeiten, mit Quellen abgleichen und bestätigen.</p>
        </div>
      </header>
      {inquiry.isError || analysis.isError ? <p role="alert" className="text-destructive">{inquiry.error?.message ?? analysis.error?.message}</p> : null}
      {inquiry.isPending || analysis.isPending ? <p role="status">{t('review.loading')}</p> : null}
      {data?.extraction ? <InquiryWorkspace key={inquiryId} inquiryId={inquiryId} analysis={{ ...data, extraction: data.extraction }} /> : (
        <div className="grid min-w-0 gap-6 lg:grid-cols-2">
          <section><h2 className="text-xl font-semibold">{t('review.information')}</h2><p className="mt-3 text-base text-muted-foreground">{inquiry.data?.processing_job?.status === 'cancelled' ? t('review.cancelled') : inquiry.data?.processing_job?.status === 'failed' ? t('review.failed') : inquiry.data?.processing_job?.status === 'completed' || !inquiry.data?.processing_job ? t('review.noExtraction') : t('review.processing')}</p></section>
          <SourcePanel inquiryId={inquiryId} sources={data?.sources ?? []} highlights={[]} navigation={navigation} />
        </div>
      )}
    </div>
  )
}
