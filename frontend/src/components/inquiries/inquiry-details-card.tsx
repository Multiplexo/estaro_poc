import { useTranslation } from '@/i18n'
import { CalendarDays, ClipboardListIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { InquiryDetail } from '@/lib/inquiry-detail'
import { InquiryDeliveryDate } from './inquiry-overview-fields'
import { OverviewField } from './overview-field'

export function InquiryDetailsCard({ detail }: { detail: InquiryDetail }) {
  const { t } = useTranslation()
  return <Card className="gap-0 py-0">
    <CardHeader className="border-b bg-muted/20 py-4">
      <CardTitle className="flex items-center gap-2"><ClipboardListIcon aria-hidden="true" className="size-4 text-muted-foreground" /><h2>{t('overview.information')}</h2></CardTitle>
    </CardHeader>
    <CardContent className="space-y-5 py-5">
      <dl className="grid items-start gap-5 @sm:grid-cols-2 @3xl:grid-cols-3">
        <OverviewField label={t('fields.inquiry_number')} emphasis={!!detail.inquiryNumber}>{detail.inquiryNumber}</OverviewField>
        <OverviewField label={t('fields.document_number')} emphasis={!!detail.documentNumber}>{detail.documentNumber}</OverviewField>
        <OverviewField label={t('fields.reference_number')} emphasis={!!detail.reference}>{detail.reference}</OverviewField>
      </dl>
      <div className="rounded-lg border bg-muted/25 p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><CalendarDays aria-hidden="true" className="size-4 text-muted-foreground" />{t('inquiries.datesAndDeadlines')}</h3>
        <dl className="grid gap-5 @sm:grid-cols-2">
          <OverviewField label={t('fields.delivery_date')} emphasis={!!detail.deliveryDate}><InquiryDeliveryDate value={detail.deliveryDate} /></OverviewField>
          <OverviewField label={t('fields.offer_valid_until')} emphasis={!!detail.offerValidUntil}>{detail.offerValidUntil}</OverviewField>
        </dl>
      </div>
      <div className="border-t pt-5">
        <h3 className="mb-2 text-sm font-semibold">{t('overview.requirements')}</h3>
        <p className="whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]">{detail.requirements || <span className="text-muted-foreground">{t('common.notSpecified')}</span>}</p>
      </div>
    </CardContent>
  </Card>
}
