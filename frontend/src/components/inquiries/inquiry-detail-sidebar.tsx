import { Building2Icon, CircleCheckIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CustomerDetail, InquiryResponse } from '@/lib/inquiry-models'
import type { InquiryDetail } from '@/lib/inquiry-detail'
import { formatInboxDate } from '@/lib/inquiry-overview'
import { InquiryReviewStatus } from './inquiry-overview-badges'
import { JobStatus } from './job-status'
import { OverviewField } from './overview-field'
import { TrafficLightBadge } from './traffic-light-badge'

export function InquiryDetailSidebar({ inquiry, detail, customer, customerLoading, customerError }: {
  inquiry: InquiryResponse; detail: InquiryDetail; customer?: CustomerDetail; customerLoading: boolean; customerError?: string
}) {
  return <aside aria-label="Status und Kundendaten" className="min-w-0 space-y-5">
    <Card className="rounded-lg shadow-sm">
      <CardHeader className="border-b"><CardTitle className="flex items-center gap-2"><CircleCheckIcon aria-hidden="true" className="size-4 text-muted-foreground" /><h2>Bearbeitungsstatus</h2></CardTitle></CardHeader>
      <CardContent className="space-y-5">
        <TrafficLightBadge status={detail.trafficLight} label="Anfrage" prominent />
        <dl className="space-y-5">
          <OverviewField label="Prüfstatus"><InquiryReviewStatus status={detail.reviewStatus} /></OverviewField>
          <OverviewField label="Prüffortschritt">{detail.confirmedPositions} von {detail.positions.length} Positionen bestätigt{detail.fieldCount ? <span className="mt-1 block text-xs text-muted-foreground">{detail.openFields} von {detail.fieldCount} Feldern noch ungeprüft</span> : null}</OverviewField>
          <OverviewField label="Verarbeitung"><JobStatus job={inquiry.processing_job} matchingStatus={detail.matchingStatus} /></OverviewField>
          <OverviewField label="Hochgeladen am"><time dateTime={inquiry.created_at}>{formatInboxDate(inquiry.created_at)}</time></OverviewField>
        </dl>
      </CardContent>
    </Card>
    <Card className="rounded-lg shadow-sm">
      <CardHeader className="border-b"><CardTitle className="flex items-center gap-2"><Building2Icon aria-hidden="true" className="size-4 text-muted-foreground" /><h2>Kundeninformationen</h2></CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <dl className="space-y-5">
          <OverviewField label="Kunde" emphasis={!!(customer?.name || detail.customerName)}>{customer?.name || detail.customerName}</OverviewField>
          {customer?.name_addition ? <OverviewField label="Namenszusatz">{customer.name_addition}</OverviewField> : null}
          <OverviewField label="Kundennummer">{detail.customerNumber || customer?.customer_number}</OverviewField>
          <OverviewField label="Ort">{detail.customerLocation || (customer ? [customer.postal_code, customer.city, customer.country_name].filter(Boolean).join(' ') : null)}</OverviewField>
          <OverviewField label="Ansprechpartner / Ihr Zeichen" emphasis={!!detail.contactName}>{detail.contactName}</OverviewField>
          <OverviewField label="E-Mail Ansprechpartner">{detail.contactEmail}</OverviewField>
          <OverviewField label="Telefon / weitere Kontaktnummern">{detail.contactPhone || customer?.phone}</OverviewField>
          <OverviewField label="E-Mail-Absender">{detail.sender}</OverviewField>
        </dl>
        {customerLoading ? <p role="status" className="text-xs text-muted-foreground">Kundendaten werden geladen …</p> : null}
        {customerError ? <p role="alert" className="text-xs text-destructive">Kundendaten konnten nicht geladen werden: {customerError}</p> : null}
        {!detail.customerId ? <p className="text-xs text-muted-foreground">Noch kein Kunde eindeutig zugeordnet.</p> : null}
      </CardContent>
    </Card>
  </aside>
}
