import { useTranslation } from '@/i18n'
import type { ReviewFieldEditor, PositionReview } from '@/hooks/use-inquiry-review'
import { InlineMatching } from './inline-matching'
import { PositionNotes } from './position-notes'
import { ReviewFieldGroup } from './review-field-group'
import { ReviewGroupAction } from './review-group-action'
import { ReviewSection } from './review-section'
import { TrafficLightBadge } from './traffic-light-badge'

export function ReviewArticle({ position, editor, disabled, onSelect, onConfirm }: {
  position: PositionReview; editor: ReviewFieldEditor; disabled: boolean
  onSelect: (id?: string) => void; onConfirm: () => void
}) {
  const { t } = useTranslation()
  const { article, quantity, unit, status, confirmed, fields, index } = position
  if (editor.onlyOpen && confirmed) return null
  return <ReviewSection id={position.sectionId} marker={String(index + 1).padStart(2, '0')} title={article || t('review.articleWithoutName')} description={[quantity, unit].filter(Boolean).join(' ') || t('review.noQuantity')} confirmed={confirmed}
    status={<TrafficLightBadge status={status} label={t('review.articleLabel', { number: index + 1 })} showDetails={status.origin === 'manual'} />}
    action={<ReviewGroupAction confirmed={confirmed} disabled={disabled} onConfirm={onConfirm} label={t('review.articleLabel', { number: index + 1 })} />}>
    {status.origin === 'system' && status.color !== 'green' ? <div className="p-4"><PositionNotes status={status} /></div> : null}
    <InlineMatching kind="articles" selectedId={position.selectedId} suggestions={position.suggestions} initialSearch={article} onSelect={onSelect} />
    <ReviewFieldGroup fields={fields} editor={editor} />
  </ReviewSection>
}
