import type { ReactNode } from 'react'

export function OverviewField({ label, children, emphasis = false }: { label: string; children?: ReactNode; emphasis?: boolean }) {
  return <div className="min-w-0 space-y-1.5">
    <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
    <dd className={`text-sm ${emphasis ? 'font-medium text-foreground' : ''} whitespace-pre-wrap [overflow-wrap:anywhere]`}>{children || <span className="font-normal text-muted-foreground">Nicht angegeben</span>}</dd>
  </div>
}
