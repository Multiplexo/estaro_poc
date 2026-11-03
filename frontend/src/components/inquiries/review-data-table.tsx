import { memo } from 'react'
import { Check, RotateCcw } from 'lucide-react'
import { useTranslation } from '@/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { ReviewEditor, ReviewFieldEditor } from '@/hooks/use-inquiry-review'
import { fieldStyles } from '@/lib/inquiry-analysis'
import { reviewFieldInputAttributes } from '@/lib/review-field-input'
import type { InquiryFieldMatch } from '@/lib/generated/Api'
import type { InquiryFieldSource } from '@/lib/inquiry-table-data'
import { AutomaticFieldSource } from './automatic-field-source'

const multilineKinds = new Set(['customer', 'article', 'dimensions', 'requirements', 'alternatives', 'certificates'])

const ReviewDataRow = memo(function ReviewDataRow({ entry, review, selected, onChange, onFocus, onConfirm, onReset, label: fieldLabel, path, automaticMatch, automaticSource }: ReturnType<ReviewFieldEditor['view']> & { label?: string; path?: string; automaticMatch?: InquiryFieldMatch; automaticSource?: InquiryFieldSource }) {
  const { t } = useTranslation()
  const label = fieldLabel ?? t(fieldStyles[entry.kind].labelKey)
  const changed = review.value !== (entry.field.value ?? '')
  const warning = !review.confirmed && (entry.field.status === 'conflict' || entry.field.status === 'unverified')
  const { type, ...attributes } = reviewFieldInputAttributes(entry.kind)
  const inputProps = {
    ...attributes, id: `review-${entry.id}`, name: entry.id, value: review.value, autoComplete: 'off', maxLength: 1000,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value),
    onFocus, placeholder: t('common.notSpecified'), 'aria-describedby': warning ? `status-${entry.id}` : undefined,
    className: 'min-h-9 w-full resize-y bg-background text-base md:text-sm',
  }
  return <TableRow data-automatic-source={automaticSource} className={selected ? 'bg-muted/40' : automaticSource ? 'bg-primary/5' : undefined}>
    <th scope="row" className="px-3 py-3 text-left align-top text-xs font-medium [overflow-wrap:anywhere]"><label htmlFor={`review-${entry.id}`}>{label}</label>
      {path ? <code className="mt-1 block font-normal text-muted-foreground">{path}</code> : null}
      <span className="mt-1 block font-normal text-muted-foreground">{review.confirmed ? t('common.checked') : t('common.open')}</span>
    </th>
    <TableCell className="px-3 align-top whitespace-normal">
      {multilineKinds.has(entry.kind) ? <Textarea {...inputProps} rows={1} /> : <Input {...inputProps} type={type} />}
      {automaticSource ? <AutomaticFieldSource source={automaticSource} match={automaticMatch} /> : null}
      {warning ? <p id={`status-${entry.id}`} className="mt-1 text-xs text-amber-800">{entry.field.status === 'conflict' ? t('review.fieldConflict') : t('review.fieldUnverified')}{entry.field.note ? `: ${entry.field.note}` : ''}</p> : null}
      {changed ? <p className="mt-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">{t('review.original', { value: entry.field.value || t('common.notSpecified') })}</p> : null}
      <div className="mt-1 flex flex-wrap gap-1">
        <Button variant="ghost" size="icon-sm" aria-pressed={review.confirmed} aria-label={t('review.toggleField', { label, action: review.confirmed ? t('review.undoCheck') : t('review.checkedAction') })} onClick={onConfirm} className={review.confirmed ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}><Check aria-hidden="true" /></Button>
        {changed ? <Button variant="ghost" size="icon-sm" aria-label={`${t('review.reset')}: ${label}`} onClick={onReset}><RotateCcw aria-hidden="true" /></Button> : null}
      </div>
    </TableCell>
  </TableRow>
})

export function ReviewDataTable({ editor }: { editor: ReviewEditor }) {
  const sections = editor.tableSections
  return <Table className="table-fixed">
    <TableHeader><TableRow><TableHead scope="col" className="w-[35%]">Feld</TableHead><TableHead scope="col">Wert</TableHead></TableRow></TableHeader>
    {sections.filter((section) => section.fields.length > 0).map((section) => <TableBody key={section.label}>
      <TableRow className="bg-muted/50 hover:bg-muted/50"><th scope="rowgroup" colSpan={2} className="px-3 py-3 text-left text-sm font-semibold">{section.label}</th></TableRow>
      {section.fields.map((field) => { const entry = editor.tableFields.get(field.fieldId); return entry ? <ReviewDataRow key={field.id} {...editor.fields.view(entry)} label={field.label} path={field.id} automaticMatch={field.automaticMatch} automaticSource={field.automaticSource} /> : <TableRow key={field.id} data-automatic-source={field.automaticSource} className={field.automaticSource ? 'bg-primary/5' : undefined}><th scope="row" className="px-3 py-3 text-left font-medium">{field.label}</th><TableCell>{field.value ?? 'Nicht angegeben'}{field.automaticSource ? <AutomaticFieldSource source={field.automaticSource} match={field.automaticMatch} /> : null}</TableCell></TableRow> })}
    </TableBody>)}
  </Table>
}
