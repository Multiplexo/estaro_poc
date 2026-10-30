import { useTranslation } from '@/i18n'
import { memo, type MouseEvent } from 'react'
import { Check, ExternalLink, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { ReviewedField } from '@/lib/inquiry-models'
import { fieldStyles, keyFieldKinds, type AnalysisField, type Highlight } from '@/lib/inquiry-analysis'
import { reviewFieldInputAttributes } from '@/lib/review-field-input'

const multilineKinds = new Set(['customer', 'article', 'dimensions', 'requirements', 'alternatives', 'certificates'])

function focusFieldFromCard(event: MouseEvent<HTMLDivElement>) {
  if (!(event.target instanceof Element) || event.target.closest('input, textarea, button, a, summary, label')) return
  event.currentTarget.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea')?.focus({ preventScroll: true })
}

export const ExtractedField = memo(function ExtractedField({ entry, highlights, active, selected, review, onSelect, onChange, onFocus, onConfirm, onReset }: {
  entry: AnalysisField; highlights: Highlight[]; active?: Highlight; selected?: boolean; review: ReviewedField;
  onSelect: (highlight: Highlight) => void; onChange: (value: string) => void; onFocus: () => void; onConfirm: () => void; onReset: () => void
}) {
  const { t } = useTranslation()
  const { field, kind, id } = entry
  const label = t(fieldStyles[kind].labelKey)
  const keyField = keyFieldKinds.has(kind)
  const changed = review.value !== (field.value ?? '')
  const warning = !review.confirmed && (field.status === 'conflict' || field.status === 'unverified')
  const status = warning ? (field.status === 'conflict' ? t('review.fieldConflict') : t('review.fieldUnverified')) : changed ? t('review.fieldChanged') : undefined
  const { type, ...fieldInputAttributes } = reviewFieldInputAttributes(kind)
  const inputProps = {
    ...fieldInputAttributes,
    id: `review-${id}`, name: id, autoComplete: 'off', value: review.value, maxLength: 1000,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value),
    onFocus, 'aria-describedby': status ? `status-${id}` : undefined, placeholder: t('common.notSpecified'),
    className: `min-h-10 max-h-40 resize-none scroll-mt-8 scroll-mb-8 rounded-md bg-background px-3 shadow-none focus-visible:border-blue-500 focus-visible:ring-blue-100 ${keyField ? 'text-base font-medium md:text-base' : 'text-base md:text-base'}`,
  }
  return <div onClick={focusFieldFromCard} className={`min-w-0 cursor-text rounded-lg border border-l-4 bg-background p-3 shadow-xs transition-shadow hover:shadow-md ${multilineKinds.has(kind) || kind === 'contact_name' || kind === 'contact_email' || kind === 'contact_phone' ? '@min-[28rem]:col-span-2' : ''} ${review.confirmed ? 'border-l-blue-600' : warning ? 'border-l-amber-500' : 'border-l-border'} ${selected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}>
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <label htmlFor={`review-${id}`} className="text-sm font-semibold">{label}</label>
      <Badge role={review.confirmed ? 'status' : undefined} variant="secondary" className={review.confirmed ? 'bg-blue-50 text-blue-800' : warning ? 'bg-amber-50 text-amber-900' : 'text-muted-foreground'}>{review.confirmed ? t('common.checked') : warning ? t('common.pleaseCheck') : t('common.open')}</Badge>
    </div>
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-1">
      <div className="min-w-0">{multilineKinds.has(kind) ? <Textarea {...inputProps} rows={1} /> : <Input {...inputProps} type={type} />}</div>
      <div className="flex items-center gap-0.5">
        {highlights[0] ? <Button variant="ghost" size="icon" className="size-9 text-muted-foreground" onClick={() => onSelect(highlights[0])} title={`${highlights[0].source.filename}: ${highlights[0].source.quote}`} aria-label={t('review.showSource', { label })}><ExternalLink className="size-3.5" aria-hidden="true" /></Button> : null}
        <Button variant="ghost" size="icon" aria-pressed={review.confirmed} aria-label={t('review.toggleField', { label, action: review.confirmed ? t('review.undoCheck') : t('review.checkedAction') })} title={review.confirmed ? t('review.undoCheck') : t('review.confirmField')} onClick={onConfirm} className={`size-9 ${review.confirmed ? 'text-blue-700' : 'text-muted-foreground hover:text-blue-700'}`}><span className={`flex size-5 items-center justify-center rounded-full border ${review.confirmed ? 'border-blue-600 bg-blue-600 text-white' : 'border-current'}`}><Check className="size-3" aria-hidden="true" /></span></Button>
      </div>
    </div>
    {status ? <p id={`status-${id}`} className={`mt-1 text-sm ${warning ? 'text-amber-800' : 'text-muted-foreground'}`}>{status}{warning && field.note ? `: ${field.note}` : ''}</p> : null}
    {changed || (selected && highlights.length > 0) ? <details className="mt-1 text-sm text-muted-foreground"><summary className="w-fit cursor-pointer py-1">{changed ? t('review.originalAndSources') : t('review.sources', { count: highlights.length })}</summary>
      {changed ? <div className="flex flex-wrap items-center gap-2 py-2"><span>{t('review.original', { value: field.value || t('common.notSpecified') })}</span><Button variant="ghost" size="sm" onClick={onReset}><RotateCcw aria-hidden="true" />{t('review.reset')}</Button></div> : null}
      {highlights.length === 0 ? <p className="py-2">{t('review.noSource')}</p> : highlights.map((highlight) => <button key={highlight.id} type="button" onClick={() => onSelect(highlight)} aria-pressed={active?.id === highlight.id} className="my-2 block w-full rounded-md border bg-background p-2 text-left hover:bg-muted"><span className="font-medium">{highlight.source.page ? t('review.sourcePage', { filename: highlight.source.filename, page: highlight.source.page }) : t('review.sourceEmail', { filename: highlight.source.filename })}</span><q className="mt-1 block whitespace-pre-wrap break-words">{highlight.source.quote}</q></button>)}
    </details> : null}
  </div>
})
