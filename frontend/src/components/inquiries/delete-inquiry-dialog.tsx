import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { DeleteInquiryController } from '@/hooks/use-delete-inquiry'

export function DeleteInquiryDialog({ deletion }: { deletion: DeleteInquiryController }) {
  return (
    <Dialog open={deletion.inquiry !== null} onOpenChange={(open) => {
      if (!open) deletion.selectInquiry(null)
    }}>
      <DialogContent finalFocus={deletion.triggerRef} showCloseButton={!deletion.isPending}>
        <DialogHeader>
          <DialogTitle>Anfrage löschen?</DialogTitle>
          <DialogDescription>
            Die Anfrage mit allen Dokumenten, E-Mail-Anhängen und
            Verarbeitungsergebnissen wird unwiderruflich gelöscht.
          </DialogDescription>
        </DialogHeader>
        <p className="break-all text-xs text-muted-foreground">{deletion.inquiry?.id}</p>
        {deletion.error ? <p role="alert" className="text-destructive">{deletion.error}</p> : null}
        <DialogFooter>
          <Button variant="outline" disabled={deletion.isPending} onClick={() => deletion.selectInquiry(null)} autoFocus>
            Abbrechen
          </Button>
          <Button variant="destructive" disabled={deletion.isPending} onClick={deletion.confirm}>
            {deletion.isPending ? 'Wird gelöscht …' : 'Endgültig löschen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
