import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InquiryDetailsCard } from '@/components/inquiries/inquiry-details-card'
import { InquiryDetailSidebar } from '@/components/inquiries/inquiry-detail-sidebar'
import { InquiryEmailCard } from '@/components/inquiries/inquiry-email-card'
import { InquiryFilesCard } from '@/components/inquiries/inquiry-files-card'
import { InquiryDetailActions } from '@/components/inquiries/inquiry-detail-actions'
import { useInquiryDetail } from '@/hooks/use-inquiry-detail'

export const Route = createFileRoute('/anfragen/$inquiryId')({ component: InquiryOverviewPage })

function InquiryOverviewPage() {
  const { inquiryId } = Route.useParams()
  const { inquiry, analysis, detail, customer } = useInquiryDetail(inquiryId)
  return (
    <div className="space-y-5">
      <Link to="/" className="inline-flex min-h-10 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeftIcon aria-hidden="true" className="size-4" />Alle Anfragen</Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 basis-72">
          <p className="mb-1 text-sm text-muted-foreground">Anfrageübersicht</p>
          <h1 className="text-2xl font-semibold tracking-tight [overflow-wrap:anywhere]">{detail?.title ?? 'Anfrage'}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {inquiry.data ? <InquiryDetailActions inquiry={inquiry.data} /> : null}
          {detail ? <Button className="min-h-11 px-4" render={<Link to="/anfragen/$inquiryId/pruefung" params={{ inquiryId }} />}>
            Extraktion ansehen<ArrowRightIcon aria-hidden="true" />
          </Button> : null}
        </div>
      </header>
      {inquiry.isError || analysis.isError ? <div role="alert" className="space-y-3 rounded-lg border border-destructive/30 p-4">
        <p className="text-sm text-destructive">{inquiry.error?.message ?? analysis.error?.message}</p>
        <Button variant="outline" disabled={inquiry.isFetching || analysis.isFetching} onClick={() => { void inquiry.refetch(); void analysis.refetch() }}>Erneut versuchen</Button>
      </div> : null}
      {inquiry.isPending || analysis.isPending ? <p role="status" className="text-sm text-muted-foreground">Anfrage wird geladen …</p> : null}
      {detail && inquiry.data ? <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] 2xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="@container min-w-0 space-y-5">
          {detail.extractionNotice ? <p role="status" className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">{detail.extractionNotice}</p> : null}
          <InquiryDetailsCard detail={detail} />
          <div className="grid min-w-0 items-start gap-5 @xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <InquiryEmailCard emails={detail.emails} />
            <InquiryFilesCard inquiry={inquiry.data} />
          </div>
        </div>
        <InquiryDetailSidebar inquiry={inquiry.data} detail={detail} customer={customer.data} customerLoading={customer.isFetching && !customer.data} customerError={customer.error?.message} />
      </div> : null}
    </div>
  )
}
