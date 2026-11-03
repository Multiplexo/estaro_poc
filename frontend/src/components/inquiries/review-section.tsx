import { useTranslation } from '@/i18n'
import type { ReactNode } from 'react'
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

export function ReviewSection({ id, title, description, marker, confirmed, status, action, children }: {
  id: string; title: string; description: string; marker?: ReactNode; confirmed: boolean; status?: ReactNode; action: ReactNode; children: ReactNode
}) {
  const { t } = useTranslation()
  return <AccordionItem id={`review-section-${id}`} value={id} className="scroll-mt-4 overflow-hidden rounded-lg border border-border bg-card">
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 bg-muted/30 pr-3">
    <AccordionTrigger className="h-20 min-w-0 items-center gap-3 rounded-none px-4 py-3 hover:bg-muted/40 hover:no-underline">
      {marker ? <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium text-muted-foreground [&_svg]:size-4">{marker}</span> : null}
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold" title={title}>{title}</span><span className="block truncate text-xs text-muted-foreground" title={description}>{description}</span></span>
      <span className="sr-only">{confirmed ? t('common.checked') : t('review.toCheck')}</span>
    </AccordionTrigger>
      {action}
    </div>
    {status ? <div className="px-4 pb-3">{status}</div> : null}
    <AccordionContent className="h-auto border-t pb-0 [&_p:not(:last-child)]:mb-0">{children}</AccordionContent>
  </AccordionItem>
}
