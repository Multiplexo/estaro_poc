import { useTranslation } from '@/i18n'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { InquiryDetail } from '@/lib/inquiry-detail'
import { inquiryTableSections } from '@/lib/inquiry-table-data'
import { AutomaticFieldSource } from './automatic-field-source'

export function InquiryDataTable({ detail }: { detail: InquiryDetail }) {
  const { t } = useTranslation()
  const sections = inquiryTableSections(detail, t)
  return <section aria-label={t('inquiries.allData')} className="overflow-hidden rounded-xl border bg-card">
    <Table className="table-fixed">
      <TableHeader><TableRow><TableHead className="w-[42%]" scope="col">{t('table.field')}</TableHead><TableHead scope="col">{t('table.value')}</TableHead></TableRow></TableHeader>
      {sections.map((section) => <TableBody key={section.label}>
        <TableRow className="bg-muted/50 hover:bg-muted/50"><th colSpan={2} scope="rowgroup" className="px-4 py-3 text-left text-sm font-semibold">{section.label}</th></TableRow>
        {section.fields.map((field) => <TableRow key={field.id} data-automatic-source={field.automaticSource} className={field.automaticSource ? 'bg-primary/5' : undefined}>
          <th scope="row" className="px-4 py-3 text-left align-top font-medium [overflow-wrap:anywhere]">{field.label}<code className="mt-1 block text-xs font-normal text-muted-foreground">{field.id}</code></th>
          <TableCell className="align-top whitespace-pre-wrap [overflow-wrap:anywhere]">{field.value ?? <span className="text-muted-foreground">{t('common.notSpecified')}</span>}
            {field.automaticSource ? <AutomaticFieldSource source={field.automaticSource} match={field.automaticMatch} /> : null}
          </TableCell>
        </TableRow>)}
      </TableBody>)}
    </Table>
    {detail.positionData.length === 0 ? <p className="border-t px-4 py-3 text-sm text-muted-foreground">{t('inquiries.noPositionData')}</p> : null}
  </section>
}
