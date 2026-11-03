import { useTranslation } from '@/i18n'
import { memo, type MouseEvent } from 'react'
import { Check, ExternalLink, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { ReviewedField } from '@/lib/inquiry-models'
import { fieldStyles, keyFieldKinds, type AnalysisField, type Highlight } from '@/lib/inquiry-analysis'
import { reviewFieldInputAttributes } from '@/lib/review-field-input'

const multilineKinds = new Set(['customer', 'article', 'dimensions', 'requirements', 'alternatives', 'certificates'])
const wideKinds = new Set(['requirements', 'alternatives', 'certificates'])

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
    className: `h-auto min-h-8 max-h-40 resize-none scroll-mt-8 scroll-mb-8 rounded-md bg-background px-2 py-1.5 text-base shadow-none md:text-sm ${keyField ? 'font-medium' : ''}`,
  }
  return <div onClick={focusFieldFromCard} className={`min-w-0 cursor-text rounded-lg border p-2 ${wideKinds.has(kind) ? '@min-[24rem]:col-span-2' : ''} ${warning ? 'border-amber-300 bg-amber-50/40 dark:bg-amber-950/20' : 'border-transparent'} ${selected ? 'bg-muted/30 ring-1 ring-ring' : ''}`}>
    <div className="mb-1 flex min-h-7 items-center justify-between gap-1">
      <label htmlFor={`review-${id}`} className="min-w-0 text-xs font-medium text-muted-foreground">{label}</label>
      <span role={review.confirmed ? 'status' : undefined} className="sr-only">{review.confirmed ? t('common.checked') : warning ? t('common.pleaseCheck') : t('common.open')}</span>
      <div className="flex shrink-0 items-center">
        {highlights[0] ? <Button variant="ghost" size="icon-sm" className="text-muted-foreground" onClick={() => onSelect(highlights[0])} title={`${highlights[0].source.filename}: ${highlights[0].source.quote}`} aria-label={t('review.showSource', { label })}><ExternalLink className="size-3.5" aria-hidden="true" /></Button> : null}
        <Button variant="ghost" size="icon-sm" aria-pressed={review.confirmed} aria-label={t('review.toggleField', { label, action: review.confirmed ? t('review.undoCheck') : t('review.checkedAction') })} title={review.confirmed ? t('review.undoCheck') : t('review.confirmField')} onClick={onConfirm} className={review.confirmed ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}><span className={`flex size-4 items-center justify-center rounded-full border ${review.confirmed ? 'border-primary bg-primary text-primary-foreground' : 'border-current'}`}><Check className="size-3" aria-hidden="true" /></span></Button>
      </div>
    </div>
    <div className="min-w-0">{multilineKinds.has(kind) ? <Textarea {...inputProps} rows={1} /> : <Input {...inputProps} type={type} />}</div>
    {status ? <p id={`status-${id}`} className={`mt-1 text-sm ${warning ? 'text-amber-800' : 'text-muted-foreground'}`}>{status}{warning && field.note ? `: ${field.note}` : ''}</p> : null}
    {changed || highlights.length > 0 ? <details className="mt-1 text-sm text-muted-foreground"><summary className="w-fit cursor-pointer py-1">{changed ? t('review.originalAndSources') : t('review.sources', { count: highlights.length })}</summary>
      {changed ? <div className="flex flex-wrap items-center gap-2 py-2"><span>{t('review.original', { value: field.value || t('common.notSpecified') })}</span><Button variant="ghost" size="sm" onClick={onReset}><RotateCcw aria-hidden="true" />{t('review.reset')}</Button></div> : null}
      {highlights.length === 0 ? <p className="py-2">{t('review.noSource')}</p> : highlights.map((highlight) => <button key={highlight.id} type="button" onClick={() => onSelect(highlight)} aria-pressed={active?.id === highlight.id} className="my-2 block w-full rounded-md border bg-background p-2 text-left hover:bg-muted"><span className="font-medium">{highlight.source.page ? t('review.sourcePage', { filename: highlight.source.filename, page: highlight.source.page }) : t('review.sourceEmail', { filename: highlight.source.filename })}</span><q className="mt-1 block whitespace-pre-wrap break-words">{highlight.source.quote}</q></button>)}
    </details> : null}
  </div>
})
