import { useState, type ReactNode } from 'react'
import { Building2, CheckCheck, ClipboardList, Package, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { Accordion } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import type { ReviewEditor } from '@/hooks/use-inquiry-review'
import { useReviewSections } from '@/hooks/use-review-sections'
import { useTranslation } from '@/i18n'
import { InquiryViewTabs } from './inquiry-view-tabs'
import { InlineMatching } from './inline-matching'
import { ReviewArticle } from './review-article'
import { ReviewDataTable } from './review-data-table'
import { ReviewFieldGroup } from './review-field-group'
import { ReviewGroupAction } from './review-group-action'
import { ReviewSection } from './review-section'

export function ExtractionPanel({ editor: review, view: controlledView, onViewChange, showPdf = false, onTogglePdf, matchingPanel }: { editor: ReviewEditor; view?: 'overview' | 'matching' | 'table'; onViewChange?: (view: 'overview' | 'matching' | 'table') => void; showPdf?: boolean; onTogglePdf?: () => void; matchingPanel?: ReactNode }) {
  const { t } = useTranslation()
  const [localView, setLocalView] = useState<'overview' | 'matching' | 'table'>('overview')
  const view = controlledView ?? localView
  const setView = onViewChange ?? setLocalView
  const { customerFields, inquiryFields, articleFields } = review.groups
  const { expanded, setExpanded } = useReviewSections(review)
  const customerConfirmed = customerFields.every((entry) => review.fields.value(entry).confirmed)
  const requestConfirmed = inquiryFields.every((entry) => review.fields.value(entry).confirmed)
  const articlesConfirmed = review.positions.length > 0 && review.positions.every((position) => position.confirmed)
  const checked = review.fieldCount - review.openCount
  const visiblePositions = review.fields.onlyOpen ? review.positions.filter((position) => !position.confirmed) : review.positions

  return <section aria-label={t('review.heading')} className="@container flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border bg-card">
    <Tabs value={view} onValueChange={(value) => setView(value as 'overview' | 'matching' | 'table')} className="min-h-0 flex-1 gap-0">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-2 border-b px-3 py-1.5">
        <InquiryViewTabs review />
        {onTogglePdf ? <Button variant="ghost" size="sm" className="h-10 text-muted-foreground" aria-label={showPdf ? t('source.hideOriginal') : t('source.showOriginal')} title={showPdf ? t('source.hideOriginal') : t('source.showOriginal')} aria-pressed={showPdf} onClick={onTogglePdf}>
          {showPdf ? <PanelRightClose aria-hidden="true" /> : <PanelRightOpen aria-hidden="true" />}<span className="hidden @min-[36rem]:inline">{t('source.originalLabel')}</span>
        </Button> : null}
      </header>
      {view !== 'matching' ? <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted-foreground tabular-nums" aria-live="polite">{t('review.progress', { checked, total: review.fieldCount })}</p>
          <Progress value={review.fieldCount ? checked / review.fieldCount * 100 : 0} aria-label={t('review.progressLabel')} className="w-16" />
        </div>
        <Button size="sm" variant="outline" className="h-10" disabled={!review.canConfirmAll} onClick={review.confirmAll}><CheckCheck aria-hidden="true" />{t('review.confirmAll')}</Button>
      </div> : null}
      <fieldset disabled={review.disabled} className="min-h-0 min-w-0 flex-1 disabled:opacity-70 lg:overflow-y-auto lg:[scrollbar-gutter:stable]">
        <TabsContent value="overview">
          {view === 'overview' ? <Accordion value={expanded} onValueChange={(value) => setExpanded(value as string[])} className="gap-3 bg-muted/20 p-4">
            {!review.fields.onlyOpen || !customerConfirmed ? <ReviewSection id="customer" marker={<Building2 />} title={t('review.customerSection')} description={review.fields.value(customerFields[0]).value || t('review.noCustomer')} confirmed={customerConfirmed}
              action={<ReviewGroupAction confirmed={customerConfirmed} disabled={review.disabled} onConfirm={() => review.confirmAndNext(customerFields)} label={t('review.customerData')} />}>
              <ReviewFieldGroup fields={customerFields} editor={review.fields} />
              {review.matchingAvailable ? <details className="border-t text-sm"><summary className="cursor-pointer px-5 py-3 text-muted-foreground">{t('matching.customers')}</summary><InlineMatching kind="customers" selectedId={review.customerId ?? undefined} suggestions={review.customerSuggestions} initialSearch={review.fields.value(customerFields[0]).value} onSelect={(id) => review.selectCustomer(id ?? null)} /></details> : null}
            </ReviewSection> : null}
            {!review.fields.onlyOpen || !requestConfirmed ? <ReviewSection id="request" marker={<ClipboardList />} title={t('review.requestSection')} description={t('review.requestDescription')} confirmed={requestConfirmed}
              action={<ReviewGroupAction confirmed={requestConfirmed} disabled={review.disabled} onConfirm={() => review.confirmAndNext(inquiryFields)} label={t('review.requestSection')} />}>
              <ReviewFieldGroup fields={inquiryFields} editor={review.fields} />
            </ReviewSection> : null}
            {visiblePositions.length > 0 || !review.fields.onlyOpen ? <section aria-labelledby="review-articles-heading" className="mt-3 min-w-0">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2"><Package aria-hidden="true" className="size-4 text-muted-foreground" /><h3 id="review-articles-heading" className="text-sm font-semibold">{t('review.articles')}</h3><span className="text-xs text-muted-foreground">{t('review.positionCount', { count: visiblePositions.length })}</span></div>
                <ReviewGroupAction confirmed={articlesConfirmed} disabled={review.disabled || articleFields.length === 0} onConfirm={() => review.confirmAndNext(articleFields)} label={t('review.articles')} />
              </div>
              <div className="space-y-3">
                {visiblePositions.map((position) => <ReviewArticle key={position.key} position={position} editor={review.fields} matchingAvailable={review.matchingAvailable} disabled={review.disabled} onSelect={(id) => review.selectArticle(position.key, id)} onConfirm={() => review.confirmAndNext(position.fields)} />)}
                {review.positions.length === 0 ? <p className="px-1 text-sm text-muted-foreground">{t('review.noArticles')}</p> : null}
              </div>
            </section> : null}
          </Accordion> : null}
          {view === 'overview' && review.fields.onlyOpen && review.openCount === 0 ? <p role="status" className="p-5 text-sm text-muted-foreground">{t('review.allChecked')}</p> : null}
        </TabsContent>
        <TabsContent value="table">{view === 'table' ? <ReviewDataTable editor={review} /> : null}</TabsContent>
        <TabsContent value="matching">{view === 'matching' ? matchingPanel : null}</TabsContent>
      </fieldset>
    </Tabs>
  </section>
}
