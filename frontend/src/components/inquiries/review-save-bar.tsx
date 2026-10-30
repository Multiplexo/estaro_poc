import { useTranslation } from '@/i18n'
import { Check, CheckCheck, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ReviewPersistence } from '@/hooks/use-inquiry-review'

export function ReviewSaveBar({ review }: { review: ReviewPersistence }) {
  const { t } = useTranslation()
  const complete = review.completed
  return <footer className="mt-2 shrink-0 rounded-lg border bg-background px-3 py-2">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div aria-live="polite"><p className="flex items-center gap-2 text-sm font-medium">{!review.dirty && !review.saving && !review.conflict ? <Check className="size-4 text-muted-foreground" aria-hidden="true" /> : null}{review.saving ? t('review.saving') : review.conflict ? t('review.newRevision') : review.dirty ? t('review.unsaved') : complete ? t('review.completed') : t('review.saved')}</p>
        <p className="mt-1 text-xs text-muted-foreground">{review.matchingAvailable ? t('review.summary', { count: review.summary.openCount, customer: review.summary.customerAssigned ? t('review.customerAssigned') : t('review.assignCustomer'), assigned: review.summary.assigned, total: review.summary.total }) : t('review.openFields', { count: review.summary.openCount })}</p>
      </div>
      <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={!review.dirty || review.saving || review.conflict} onClick={review.save}><Save aria-hidden="true" />{t('review.save')}</Button>
        <Button size="sm" disabled={!review.canComplete || review.saving || review.conflict || (complete && !review.dirty)} onClick={review.complete}><CheckCheck aria-hidden="true" />{complete && !review.dirty ? t('review.completed') : t('review.complete')}</Button>
      </div>
    </div>
    {!review.assignmentsComplete ? <p className="mt-1 text-xs text-muted-foreground">{t('review.assignmentHint')}</p> : null}
    {review.error && !review.conflict ? <p role="alert" className="mt-2 text-sm text-destructive">{t('review.saveError', { error: review.error })}</p> : null}
    {review.conflict ? <div role="alert" className="mt-3 space-y-2 border-t pt-3 text-sm"><p>{t('review.conflictHint')}</p><div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={!review.canResolveConflict} onClick={review.reload}>{t('review.reload')}</Button><Button variant="outline" disabled={!review.canResolveConflict} onClick={review.reapply}>{t('review.reapply')}</Button>
      {!review.canResolveConflict ? <Button variant="outline" disabled={review.saving} onClick={() => void review.refresh()}>{t('review.refresh')}</Button> : null}
    </div></div> : null}
  </footer>
}
