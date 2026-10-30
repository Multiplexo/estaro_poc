import { useTranslation } from '@/i18n'
import { Badge } from '@/components/ui/badge'
import type { TrafficLight } from '@/lib/inquiry-traffic-light'

const appearances = {
  green: { labelKey: 'traffic.green', style: 'border-emerald-300 bg-emerald-50 text-emerald-950', dot: 'bg-emerald-600' },
  yellow: { labelKey: 'traffic.yellow', style: 'border-amber-300 bg-amber-50 text-amber-950', dot: 'bg-amber-500' },
  red: { labelKey: 'traffic.red', style: 'border-red-300 bg-red-50 text-red-950', dot: 'bg-red-600' },
} as const

export function TrafficLightBadge({ status, label, prominent = false, showDetails = true }: { status: TrafficLight; label?: string; prominent?: boolean; showDetails?: boolean }) {
  const { t, i18n } = useTranslation()
  const appearance = appearances[status.color]
  const provenance = status.origin === 'manual' ? t('traffic.manual') : t('traffic.system')
  const timestamp = status.confirmedAt ? new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(status.confirmedAt)) : undefined
  return <div className={prominent ? `flex flex-col items-start gap-2 rounded-lg border p-3 ${appearance.style}` : 'space-y-2 text-sm'} role="status" aria-atomic="true">
    {prominent ? <p className="w-full text-xs font-medium">{t('traffic.heading')}</p> : null}
    <Badge variant="outline" className={`${appearance.style} h-auto max-w-full gap-2 whitespace-normal text-left ${prominent ? 'justify-start rounded-none border-0 bg-transparent p-0 text-sm font-semibold' : 'px-3 py-2 text-sm font-semibold'}`} aria-label={t('traffic.label', { label: label ?? t('traffic.position'), color: t(appearance.labelKey), origin: provenance })}>
      <span aria-hidden="true" className={`size-3 shrink-0 rounded-full ${appearance.dot}`} /><span>{t(appearance.labelKey)} · {provenance}</span>
    </Badge>
    {showDetails ? <div className={`w-full ${prominent ? 'text-xs leading-relaxed' : 'text-sm'}`}>{status.origin === 'manual' ? <p>{timestamp ? t('traffic.confirmedAt', { time: timestamp }) : t('traffic.notSaved')}</p> : <ul className="list-inside list-disc">{status.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}</div> : null}
  </div>
}
