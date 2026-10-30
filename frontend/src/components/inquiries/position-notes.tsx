import { TriangleAlert } from 'lucide-react'
import { useTranslation } from '@/i18n'
import type { TrafficLight } from '@/lib/inquiry-traffic-light'

export function PositionNotes({ status, label }: { status: TrafficLight; label?: string }) {
  const { t } = useTranslation()
  if (status.origin === 'manual' || status.color === 'green' || status.reasons.length === 0) return null
  return <aside aria-label={t('review.positionNotes')} className="space-y-2 text-sm">
    <p className="flex items-center gap-2 font-semibold"><TriangleAlert aria-hidden="true" className="size-4 shrink-0" />{label ?? t('review.positionNotes')}</p>
    <ul className="list-disc space-y-1 pl-5 [overflow-wrap:anywhere]">{status.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
  </aside>
}
