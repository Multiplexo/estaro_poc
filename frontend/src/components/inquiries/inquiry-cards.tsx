import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import type { DeleteInquiryController } from '@/hooks/use-delete-inquiry'
import type { InboxInquiry } from '@/lib/inquiry-overview'
import { InquiryReviewStatus, InquiryScore } from './inquiry-overview-badges'
import { InquiryDeliveryDate, InquiryEmail, InquiryReceivedAt } from './inquiry-overview-fields'

export function InquiryCards({ inquiries, deletion, disabled }: { inquiries: InboxInquiry[]; deletion: DeleteInquiryController; disabled: boolean }) {
  return <div className="space-y-3">
    {inquiries.map((inquiry) => <article key={inquiry.id} className="rounded-lg border bg-card px-5 py-5 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="font-semibold"><Link to="/anfragen/$inquiryId" params={{ inquiryId: inquiry.id }} className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-ring">{inquiry.title}</Link></h2>
          <p className="text-sm text-muted-foreground wrap-anywhere">{inquiry.description}</p>
        </div>
        <div className="flex items-center gap-2"><InquiryScore inquiry={inquiry} /><InquiryReviewStatus status={inquiry.review_status} /></div>
      </div>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4 border-t pt-4">
        <dl className="grid min-w-0 flex-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <div><dt className="mb-1 text-sm font-medium text-muted-foreground">E-Mail</dt><dd><InquiryEmail value={inquiry.email} /></dd></div>
          <div><dt className="mb-1 text-sm font-medium text-muted-foreground">E-Mail-Eingang</dt><dd><InquiryReceivedAt inquiry={inquiry} /></dd></div>
          <div><dt className="mb-1 text-sm font-medium text-muted-foreground">Referenz</dt><dd className="wrap-anywhere">{inquiry.reference_number || '—'}</dd></div>
          {inquiry.deliveryDate ? <div><dt className="mb-1 text-sm font-medium text-muted-foreground">Liefertermin</dt><dd><InquiryDeliveryDate value={inquiry.deliveryDate} /></dd></div> : null}
        </dl>
        <Button variant="ghost" size="sm" disabled={disabled || deletion.isPending} aria-label={`Anfrage von ${inquiry.title} löschen`} onClick={(event) => deletion.selectInquiry(inquiry, event.currentTarget)}>Löschen</Button>
      </div>
    </article>)}
  </div>
}
