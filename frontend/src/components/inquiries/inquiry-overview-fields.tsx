import { useTranslation } from '@/i18n'
import { Badge } from '@/components/ui/badge'
import { deadlineHint, formatInboxDate, type InboxInquiry } from '@/lib/inquiry-overview'

export function InquiryReceivedAt({ inquiry }: { inquiry: InboxInquiry }) {
  const { t } = useTranslation()
  return inquiry.email_received_at ? (
    <time dateTime={inquiry.email_received_at}>{formatInboxDate(inquiry.email_received_at)}</time>
  ) : (
    <span className="text-muted-foreground" title={t('inquiries.uploadedAtLabel', { date: formatInboxDate(inquiry.created_at) })}>{t('common.unknownValue')}</span>
  )
}

export function InquiryDeliveryDate({ value }: { value: string | null }) {
  const hint = value ? deadlineHint(value) : null
  return value ? <span className="inline-flex flex-wrap items-center gap-2 whitespace-normal">
    <span className={hint?.overdue ? 'text-destructive' : undefined}>{value}</span>
    {hint ? <Badge variant="outline" className={hint.overdue ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-800'}>{hint.label}</Badge> : null}
  </span> : <span className="text-muted-foreground">—</span>
}

export function InquiryEmail({ value }: { value: string | null }) {
  const { t } = useTranslation()
  return value ? <span className="break-all">{value}</span> : <span className="text-muted-foreground">{t('common.unknownValue')}</span>
}
