import { useTranslation } from '@/i18n'
import { Badge } from '@/components/ui/badge'
import { reviewStatusKeys, type InboxInquiry } from '@/lib/inquiry-overview'

const appearances = {
  green: { labelKey: 'traffic.green', classes: 'border-emerald-200 bg-emerald-50 text-emerald-800', dot: 'bg-emerald-600' },
  yellow: { labelKey: 'traffic.yellow', classes: 'border-amber-200 bg-amber-50 text-amber-800', dot: 'bg-amber-500' },
  red: { labelKey: 'traffic.red', classes: 'border-red-200 bg-red-50 text-red-800', dot: 'bg-red-600' },
} as const

export function InquiryScore({ inquiry, compact = false }: { inquiry: InboxInquiry; compact?: boolean }) {
  const { t } = useTranslation()
  const status = inquiry.trafficLight
  const appearance = appearances[status.color]
  const color = t(appearance.labelKey)
  const origin = status.origin === 'manual' ? t('traffic.manualReason') : t('traffic.system')
  return (
    <Badge variant="outline" className={`${appearance.classes} h-auto max-w-full font-semibold whitespace-normal ${compact ? 'gap-1.5 px-2 py-0.5 text-xs' : 'gap-2 px-3 py-2 text-sm'}`} title={`${origin}: ${status.reasons.join('; ')}`} aria-label={t('traffic.overviewLabel', { color, origin, reasons: status.reasons.join('; ') })}>
      <span aria-hidden="true" className={`shrink-0 rounded-full ${compact ? 'size-2' : 'size-3'} ${appearance.dot}`} />
      {color}{status.origin === 'manual' ? t('traffic.confirmedSuffix') : ''}
    </Badge>
  )
}

export function InquiryReviewStatus({ status }: { status: InboxInquiry['review_status'] }) {
  const { t } = useTranslation()
  return <Badge variant="outline" className="bg-muted/50 text-muted-foreground">{t(reviewStatusKeys[status])}</Badge>
}
