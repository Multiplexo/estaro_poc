import { useTranslation } from '@/i18n'
import { ArrowDown, Building2, CheckCheck, ClipboardList, Package } from 'lucide-react'
import { Accordion } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import type { ReviewEditor } from '@/hooks/use-inquiry-review'
import { useReviewSections } from '@/hooks/use-review-sections'
import { InlineMatching } from './inline-matching'
import { ReviewArticle } from './review-article'
import { ReviewFieldGroup } from './review-field-group'
import { ReviewGroupAction } from './review-group-action'
import { ReviewSection } from './review-section'
import { TrafficLightBadge } from './traffic-light-badge'

export function ExtractionPanel({ editor: review }: { editor: ReviewEditor }) {
  const { t } = useTranslation()
  const { customerFields, inquiryFields, articleFields } = review.groups
  const { expanded, setExpanded } = useReviewSections(review)
  const customerConfirmed = customerFields.every((entry) => review.fields.value(entry).confirmed)
  const requestConfirmed = inquiryFields.every((entry) => review.fields.value(entry).confirmed)
  const articlesConfirmed = review.positions.length > 0 && review.positions.every((position) => position.confirmed)
  const checked = review.fieldCount - review.openCount
  return <section aria-labelledby="extraction-heading" className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border bg-background">
    <header className="shrink-0 space-y-3 border-b p-4">
      <TrafficLightBadge status={review.trafficLight} label={t('review.title')} prominent showDetails={false} />
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="extraction-heading" className="text-base font-semibold">{t('review.heading')}</h2><p className="mt-1 text-sm text-muted-foreground" aria-live="polite">{t('review.progress', { checked, total: review.fieldCount })}</p></div><Button variant="ghost" size="sm" className="min-h-9 text-muted-foreground" onClick={review.nextOpen} disabled={review.openCount === 0}>{t('review.nextField')}<ArrowDown aria-hidden="true" /></Button></div>
      <Progress value={review.fieldCount ? checked / review.fieldCount * 100 : 0} aria-label={t('review.progressLabel')} className="[&_[data-slot=progress-indicator]]:bg-blue-600 [&_[data-slot=progress-track]]:h-1.5 [&_[data-slot=progress-track]]:bg-blue-100" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex min-h-8 w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={review.fields.onlyOpen} onChange={(event) => review.setOnlyOpen(event.target.checked)} className="size-4 accent-blue-600" />{t('review.onlyOpen')}</label>
        <Button variant="outline" className="min-h-10" disabled={!review.canConfirmAll} onClick={review.confirmAll}><CheckCheck aria-hidden="true" />{t('review.confirmAll')}</Button>
      </div>
      <p className="text-xs text-muted-foreground">{t('review.confirmHint')}</p>
    </header>
    <fieldset disabled={review.disabled} className="min-h-0 min-w-0 flex-1 disabled:opacity-70 lg:overflow-y-auto">
      <Accordion value={expanded} onValueChange={(value) => setExpanded(value as string[])} className="gap-5 bg-muted p-4">
        {!review.fields.onlyOpen || !customerConfirmed ? <ReviewSection id="customer" marker={<Building2 className="size-5" />} title={t('review.customerSection')} description={review.fields.value(customerFields[0]).value || t('review.noCustomer')} confirmed={customerConfirmed}
          action={<ReviewGroupAction confirmed={customerConfirmed} disabled={review.disabled} onConfirm={() => review.confirmAndNext(customerFields)} label={t('review.customerData')} />}>
          <InlineMatching kind="customers" selectedId={review.customerId ?? undefined} suggestions={review.customerSuggestions} initialSearch={review.fields.value(customerFields[0]).value} onSelect={(id) => review.selectCustomer(id ?? null)} />
          <ReviewFieldGroup fields={customerFields} editor={review.fields} />
        </ReviewSection> : null}
        {!review.fields.onlyOpen || !requestConfirmed ? <ReviewSection id="request" marker={<ClipboardList className="size-5" />} title={t('review.requestSection')} description={t('review.requestDescription')} confirmed={requestConfirmed}
          action={<ReviewGroupAction confirmed={requestConfirmed} disabled={review.disabled} onConfirm={() => review.confirmAndNext(inquiryFields)} label={t('review.requestSection')} />}>
          <ReviewFieldGroup fields={inquiryFields} editor={review.fields} />
        </ReviewSection> : null}
        <section aria-labelledby="review-articles-heading" className="mt-2 space-y-5 rounded-xl border-2 border-border bg-background/50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 px-1 pt-1 pb-4"><div className="flex items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-foreground text-background"><Package aria-hidden="true" className="size-5" /></span><div><h3 id="review-articles-heading" className="text-lg font-bold">{t('review.articles')}</h3><p className="text-sm text-muted-foreground">{t('review.positionCount', { count: review.positions.length })}</p></div></div><ReviewGroupAction confirmed={articlesConfirmed} disabled={review.disabled || articleFields.length === 0} onConfirm={() => review.confirmAndNext(articleFields)} label={t('review.articles')} /></div>
        {review.positions.map((position) => <ReviewArticle key={position.key} position={position} editor={review.fields} disabled={review.disabled} onSelect={(id) => review.selectArticle(position.key, id)} onConfirm={() => review.confirmAndNext(position.fields)} />)}
        {review.positions.length === 0 ? <p className="p-1 text-sm text-muted-foreground">{t('review.noArticles')}</p> : null}
        </section>
      </Accordion>
      {review.fields.onlyOpen && review.openCount === 0 ? <p role="status" className="p-4 text-sm text-muted-foreground">{t('review.allChecked')}</p> : null}
    </fieldset>
  </section>
}
