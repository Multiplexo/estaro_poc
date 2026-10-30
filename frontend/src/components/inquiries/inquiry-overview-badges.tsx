import { Badge } from '@/components/ui/badge'
import { reviewStatusLabels, type InboxInquiry } from '@/lib/inquiry-overview'

const appearances = {
  green: { label: 'Grün', classes: 'border-emerald-200 bg-emerald-50 text-emerald-800', dot: 'bg-emerald-600' },
  yellow: { label: 'Gelb', classes: 'border-amber-200 bg-amber-50 text-amber-800', dot: 'bg-amber-500' },
  red: { label: 'Rot', classes: 'border-red-200 bg-red-50 text-red-800', dot: 'bg-red-600' },
}

export function InquiryScore({ inquiry, compact = false }: { inquiry: InboxInquiry; compact?: boolean }) {
  const status = inquiry.trafficLight
  const appearance = appearances[status.color]
  const origin = status.origin === 'manual' ? 'Manuell bestätigt' : 'Systembewertung'
  return (
    <Badge variant="outline" className={`${appearance.classes} h-auto max-w-full font-semibold whitespace-normal ${compact ? 'gap-1.5 px-2 py-0.5 text-xs' : 'gap-2 px-3 py-2 text-sm'}`} title={`${origin}: ${status.reasons.join('; ')}`} aria-label={`Ampel: ${appearance.label}. ${origin}. ${status.reasons.join('; ')}`}>
      <span aria-hidden="true" className={`shrink-0 rounded-full ${compact ? 'size-2' : 'size-3'} ${appearance.dot}`} />
      {appearance.label}{status.origin === 'manual' ? ' · bestätigt' : ''}
    </Badge>
  )
}

export function InquiryReviewStatus({ status }: { status: InboxInquiry['review_status'] }) {
  return <Badge variant="outline" className="bg-muted/50 text-muted-foreground">{reviewStatusLabels[status]}</Badge>
}
