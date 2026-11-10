import { useTranslation } from '@/i18n'
import type { ReactNode } from 'react'

export function OverviewField({ label, children, emphasis = false }: { label: string; children?: ReactNode; emphasis?: boolean }) {
  const { t } = useTranslation()
  return <div className="min-w-0 space-y-1.5">
    <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
    <dd className={`text-sm ${emphasis ? 'font-medium text-foreground' : ''} whitespace-pre-wrap [overflow-wrap:anywhere]`}>{children || <span className="font-normal text-muted-foreground">{t('common.notSpecified')}</span>}</dd>
  </div>
}
