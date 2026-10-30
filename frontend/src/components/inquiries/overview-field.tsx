import type { ReactNode } from 'react'

export function OverviewField({ label, children, emphasis = false }: { label: string; children?: ReactNode; emphasis?: boolean }) {
  return <div className={`min-w-0 space-y-1.5 ${emphasis ? 'rounded-lg border border-blue-100 bg-blue-50/60 p-3' : ''}`}>
    <dt className={`text-sm font-medium ${emphasis ? 'text-blue-900/80' : 'text-muted-foreground'}`}>{label}</dt>
    <dd className={`${emphasis ? 'text-base font-semibold text-foreground' : 'text-sm'} whitespace-pre-wrap [overflow-wrap:anywhere]`}>{children || <span className="font-normal text-muted-foreground">Nicht angegeben</span>}</dd>
  </div>
}
