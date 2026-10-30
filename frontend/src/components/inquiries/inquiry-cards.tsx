import { Link } from '@tanstack/react-router'
import { ArrowUpRight, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { DeleteInquiryController } from '@/hooks/use-delete-inquiry'
import { formatInboxDate, type InboxInquiry } from '@/lib/inquiry-overview'
import { InquiryReviewStatus, InquiryScore } from './inquiry-overview-badges'
import { InquiryDeliveryDate, InquiryEmail, InquiryReceivedAt } from './inquiry-overview-fields'

export function InquiryCards({ inquiries, deletion, disabled }: { inquiries: InboxInquiry[]; deletion: DeleteInquiryController; disabled: boolean }) {
  return <div className="divide-y">
    {inquiries.map((inquiry) => <article key={inquiry.id} className="bg-card px-4 py-3 transition-colors hover:bg-muted/20 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="flex items-center gap-2 font-semibold"><span aria-hidden="true" className="hidden size-7 shrink-0 items-center justify-center rounded-md border bg-muted/40 sm:flex"><FileText className="size-3.5 text-muted-foreground" /></span><Link to="/anfragen/$inquiryId" params={{ inquiryId: inquiry.id }} className="group flex min-w-0 items-center gap-2 rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-ring"><span className="wrap-anywhere">{inquiry.title}</span><ArrowUpRight aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground group-hover:text-primary" /></Link></h2>
          <p className="text-sm text-muted-foreground wrap-anywhere">{inquiry.description}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <InquiryScore inquiry={inquiry} compact />
          {inquiry.review_status === 'in_review' ? <InquiryReviewStatus status={inquiry.review_status} /> : null}
          <span className="text-xs tabular-nums text-muted-foreground">Erstellt <time dateTime={inquiry.created_at}>{formatInboxDate(inquiry.created_at)}</time></span>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
        <dl className="grid min-w-0 flex-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2 xl:grid-cols-4 [&>div]:min-w-0 [&_dd]:m-0 [&_dd]:text-left [&_dt]:mb-0.5 [&_dt]:text-left [&_dt]:text-xs [&_dt]:font-medium [&_dt]:text-muted-foreground">
          <div><dt>E-Mail</dt><dd><InquiryEmail value={inquiry.email} /></dd></div>
          <div><dt>E-Mail-Eingang</dt><dd><InquiryReceivedAt inquiry={inquiry} /></dd></div>
          <div><dt>Referenz</dt><dd className="wrap-anywhere">{inquiry.reference_number || '—'}</dd></div>
          {inquiry.deliveryDate ? <div><dt>Liefertermin</dt><dd><InquiryDeliveryDate value={inquiry.deliveryDate} /></dd></div> : null}
        </dl>
        <Button variant="ghost" size="sm" disabled={disabled || deletion.isPending} aria-label={`Anfrage von ${inquiry.title} löschen`} onClick={(event) => deletion.selectInquiry(inquiry, event.currentTarget)}>Löschen</Button>
      </div>
    </article>)}
  </div>
}
