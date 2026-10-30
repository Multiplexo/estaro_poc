import { useMemo } from 'react'
import { SourcePanel } from './source-panel'
import { useSourceNavigation } from '@/hooks/use-source-navigation'
import { analysisFields, fieldHighlights, fieldStyles } from '@/lib/inquiry-analysis'
import { reviewFieldGroups } from '@/lib/inquiry-review'
import type { AnalysisResponse, ExtractionResult } from '@/lib/inquiry-models'
import { useTranslation } from '@/i18n'

export function InquiryWorkspace({ inquiryId, analysis }: {
  inquiryId: string; analysis: AnalysisResponse & { extraction: ExtractionResult }
}) {
  const { t } = useTranslation()
  const fields = useMemo(() => analysisFields(analysis.extraction), [analysis.extraction])
  const highlights = useMemo(() => fieldHighlights(fields), [fields])
  const groups = useMemo(() => reviewFieldGroups(fields), [fields])
  const navigation = useSourceNavigation(analysis.sources ?? [], highlights)
  const sections = [
    { id: 'customer', title: 'Kunde und Kontakt', fields: groups.customerFields },
    { id: 'request', title: 'Anfragedaten', fields: groups.inquiryFields },
    ...groups.positions.map((position) => ({ id: position.key, title: `Position ${position.index + 1}`, fields: position.fields })),
  ]
  return <div className="flex min-h-0 flex-1 flex-col gap-3">
    <p role="status" className="text-sm text-muted-foreground">Extrahierte Angaben sind schreibgeschützt. Eine manuelle Prüfung kann derzeit nicht gespeichert werden.</p>
    <div className="grid min-h-0 min-w-0 flex-1 gap-4 lg:grid-cols-2">
      <section aria-label="Extrahierte Angaben" className="min-h-0 min-w-0 space-y-4 overflow-y-auto rounded-xl border bg-background p-4">
        {sections.map((section) => <section key={section.id} className="space-y-3">
          <h2 className="text-lg font-semibold">{section.title}</h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            {section.fields.map(({ id, kind, field }) => <div key={id} className="min-w-0 rounded-lg border p-3">
              <dt className="text-sm font-medium">{t(fieldStyles[kind].labelKey)}</dt>
              <dd className="mt-1 whitespace-pre-wrap break-words">{field.value || 'Nicht angegeben'}</dd>
              {field.status === 'conflict' ? <p className="mt-1 text-sm text-amber-800">Widersprüchliche Angaben</p> : null}
              {field.note ? <p className="mt-1 text-sm text-muted-foreground">{field.note}</p> : null}
              {highlights.filter((highlight) => highlight.fieldId === id).map((highlight) => <button
                key={highlight.id} type="button" onClick={() => navigation.selectHighlight(highlight)}
                className="mt-2 block text-left text-xs text-orange-800 underline underline-offset-4">
                {highlight.source.filename}{highlight.source.page ? ` · Seite ${highlight.source.page}` : ''}: „{highlight.source.quote}“
              </button>)}
            </div>)}
          </dl>
        </section>)}
      </section>
      <SourcePanel inquiryId={inquiryId} sources={analysis.sources ?? []} highlights={highlights} navigation={navigation} />
    </div>
  </div>
}
