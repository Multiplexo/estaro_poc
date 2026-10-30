import { Button } from '@/components/ui/button'
import { useCancelInquiry } from '@/hooks/use-cancel-inquiry'
import type { DeleteInquiryController } from '@/hooks/use-delete-inquiry'
import type { Inquiry } from '@/lib/api'

export function InquiryJobActions({ inquiry, deletion, disabled = false }: {
  inquiry: Inquiry; deletion: DeleteInquiryController; disabled?: boolean
}) {
  const cancellation = useCancelInquiry()
  const status = inquiry.processing_job?.status
  const cancelling = cancellation.isPending || status === 'cancelling'
  const active = status === 'queued' || status === 'running' || status === 'cancelling'

  return <div className="space-y-2">
    <div className="flex flex-wrap gap-2">
      {active ? <Button size="sm" variant="outline" disabled title="Abbrechen ist derzeit nicht verfügbar." onClick={() => cancellation.cancel(inquiry.id)}>
        {cancelling ? 'Wird abgebrochen …' : 'Verarbeitung abbrechen'}
      </Button> : null}
      <Button size="sm" variant="ghost" disabled={disabled || deletion.isPending} onClick={(event) => deletion.selectInquiry(inquiry, event.currentTarget)}>Löschen</Button>
    </div>
    {cancellation.error ? <p role="alert" className="text-xs text-destructive">{cancellation.error}</p> : null}
  </div>
}
