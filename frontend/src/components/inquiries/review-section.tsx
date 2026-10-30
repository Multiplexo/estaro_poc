import { useTranslation } from '@/i18n'
import type { ReactNode } from 'react'
import { Check, Circle } from 'lucide-react'
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

export function ReviewSection({ id, title, description, marker, confirmed, status, action, children }: {
  id: string; title: string; description: string; marker?: ReactNode; confirmed: boolean; status?: ReactNode; action: ReactNode; children: ReactNode
}) {
  const { t } = useTranslation()
  return <AccordionItem id={`review-section-${id}`} value={id} className="scroll-mt-4 overflow-hidden rounded-xl border border-border/80 bg-background shadow-sm">
    <AccordionTrigger className="items-center gap-3 rounded-none bg-muted/70 px-4 py-4 hover:bg-muted hover:no-underline aria-expanded:bg-muted/70">
      {marker ? <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-background text-base font-bold shadow-xs">{marker}</span> : null}
      {confirmed ? <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white"><Check className="size-4" aria-hidden="true" /></span> : <Circle className="size-6 shrink-0 text-muted-foreground" aria-hidden="true" />}
      <span className="min-w-0 flex-1"><span className="block text-base font-semibold [overflow-wrap:anywhere]">{title}</span><span className="mt-1 block text-sm font-medium text-muted-foreground [overflow-wrap:anywhere]">{description}</span></span>
      <span className="sr-only">{confirmed ? t('common.checked') : t('review.toCheck')}</span>
    </AccordionTrigger>
    <div className="flex flex-wrap items-start justify-end gap-3 bg-muted/70 px-4 pb-4">
      {status ? <div className="min-w-0 flex-1 basis-48">{status}</div> : null}
      {action}
    </div>
    <AccordionContent className="h-auto border-t pb-0 [&_p:not(:last-child)]:mb-0">{children}</AccordionContent>
  </AccordionItem>
}
