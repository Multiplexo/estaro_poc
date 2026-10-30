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

export function ExtractionPanel({ editor: review }: { editor: ReviewEditor }) {
  const { t } = useTranslation()
  const { customerFields, inquiryFields, articleFields } = review.groups
  const { expanded, setExpanded } = useReviewSections(review)
  const customerConfirmed = customerFields.every((entry) => review.fields.value(entry).confirmed)
  const requestConfirmed = inquiryFields.every((entry) => review.fields.value(entry).confirmed)
  const articlesConfirmed = review.positions.length > 0 && review.positions.every((position) => position.confirmed)
  const checked = review.fieldCount - review.openCount
  return <section aria-labelledby="extraction-heading" className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border bg-background">
    <header className="shrink-0 space-y-2 border-b px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="extraction-heading" className="text-base font-semibold">{t('review.heading')}</h2><p className="mt-1 text-sm text-muted-foreground" aria-live="polite">{t('review.progress', { checked, total: review.fieldCount })}</p></div><Button variant="ghost" size="sm" className="min-h-9 text-muted-foreground" onClick={review.nextOpen} disabled={review.openCount === 0}>{t('review.nextField')}<ArrowDown aria-hidden="true" /></Button></div>
      <Progress value={review.fieldCount ? checked / review.fieldCount * 100 : 0} aria-label={t('review.progressLabel')} className="[&_[data-slot=progress-track]]:h-1" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex min-h-8 w-fit cursor-pointer items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={review.fields.onlyOpen} onChange={(event) => review.setOnlyOpen(event.target.checked)} className="size-3.5 accent-primary" />{t('review.onlyOpen')}</label>
        <Button size="sm" variant="outline" disabled={!review.canConfirmAll} onClick={review.confirmAll}><CheckCheck aria-hidden="true" />{t('review.confirmAll')}</Button>
      </div>
    </header>
    <fieldset disabled={review.disabled} className="min-h-0 min-w-0 flex-1 disabled:opacity-70 lg:overflow-y-auto">
      <Accordion value={expanded} onValueChange={(value) => setExpanded(value as string[])} className="gap-5 bg-muted/40 p-3">
        {!review.fields.onlyOpen || !customerConfirmed ? <ReviewSection id="customer" marker={<Building2 className="size-5" />} title={t('review.customerSection')} description={review.fields.value(customerFields[0]).value || t('review.noCustomer')} confirmed={customerConfirmed}
          action={<ReviewGroupAction confirmed={customerConfirmed} disabled={review.disabled} onConfirm={() => review.confirmAndNext(customerFields)} label={t('review.customerData')} />}>
          {review.matchingAvailable ? <InlineMatching kind="customers" selectedId={review.customerId ?? undefined} suggestions={review.customerSuggestions} initialSearch={review.fields.value(customerFields[0]).value} onSelect={(id) => review.selectCustomer(id ?? null)} /> : null}
          <ReviewFieldGroup fields={customerFields} editor={review.fields} />
        </ReviewSection> : null}
        {!review.fields.onlyOpen || !requestConfirmed ? <ReviewSection id="request" marker={<ClipboardList className="size-5" />} title={t('review.requestSection')} description={t('review.requestDescription')} confirmed={requestConfirmed}
          action={<ReviewGroupAction confirmed={requestConfirmed} disabled={review.disabled} onConfirm={() => review.confirmAndNext(inquiryFields)} label={t('review.requestSection')} />}>
          <ReviewFieldGroup fields={inquiryFields} editor={review.fields} />
        </ReviewSection> : null}
        <section aria-labelledby="review-articles-heading" className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/60 px-3 py-2.5"><div className="flex items-center gap-2"><span className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-background"><Package aria-hidden="true" className="size-4" /></span><h3 id="review-articles-heading" className="text-sm font-semibold">{t('review.articles')}</h3><span className="text-xs text-muted-foreground">{t('review.positionCount', { count: review.positions.length })}</span></div><ReviewGroupAction confirmed={articlesConfirmed} disabled={review.disabled || articleFields.length === 0} onConfirm={() => review.confirmAndNext(articleFields)} label={t('review.articles')} /></div>
        <div className="space-y-3 p-2.5">
        {review.positions.map((position) => <ReviewArticle key={position.key} position={position} editor={review.fields} matchingAvailable={review.matchingAvailable} disabled={review.disabled} onSelect={(id) => review.selectArticle(position.key, id)} onConfirm={() => review.confirmAndNext(position.fields)} />)}
        {review.positions.length === 0 ? <p className="p-1 text-sm text-muted-foreground">{t('review.noArticles')}</p> : null}
        </div>
        </section>
      </Accordion>
      {review.fields.onlyOpen && review.openCount === 0 ? <p role="status" className="p-4 text-sm text-muted-foreground">{t('review.allChecked')}</p> : null}
    </fieldset>
  </section>
}
