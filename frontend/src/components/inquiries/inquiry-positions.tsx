import { Package } from 'lucide-react'
import { useTranslation } from '@/i18n'
import { fieldStyles } from '@/lib/inquiry-analysis'
import type { InquiryDetail } from '@/lib/inquiry-detail'
import { OverviewField } from './overview-field'

const specificationKinds = new Set(['material', 'dimensions', 'quantity', 'unit'])

export function InquiryPositions({ detail }: { detail: InquiryDetail }) {
  const { t } = useTranslation()
  return <section aria-labelledby="positions-heading" className="space-y-4">
    <div className="flex items-center gap-2">
      <Package aria-hidden="true" className="size-4 text-muted-foreground" />
      <h2 id="positions-heading" className="text-base font-semibold">{t('overview.positions')}</h2>
      <span className="rounded-md border bg-card px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{detail.positions.length}</span>
    </div>
    {detail.positions.length ? detail.positions.map((position) => {
      const article = position.fields.find((field) => field.kind === 'article')
      return <section key={position.number} aria-label={t('overview.position', { number: position.number })} className="overflow-hidden rounded-xl border bg-card">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b bg-muted/20 px-5 py-4">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-card text-xs font-semibold tabular-nums text-muted-foreground">{position.number}</span>
            <div className="min-w-0">
              <p className="mb-1 text-xs text-muted-foreground">{t('overview.position', { number: position.number })} · {t('fields.article')}</p>
              <h3 className="font-semibold [overflow-wrap:anywhere]">{article?.value || t('inquiries.articleNotSpecified')}</h3>
            </div>
          </div>
        </header>
        <dl className="grid gap-px border-b bg-border @sm:grid-cols-2 @3xl:grid-cols-4">
          {position.fields.filter((field) => specificationKinds.has(field.kind)).map((field) => <div key={field.kind} className="bg-card px-5 py-4">
            <OverviewField label={t(fieldStyles[field.kind].labelKey)} emphasis={!!field.value}>{field.value}</OverviewField>
          </div>)}
        </dl>
        <dl className="grid gap-5 px-5 py-4 @xl:grid-cols-2">
          {position.fields.filter((field) => field.kind !== 'article' && !specificationKinds.has(field.kind)).map((field) => <OverviewField key={field.kind} label={t(fieldStyles[field.kind].labelKey)}>{field.value}</OverviewField>)}
        </dl>
      </section>
    }) : <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">{t('overview.noPositions')}</p>}
  </section>
}
