import { Link } from '@tanstack/react-router'
import { ArrowDownAZ } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TablePageSpacer } from '@/components/table-page-spacer'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { DeleteInquiryController } from '@/hooks/use-delete-inquiry'
import type { InquiryInboxController } from '@/hooks/use-inquiry-inbox'
import { PAGE_SIZE } from '@/hooks/use-inquiries'
import type { InboxInquiry } from '@/lib/inquiry-overview'
import { InquiryReviewStatus, InquiryScore } from './inquiry-overview-badges'
import { InquiryDeliveryDate, InquiryEmail, InquiryReceivedAt } from './inquiry-overview-fields'

export function InquiryTable({ inquiries, deletion, inbox }: { inquiries: InboxInquiry[]; deletion: DeleteInquiryController; inbox: InquiryInboxController }) {
  return <div className="overflow-hidden rounded-lg border">
    <Table className="min-w-[1360px] table-fixed">
      <TableCaption className="sr-only">Fertig verarbeitete Anfragen</TableCaption>
      <colgroup>
        <col className="w-[23%]" /><col className="w-[19%]" /><col className="w-[13%]" /><col className="w-[15%]" /><col className="w-[13%]" /><col className="w-[10%]" /><col className="w-[7%]" />
      </colgroup>
      <TableHeader className="bg-muted/40 text-foreground [&_tr]:border-border [&_tr:hover]:bg-transparent">
        <TableRow>
          <TableHead aria-sort={inbox.sort === 'customer' ? 'ascending' : 'none'}><Button variant="ghost" size="sm" onClick={() => inbox.setSort('customer')}>Kunde<ArrowDownAZ /></Button></TableHead>
          <TableHead>E-Mail</TableHead><TableHead>E-Mail-Eingang</TableHead><TableHead>Liefertermin</TableHead><TableHead>Ampel</TableHead><TableHead>Status</TableHead>
          <TableHead className="text-right">Aktionen</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>{inquiries.map((inquiry) => <TableRow key={inquiry.id} className="h-[88px]">
        <TableCell className="overflow-hidden py-4"><Link to="/anfragen/$inquiryId" params={{ inquiryId: inquiry.id }} className="block truncate font-medium hover:underline" title={inquiry.title}>{inquiry.title}</Link><p className="mt-1 truncate text-xs text-muted-foreground" title={inquiry.description}>{inquiry.description}</p></TableCell>
        <TableCell className="truncate" title={inquiry.email ?? undefined}><InquiryEmail value={inquiry.email} /></TableCell>
        <TableCell><InquiryReceivedAt inquiry={inquiry} /></TableCell>
        <TableCell title={inquiry.deliveryDate ?? undefined}><div className="max-h-10 overflow-hidden whitespace-normal break-words"><InquiryDeliveryDate value={inquiry.deliveryDate} /></div></TableCell>
        <TableCell><InquiryScore inquiry={inquiry} /></TableCell>
        <TableCell><InquiryReviewStatus status={inquiry.review_status} /></TableCell>
        <TableCell className="text-right"><Button variant="ghost" size="sm" disabled={inbox.query.isPlaceholderData || inbox.waiting || deletion.isPending} aria-label={`Anfrage von ${inquiry.title} löschen`} onClick={(event) => deletion.selectInquiry(inquiry, event.currentTarget)}>Löschen</Button></TableCell>
      </TableRow>)}<TablePageSpacer pageSize={PAGE_SIZE} total={inbox.query.data?.total ?? inquiries.length} rowCount={inquiries.length} rowHeight={88} colSpan={7} /></TableBody>
    </Table>
  </div>
}
