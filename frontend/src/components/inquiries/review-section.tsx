import { useTranslation } from '@/i18n'
import type { ReactNode } from 'react'
import { Check, Circle } from 'lucide-react'
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

export function ReviewSection({ id, title, description, marker, confirmed, status, action, children }: {
  id: string; title: string; description: string; marker?: ReactNode; confirmed: boolean; status?: ReactNode; action: ReactNode; children: ReactNode
}) {
  const { t } = useTranslation()
  return <AccordionItem id={`review-section-${id}`} value={id} className="scroll-mt-3 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 bg-muted/60 pr-3">
    <AccordionTrigger className="min-w-0 items-center gap-2 rounded-none px-3 py-2.5 hover:bg-muted hover:no-underline">
      {marker ? <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-background text-xs font-semibold [&_svg]:size-4">{marker}</span> : null}
      {confirmed ? <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="size-3" aria-hidden="true" /></span> : <Circle className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold [overflow-wrap:anywhere]">{title}</span><span className="block truncate text-xs text-muted-foreground" title={description}>{description}</span></span>
      <span className="sr-only">{confirmed ? t('common.checked') : t('review.toCheck')}</span>
    </AccordionTrigger>
      {action}
    </div>
    {status ? <div className="px-3 pb-2">{status}</div> : null}
    <AccordionContent className="h-auto border-t pb-0 [&_p:not(:last-child)]:mb-0">{children}</AccordionContent>
  </AccordionItem>
}
