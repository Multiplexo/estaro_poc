import { useTranslation } from '@/i18n'
import { useRef } from 'react'
import { Menu } from '@base-ui/react/menu'
import { useNavigate } from '@tanstack/react-router'
import { EllipsisIcon, RefreshCwIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDeleteInquiry } from '@/hooks/use-delete-inquiry'
import { useReprocessInquiry } from '@/hooks/use-reprocess-inquiry'
import { useRetryInquiryMatching } from '@/hooks/use-retry-inquiry-matching'
import type { Inquiry } from '@/lib/api'
import { DeleteInquiryDialog } from './delete-inquiry-dialog'
import { InquiryErrorIndicator } from './inquiry-error-indicator'

export function InquiryDetailActions({ inquiry }: { inquiry: Inquiry }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const menuTriggerRef = useRef<HTMLButtonElement>(null)
  const deletion = useDeleteInquiry({ onDeleted: () => navigate({ to: '/' }) })
  // The detail page already polls these shared queries through useInquiryAnalysis.
  const reprocess = useReprocessInquiry(inquiry.id, { poll: false })
  const matching = useRetryInquiryMatching(inquiry.id)
  const warnings = [
    reprocess.error,
    matching.retry.error?.message,
    matching.failed ? t('matching.retryHint') : null,
  ].filter(Boolean).join('\n\n')

  return <>
    {warnings ? <InquiryErrorIndicator message={warnings} /> : null}
    <Menu.Root>
      <Menu.Trigger render={<Button ref={menuTriggerRef} variant="ghost" size="icon" className="size-11" aria-label={t('inquiries.actionsLabel')} />}>
        <EllipsisIcon aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end" sideOffset={4} className="isolate z-50">
          <Menu.Popup finalFocus={deletion.inquiry ? false : undefined} className="w-80 max-w-[calc(100vw-2rem)] rounded-lg bg-popover p-1 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden">
            <Menu.Item disabled={reprocess.disabled || matching.retry.isPending || deletion.isPending} onClick={reprocess.start} className="flex min-h-11 cursor-default items-center gap-2 rounded-md px-3 py-2 outline-none data-highlighted:bg-muted data-disabled:pointer-events-none data-disabled:opacity-50">
              <RefreshCwIcon aria-hidden="true" className={`size-4 shrink-0 ${reprocess.busy ? 'motion-safe:animate-spin' : ''}`} />
              <span>{reprocess.label}</span>
            </Menu.Item>
            {matching.failed || matching.retry.isPending || matching.retry.isError ? <Menu.Item disabled={!matching.failed || matching.retry.isPending || reprocess.busy || deletion.isPending} onClick={() => matching.retry.mutate()} className="flex min-h-11 cursor-default items-center gap-2 rounded-md px-3 py-2 outline-none data-highlighted:bg-muted data-disabled:pointer-events-none data-disabled:opacity-50">
              <RefreshCwIcon aria-hidden="true" className={`size-4 shrink-0 ${matching.retry.isPending ? 'motion-safe:animate-spin' : ''}`} />
              <span>{matching.retry.isPending ? t('matching.starting') : t('matching.restart')}</span>
            </Menu.Item> : null}
            <Menu.Separator className="my-1 h-px bg-border" />
            <Menu.Item disabled={deletion.isPending} onClick={() => deletion.selectInquiry(inquiry, menuTriggerRef.current ?? undefined)} className="flex min-h-11 cursor-default items-center gap-2 rounded-md px-3 py-2 text-destructive outline-none data-highlighted:bg-destructive/10 data-disabled:pointer-events-none data-disabled:opacity-50">
              <Trash2Icon aria-hidden="true" className="size-4 shrink-0" />
              {t('common.delete')}
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
    <DeleteInquiryDialog deletion={deletion} />
  </>
}
