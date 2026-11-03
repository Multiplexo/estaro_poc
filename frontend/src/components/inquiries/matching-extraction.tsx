import { FileText } from 'lucide-react'
import { useTranslation } from '@/i18n'
import { customerFieldKinds, fieldStyles, itemFieldKinds, type FieldKind } from '@/lib/inquiry-analysis'
import type { ExtractionResult, VerifiedField } from '@/lib/inquiry-models'

interface ExtractionEntry {
  kind: FieldKind
  field: VerifiedField
}

const additionalKinds = new Set<FieldKind>(['requirements', 'alternatives', 'certificates'])

function ExtractionValues({ entries }: { entries: ExtractionEntry[] }) {
  const { t } = useTranslation()
  return <dl className="grid gap-4">
    {entries.map(({ kind, field }) => <div key={kind} className="min-w-0">
      <dt className="text-xs text-muted-foreground">{t(fieldStyles[kind].labelKey)}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere]">{field.value || <span className="text-muted-foreground">{t('common.notSpecified')}</span>}</dd>
      {field.status === 'conflict' || field.status === 'unverified' ? <dd className="mt-1 text-xs text-amber-800 dark:text-amber-300">{t(field.status === 'conflict' ? 'review.fieldConflict' : 'review.fieldUnverified')}{field.note ? `: ${field.note}` : ''}</dd> : null}
    </div>)}
  </dl>
}

export function MatchingExtraction({ extraction, positionIndex }: { extraction: ExtractionResult; positionIndex?: number }) {
  const item = positionIndex === undefined ? undefined : extraction.items[positionIndex]
  const entries: ExtractionEntry[] = positionIndex === undefined
    ? customerFieldKinds.flatMap((kind) => extraction[kind] ? [{ kind, field: extraction[kind] }] : [])
    : item ? itemFieldKinds.map((kind) => ({ kind, field: item[kind] })) : []
  const primary = entries.filter(({ kind, field }) => !additionalKinds.has(kind) || field.status === 'conflict' || field.status === 'unverified')
  const additional = entries.filter(({ kind, field }) => additionalKinds.has(kind) && field.status !== 'conflict' && field.status !== 'unverified' && !!field.value)

  return <section aria-labelledby="matching-extraction-heading" className="min-w-0 rounded-lg border bg-muted/25 p-4">
    <h4 id="matching-extraction-heading" className="flex items-center gap-2 text-sm font-semibold"><FileText aria-hidden="true" className="size-4 text-muted-foreground" />Aus der Extraktion</h4>
    <p className="mt-1 mb-5 text-xs leading-5 text-muted-foreground">Ursprüngliche Angaben aus der Anfrage.</p>
    {primary.length ? <ExtractionValues entries={primary} /> : <p className="text-sm text-muted-foreground">Keine extrahierten Angaben vorhanden.</p>}
    {additional.length ? <details className="mt-4 border-t pt-3 text-sm">
      <summary className="cursor-pointer text-xs text-muted-foreground">Weitere Angaben ({additional.length})</summary>
      <div className="pt-4"><ExtractionValues entries={additional} /></div>
    </details> : null}
  </section>
}
