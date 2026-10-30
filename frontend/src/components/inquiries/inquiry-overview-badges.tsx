import { Badge } from '@/components/ui/badge'
import { reviewStatusLabels, type InboxInquiry } from '@/lib/inquiry-overview'

const appearances = {
  green: { label: 'Grün', classes: 'border-emerald-200 bg-emerald-50 text-emerald-800', dot: 'bg-emerald-600' },
  yellow: { label: 'Gelb', classes: 'border-amber-200 bg-amber-50 text-amber-800', dot: 'bg-amber-500' },
  red: { label: 'Rot', classes: 'border-red-200 bg-red-50 text-red-800', dot: 'bg-red-600' },
}

export function InquiryScore({ inquiry }: { inquiry: InboxInquiry }) {
  const status = inquiry.trafficLight
  const appearance = appearances[status.color]
  const origin = status.origin === 'manual' ? 'Manuell bestätigt' : 'Systembewertung'
  return (
    <Badge variant="outline" className={`${appearance.classes} h-auto max-w-full gap-2 px-3 py-2 text-sm font-semibold whitespace-normal`} title={`${origin}: ${status.reasons.join('; ')}`} aria-label={`Ampel: ${appearance.label}. ${origin}. ${status.reasons.join('; ')}`}>
      <span aria-hidden="true" className={`size-3 shrink-0 rounded-full ${appearance.dot}`} />
      {appearance.label}{status.origin === 'manual' ? ' · bestätigt' : ''}
    </Badge>
  )
}

export function InquiryReviewStatus({ status }: { status: InboxInquiry['review_status'] }) {
  return <Badge variant="outline" className="bg-muted/50 text-muted-foreground">{reviewStatusLabels[status]}</Badge>
}
