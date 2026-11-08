import { useTranslation } from '@/i18n'
import { createFileRoute, Navigate } from '@tanstack/react-router'
import { InquiryWorkspace } from '@/components/inquiries/inquiry-workspace'
import { useInquiryAnalysis } from '@/hooks/use-inquiry-analysis'

export const Route = createFileRoute('/anfragen/$inquiryId_/pruefung')({ component: InquiryDetail })

function InquiryDetail() {
  const { t } = useTranslation()
  const { inquiryId } = Route.useParams()
  const { inquiry, analysis, reviewReady, processingPending } = useInquiryAnalysis(inquiryId)
  const data = analysis.data
  if (processingPending || inquiry.isPending || analysis.isPending) return <p role="status">{t('review.loading')}</p>
  if (!reviewReady) return <Navigate to="/anfragen/$inquiryId" params={{ inquiryId }} replace />
  return (
    <div className="space-y-4 lg:flex lg:h-[calc(100dvh-8rem)] lg:min-h-[36rem] lg:flex-col lg:space-y-0 lg:gap-4">
      <header className="min-w-0 shrink-0">
        <h1 className="text-xl font-semibold tracking-tight">Anfrage prüfen</h1>
        <p className="text-sm text-muted-foreground">Daten prüfen und Stammdaten zuordnen</p>
      </header>
      {data?.extraction ? <InquiryWorkspace key={`${inquiryId}:${data.job_id}`} inquiryId={inquiryId} inquiry={inquiry.data} analysis={{ ...data, extraction: data.extraction }} /> : null}
    </div>
  )
}
