import { useTranslation } from '@/i18n'
import { ClipboardListIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fieldStyles, keyFieldKinds } from '@/lib/inquiry-analysis'
import type { InquiryDetail } from '@/lib/inquiry-detail'
import { InquiryDeliveryDate } from './inquiry-overview-fields'
import { OverviewField } from './overview-field'
import { PositionNotes } from './position-notes'
import { TrafficLightBadge } from './traffic-light-badge'

export function InquiryDetailsCard({ detail }: { detail: InquiryDetail }) {
  const { t } = useTranslation()
  return <Card className="rounded-lg shadow-sm">
    <CardHeader className="border-b">
      <CardTitle className="flex items-center gap-2"><ClipboardListIcon aria-hidden="true" className="size-4 text-muted-foreground" /><h2>{t('overview.information')}</h2></CardTitle>
    </CardHeader>
    <CardContent className="space-y-6">
      <dl className="grid grid-cols-2 items-start gap-4 @3xl:grid-cols-3 @5xl:grid-cols-5">
        <OverviewField label={t('fields.inquiry_number')} emphasis={!!detail.inquiryNumber}>{detail.inquiryNumber}</OverviewField>
        <OverviewField label={t('fields.document_number')} emphasis={!!detail.documentNumber}>{detail.documentNumber}</OverviewField>
        <OverviewField label={t('fields.reference_number')} emphasis={!!detail.reference}>{detail.reference}</OverviewField>
        <OverviewField label={t('fields.offer_valid_until')} emphasis={!!detail.offerValidUntil}>{detail.offerValidUntil}</OverviewField>
        <OverviewField label={t('fields.delivery_date')} emphasis={!!detail.deliveryDate}><InquiryDeliveryDate value={detail.deliveryDate} /></OverviewField>
        <div className="col-span-full"><OverviewField label={t('overview.requirements')}>{detail.requirements}</OverviewField></div>
      </dl>
      <div className="space-y-4 border-t pt-5">
        {detail.positions.length ? detail.positions.map((position) => <section key={position.number} aria-label={t('overview.position', { number: position.number })} className="space-y-4 rounded-md border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h3 className="text-base font-semibold">{t('overview.position', { number: position.number })}</h3>
            <TrafficLightBadge status={position.status} label={t('overview.position', { number: position.number })} showDetails={position.status.origin === 'manual'} />
          </div>
          <PositionNotes status={position.status} />
          <dl className="grid items-start gap-4 @sm:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-4">
            {position.fields.map((field) => <OverviewField key={field.kind} label={t(fieldStyles[field.kind].labelKey)} emphasis={!!field.value && keyFieldKinds.has(field.kind)}>{field.value}</OverviewField>)}
          </dl>
        </section>) : <p className="text-sm text-muted-foreground">{t('overview.noPositions')}</p>}
      </div>
    </CardContent>
  </Card>
}
