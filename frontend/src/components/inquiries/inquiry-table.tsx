import { useTranslation } from '@/i18n'
import { Link } from '@tanstack/react-router'
import { ArrowDownAZ } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TablePageSpacer } from '@/components/table-page-spacer'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { DeleteInquiryController } from '@/hooks/use-delete-inquiry'
import type { InquiryInboxController } from '@/hooks/use-inquiry-inbox'
import { PAGE_SIZE, type InboxInquiry } from '@/lib/inquiry-overview'
import { InquiryScore } from './inquiry-overview-badges'
import { InquiryDeliveryDate, InquiryEmail, InquiryReceivedAt } from './inquiry-overview-fields'

export function InquiryTable({ inquiries, deletion, inbox }: { inquiries: InboxInquiry[]; deletion: DeleteInquiryController; inbox: InquiryInboxController }) {
  const { t } = useTranslation()
  return <div className="overflow-hidden">
    <Table className="min-w-[1100px] table-fixed">
      <TableCaption className="sr-only">{t('inquiries.processedCaption')}</TableCaption>
      <colgroup>
        <col className="w-[26%]" /><col className="w-[22%]" /><col className="w-[14%]" /><col className="w-[17%]" /><col className="w-[13%]" /><col className="w-[8%]" />
      </colgroup>
      <TableHeader className="bg-muted/40 text-foreground [&_tr]:border-border [&_tr:hover]:bg-transparent">
        <TableRow>
          <TableHead aria-sort={inbox.sort === 'customer' ? 'ascending' : 'none'}><Button variant="ghost" size="sm" onClick={() => inbox.setSort('customer')}>{t('fields.customer')}<ArrowDownAZ /></Button></TableHead>
          <TableHead>{t('source.email')}</TableHead><TableHead>{t('inquiries.emailReceivedAt')}</TableHead><TableHead>{t('fields.delivery_date')}</TableHead><TableHead>{t('traffic.shortHeading')}</TableHead>
          <TableHead className="text-right">{t('common.actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>{inquiries.map((inquiry) => <TableRow key={inquiry.id} className="h-[72px]">
        <TableCell className="overflow-hidden py-4"><Link to="/anfragen/$inquiryId" params={{ inquiryId: inquiry.id }} className="block truncate font-medium hover:underline" title={inquiry.title}>{inquiry.title}</Link><p className="mt-1 truncate text-xs text-muted-foreground" title={inquiry.description}>{inquiry.description}</p></TableCell>
        <TableCell className="truncate" title={inquiry.email ?? undefined}><InquiryEmail value={inquiry.email} /></TableCell>
        <TableCell><InquiryReceivedAt inquiry={inquiry} /></TableCell>
        <TableCell title={inquiry.deliveryDate ?? undefined}><div className="max-h-10 overflow-hidden whitespace-normal break-words"><InquiryDeliveryDate value={inquiry.deliveryDate} /></div></TableCell>
        <TableCell><InquiryScore inquiry={inquiry} compact /></TableCell>
        <TableCell className="text-right"><Button variant="ghost" size="sm" disabled={inbox.query.isPlaceholderData || inbox.waiting || deletion.isPending} aria-label={t('inquiries.deleteLabel', { title: inquiry.title })} onClick={(event) => deletion.selectInquiry(inquiry, event.currentTarget)}>{t('common.delete')}</Button></TableCell>
      </TableRow>)}<TablePageSpacer pageSize={PAGE_SIZE} total={inbox.query.data?.total ?? inquiries.length} rowCount={inquiries.length} rowHeight={72} colSpan={6} /></TableBody>
    </Table>
  </div>
}
