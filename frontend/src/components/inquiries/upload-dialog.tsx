import type { RefObject } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { UploadForm } from './upload-form'

type UploadDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  triggerRef: RefObject<HTMLButtonElement | null>
}

export function UploadDialog({ open, onOpenChange, triggerRef }: UploadDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent keepMounted finalFocus={triggerRef} className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Anfrage hochladen</DialogTitle>
          <DialogDescription>
            Eine PDF-Datei hochladen und als Anfrage extrahieren lassen.
          </DialogDescription>
        </DialogHeader>
        <UploadForm onSuccess={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}
