import { Building2Icon, ChevronDown, CircleCheckIcon } from 'lucide-react'
import { useTranslation } from '@/i18n'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover'
import type { CustomerDetail, InquiryResponse } from '@/lib/inquiry-models'
import type { InquiryDetail } from '@/lib/inquiry-detail'
import { formatInboxDate } from '@/lib/inquiry-overview'
import { InquiryReviewStatus } from './inquiry-overview-badges'
import { JobStatus } from './job-status'
import { OverviewField } from './overview-field'
import { PositionNotes } from './position-notes'
import { TrafficLightBadge } from './traffic-light-badge'

export function InquiryDetailSidebar({ inquiry, detail, customer, customerLoading, customerError }: {
  inquiry: InquiryResponse; detail: InquiryDetail; customer?: CustomerDetail; customerLoading: boolean; customerError?: string
}) {
  const { t } = useTranslation()
  const positionsWithNotes = detail.positions.filter((position) => position.status.origin === 'system' && position.status.color !== 'green' && position.status.reasons.length > 0)
  return <aside aria-label="Status und Kundendaten" className="min-w-0 space-y-5">
    <Card className="gap-0 py-0">
      <CardHeader className="border-b bg-muted/20 py-4"><CardTitle className="flex items-center gap-2"><CircleCheckIcon aria-hidden="true" className="size-4 text-muted-foreground" /><h2>Bearbeitungsstatus</h2></CardTitle></CardHeader>
      <CardContent className="space-y-5 py-5">
        <div className={positionsWithNotes.length ? 'relative [&>div>p]:pr-8' : undefined}>
          <TrafficLightBadge status={detail.trafficLight} label="Anfrage" prominent />
          {positionsWithNotes.length ? <Popover>
            <PopoverTrigger render={<Button variant="ghost" size="icon" className="absolute top-2 right-2" aria-label={t('review.positionNotes')} title={t('review.positionNotes')} />}><ChevronDown aria-hidden="true" /></PopoverTrigger>
            <PopoverContent align="end" className="w-[min(28rem,calc(100vw-2rem))] gap-4 p-4">
              <PopoverTitle>{t('review.positionNotes')}</PopoverTitle>
              <div className="max-h-[min(28rem,60vh)] space-y-4 overflow-y-auto">
                {positionsWithNotes.map((position) => <PositionNotes key={position.number} status={position.status} label={t('overview.position', { number: position.number })} />)}
              </div>
            </PopoverContent>
          </Popover> : null}
        </div>
        <dl className="divide-y [&>div]:py-4 [&>div:first-child]:pt-0 [&>div:last-child]:pb-0">
          <OverviewField label="Prüfstatus"><InquiryReviewStatus status={detail.reviewStatus} /></OverviewField>
          <OverviewField label="Prüffortschritt">{detail.confirmedPositions} von {detail.positions.length} Positionen bestätigt{detail.fieldCount ? <span className="mt-1 block text-xs text-muted-foreground">{detail.openFields} von {detail.fieldCount} Feldern noch ungeprüft</span> : null}</OverviewField>
          <OverviewField label="Verarbeitung"><JobStatus job={inquiry.processing_job} matchingStatus={detail.matchingStatus} /></OverviewField>
          <OverviewField label="Hochgeladen am"><time dateTime={inquiry.created_at}>{formatInboxDate(inquiry.created_at)}</time></OverviewField>
        </dl>
      </CardContent>
    </Card>
    <Card className="gap-0 py-0">
      <CardHeader className="border-b bg-muted/20 py-4"><CardTitle className="flex items-center gap-2"><Building2Icon aria-hidden="true" className="size-4 text-muted-foreground" /><h2>Kundeninformationen</h2></CardTitle></CardHeader>
      <CardContent className="space-y-5 py-5">
        <dl className="space-y-4 rounded-lg border bg-muted/25 p-4">
          <OverviewField label="Kunde" emphasis={!!(customer?.name || detail.customerName)}>{customer?.name || detail.customerName}</OverviewField>
          {customer?.name_addition ? <OverviewField label="Namenszusatz">{customer.name_addition}</OverviewField> : null}
          <OverviewField label="Kundennummer">{detail.customerNumber || customer?.customer_number}</OverviewField>
          <OverviewField label="Ort">{detail.customerLocation || (customer ? [customer.postal_code, customer.city, customer.country_name].filter(Boolean).join(' ') : null)}</OverviewField>
        </dl>
        <div className="border-t pt-5">
          <h3 className="mb-4 text-sm font-semibold">Kontakt & Kommunikation</h3>
          <dl className="space-y-4">
          <OverviewField label="Ansprechpartner / Ihr Zeichen" emphasis={!!detail.contactName}>{detail.contactName}</OverviewField>
          <OverviewField label="E-Mail Ansprechpartner">{detail.contactEmail ? <a className="underline decoration-border underline-offset-4 hover:decoration-primary" href={`mailto:${detail.contactEmail}`}>{detail.contactEmail}</a> : null}</OverviewField>
          <OverviewField label="Telefon / weitere Kontaktnummern">{detail.contactPhone || customer?.phone}</OverviewField>
          <OverviewField label="E-Mail-Absender">{detail.sender}</OverviewField>
          </dl>
        </div>
        {customerLoading ? <p role="status" className="text-xs text-muted-foreground">Kundendaten werden geladen …</p> : null}
        {customerError ? <p role="alert" className="text-xs text-destructive">Kundendaten konnten nicht geladen werden: {customerError}</p> : null}
        {!detail.customerId ? <p className="text-xs text-muted-foreground">Noch kein Kunde eindeutig zugeordnet.</p> : null}
      </CardContent>
    </Card>
  </aside>
}
