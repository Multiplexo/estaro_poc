import { useTranslation } from '@/i18n'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { InquiryViewTabs } from '@/components/inquiries/inquiry-view-tabs'
import { InquiryDataTable } from '@/components/inquiries/inquiry-data-table'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InquiryDetailsCard } from '@/components/inquiries/inquiry-details-card'
import { InquiryPositions } from '@/components/inquiries/inquiry-positions'
import { InquiryDetailSidebar } from '@/components/inquiries/inquiry-detail-sidebar'
import { InquiryEmailCard } from '@/components/inquiries/inquiry-email-card'
import { InquiryFilesCard } from '@/components/inquiries/inquiry-files-card'
import { InquiryDetailActions } from '@/components/inquiries/inquiry-detail-actions'
import { useInquiryDetail } from '@/hooks/use-inquiry-detail'

export const Route = createFileRoute('/anfragen/$inquiryId')({ component: InquiryOverviewPage })

function InquiryOverviewPage() {
  const { t } = useTranslation()
  const { inquiryId } = Route.useParams()
  const { inquiry, analysis, detail, customer } = useInquiryDetail(inquiryId)
  return (
    <div className="space-y-5">
      <Link to="/" className="inline-flex min-h-10 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeftIcon aria-hidden="true" className="size-4" />{t('inquiries.all')}</Link>
      <header className="page-heading">
        <div className="min-w-0 flex-1 basis-72">
          <p className="page-eyebrow">{t('inquiries.overview')}</p>
          <h1 className="text-3xl font-semibold tracking-tight [overflow-wrap:anywhere]">{detail?.customerName || detail?.title || t('inquiries.singular')}</h1>
          {detail?.customerName && detail.title !== detail.customerName ? <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{detail.title}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button className="min-h-11 px-4" render={<Link to="/anfragen/$inquiryId/pruefung" params={{ inquiryId }} />}>
            {t('inquiries.goToReview')}<ArrowRightIcon aria-hidden="true" />
          </Button>
          {inquiry.data ? <InquiryDetailActions inquiry={inquiry.data} /> : null}
        </div>
      </header>
      {inquiry.isError || analysis.isError ? <div role="alert" className="space-y-3 rounded-lg border border-destructive/30 p-4">
        <p className="text-sm text-destructive">{inquiry.error?.message ?? analysis.error?.message}</p>
        <Button variant="outline" disabled={inquiry.isFetching || analysis.isFetching} onClick={() => { void inquiry.refetch(); void analysis.refetch() }}>{t('navigation.retry')}</Button>
      </div> : null}
      {inquiry.isPending || analysis.isPending ? <p role="status" className="text-sm text-muted-foreground">{t('review.loading')}</p> : null}
      {detail && inquiry.data ? <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] 2xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="contents xl:flex xl:min-w-0 xl:flex-col xl:gap-6">
        <Tabs defaultValue="overview" className="min-w-0 gap-4">
        <InquiryViewTabs />
        <TabsContent value="overview" className="space-y-5">
        <div className="@container min-w-0 space-y-5">
          {detail.extractionNotice ? <p role="status" className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">{detail.extractionNotice}</p> : null}
          <InquiryDetailsCard detail={detail} />
        </div>
        <div className="@container order-2 min-w-0">
          <InquiryPositions detail={detail} />
        </div>
        </TabsContent>
        <TabsContent value="table"><InquiryDataTable detail={detail} /></TabsContent>
        </Tabs>
        <div className="@container order-3 min-w-0">
          <div className="grid min-w-0 items-start gap-5 @xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <InquiryEmailCard emails={detail.emails} />
            <InquiryFilesCard inquiry={inquiry.data} />
          </div>
        </div>
        </div>
        <div className="order-1 min-w-0">
          <InquiryDetailSidebar inquiry={inquiry.data} detail={detail} customer={customer.data} customerLoading={customer.isFetching && !customer.data} customerError={customer.error?.message} />
        </div>
      </div> : null}
    </div>
  )
}
